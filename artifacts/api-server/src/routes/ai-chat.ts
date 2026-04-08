import { Router, type IRouter } from "express";
import { db, categoriesTable, budgetGoalsTable } from "@workspace/db";
import { z } from "zod";

import { upsertMerchantMapping } from "./helpers/merchant-mapping";
import { detectQueryIntent, handleQuery } from "./helpers/query-handler";
import { buildSystemPrompt, buildHistoryContext, fetchMerchantContext } from "./helpers/chat-prompt";
import { validateAndEnrichConfirmation, parseAiResponse, type TransactionSlots, type ResponsePayload } from "./helpers/chat-confirmation";
import { asyncHandler } from "../lib/async-handler";

const AiChatBody = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    }),
  ),
  categories: z.array(
    z.object({
      name: z.string(),
      type: z.string(),
    }),
  ),
  accounts: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      type: z.string(),
    }),
  ),
});

import { getAnthropicClient } from "../lib/ai-client";

const router: IRouter = Router();

router.post("/ai/chat", asyncHandler(async (req, res) => {
  const data = AiChatBody.parse(req.body);
  const { messages, categories: userCategories, accounts: userAccounts } = data;

  if (!messages.length) {
    res.status(400).json({ error: "Messages array cannot be empty" });
    return;
  }

  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUserMsg) {
    res.status(400).json({ error: "No user message found" });
    return;
  }

  if (lastUserMsg.content.startsWith("__create_category__:")) {
    const newCatName = lastUserMsg.content.slice("__create_category__:".length).trim();
    if (newCatName) {
      try {
        const [created] = await db
          .insert(categoriesTable)
          .values({ name: newCatName, type: "Expense" })
          .returning();
        if (created) {
          const { BUDGET_DEFAULTS, DEFAULT_PLANNED } = await import("../lib/budget-defaults");
          const plannedAmount = BUDGET_DEFAULTS[newCatName] ?? DEFAULT_PLANNED;
          await db.insert(budgetGoalsTable).values({
            categoryId: created.id,
            plannedAmount: plannedAmount.toFixed(2),
          });
        }
        const prevAssistant = [...messages].reverse().find((m) => m.role === "assistant");
        let pendingTx: Record<string, unknown> | undefined;
        if (prevAssistant) {
          try {
            const parsed = JSON.parse(prevAssistant.content);
            if (parsed.transaction) {
              pendingTx = parsed.transaction;
              pendingTx!.category = newCatName;
            }
          } catch {
          }
        }
        res.json({
          reply: `Created category "${newCatName}". ${pendingTx ? "Here's your updated transaction:" : "You can now use this category."}`,
          type: pendingTx ? "confirmation" : "question",
          transaction: pendingTx ?? undefined,
        });
        return;
      } catch {
        res.json({
          reply: `Category "${newCatName}" may already exist. Try selecting it from the list.`,
          type: "question" as const,
        });
        return;
      }
    }
  }

  if (lastUserMsg.content === "__create_account__") {
    res.json({
      reply: "What would you like to name the new account, and what type is it?",
      type: "question" as const,
      options: [
        { label: "Bank Account", value: "Create a new Bank account" },
        { label: "Credit Card", value: "Create a new Credit Card account" },
      ],
    });
    return;
  }

  const queryIntent = detectQueryIntent(lastUserMsg.content);
  if (queryIntent) {
    try {
      const result = await handleQuery(queryIntent, userAccounts);
      res.json({
        reply: result.reply,
        type: "query_result" as const,
        queryData: result.queryData,
      });
      return;
    } catch (e) {
      req.log.error({ err: e }, "Failed to handle query");
    }
  }

  const { merchantDefaults, recentAccounts, recentCategories, recurringPattern } =
    await fetchMerchantContext(lastUserMsg.content);

  const historyContext = buildHistoryContext(
    merchantDefaults, recentCategories, recentAccounts, userAccounts, recurringPattern,
  );
  const systemPrompt = buildSystemPrompt({ userCategories, userAccounts, historyContext });

  const aiMessages = messages.map((m: { role: string; content: string }) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const ai = await getAnthropicClient();
  const message = await ai.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2048,
    messages: aiMessages,
    system: systemPrompt,
  });

  const block = message.content[0];
  if (block.type !== "text") {
    res.status(500).json({ error: "Unexpected AI response format" });
    return;
  }

  const parsed = parseAiResponse(block.text);
  if (!parsed) {
    req.log.error({ rawResponse: block.text }, "Failed to parse AI chat response as JSON");
    res.json({
      reply: "I had trouble understanding that. Could you rephrase your transaction?",
      type: "error" as const,
    });
    return;
  }

  const responsePayload: ResponsePayload = {
    reply: String(parsed.reply ?? "I couldn't understand that."),
    type: String(parsed.type ?? "error"),
    options: Array.isArray(parsed.options) ? parsed.options as ResponsePayload["options"] : undefined,
    transaction: parsed.transaction as TransactionSlots | undefined,
  };

  if (parsed.type === "confirmation" && parsed.transaction) {
    const tx = parsed.transaction as TransactionSlots;
    const earlyReturn = await validateAndEnrichConfirmation(
      tx, responsePayload,
      userCategories, userAccounts, merchantDefaults, recentAccounts,
    );
    if (earlyReturn) {
      res.json(earlyReturn);
      return;
    }
  }

  res.json(responsePayload);
}));

router.post("/ai/chat/confirm", asyncHandler(async (req, res) => {
  const body = z.object({
    description: z.string().optional(),
    category: z.string().optional(),
    accountId: z.number().nullable().optional(),
  }).parse(req.body);

  if (body.description && body.category) {
    await upsertMerchantMapping(body.description, body.category, body.accountId ?? null);
  }

  res.json({ ok: true });
}));

export default router;
