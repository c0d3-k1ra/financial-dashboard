import { Router, type IRouter } from "express";
import { eq, desc, sql, and, ilike } from "drizzle-orm";
import { db, transactionsTable } from "@workspace/db";
import { z } from "zod";

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

let anthropicClient: Awaited<ReturnType<typeof import("@workspace/integrations-anthropic-ai")>>["anthropic"] | null = null;

async function getAnthropicClient() {
  if (!anthropicClient) {
    try {
      const mod = await import("@workspace/integrations-anthropic-ai");
      anthropicClient = mod.anthropic;
    } catch {
      throw new Error("AI integration is not configured. Please ensure Anthropic environment variables are set.");
    }
  }
  return anthropicClient;
}

interface MerchantDefaults {
  dominantAccount: { id: number; name: string } | null;
  dominantCategory: string | null;
}

async function getMerchantDefaults(description: string): Promise<MerchantDefaults> {
  const result: MerchantDefaults = { dominantAccount: null, dominantCategory: null };
  if (!description) return result;

  const rows = await db
    .select({
      accountId: transactionsTable.accountId,
      category: transactionsTable.category,
    })
    .from(transactionsTable)
    .where(ilike(transactionsTable.description, `%${description}%`))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(20);

  if (rows.length < 3) return result;

  const accountCounts: Record<number, number> = {};
  const categoryCounts: Record<string, number> = {};

  for (const row of rows) {
    if (row.accountId) {
      accountCounts[row.accountId] = (accountCounts[row.accountId] || 0) + 1;
    }
    if (row.category && row.category !== "Transfer") {
      categoryCounts[row.category] = (categoryCounts[row.category] || 0) + 1;
    }
  }

  const topAccount = Object.entries(accountCounts).sort((a, b) => b[1] - a[1])[0];
  if (topAccount && topAccount[1] >= 3) {
    result.dominantAccount = { id: Number(topAccount[0]), name: "" };
  }

  const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0];
  if (topCategory && topCategory[1] >= 2) {
    result.dominantCategory = topCategory[0];
  }

  return result;
}

async function getCategoryDominantAccount(category: string): Promise<{ id: number } | null> {
  if (!category) return null;

  const rows = await db
    .select({
      accountId: transactionsTable.accountId,
    })
    .from(transactionsTable)
    .where(and(
      eq(transactionsTable.category, category),
      sql`${transactionsTable.type} != 'Transfer'`,
    ))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(30);

  if (rows.length < 3) return null;

  const counts: Record<number, number> = {};
  let total = 0;
  for (const row of rows) {
    if (row.accountId) {
      counts[row.accountId] = (counts[row.accountId] || 0) + 1;
      total++;
    }
  }

  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (top && total > 0 && (top[1] / total) >= 0.7) {
    return { id: Number(top[0]) };
  }

  return null;
}

async function getRecentAccountUsage(): Promise<{ id: number; count: number }[]> {
  const rows = await db
    .select({
      accountId: transactionsTable.accountId,
      cnt: sql<number>`count(*)`.as("cnt"),
    })
    .from(transactionsTable)
    .where(sql`${transactionsTable.type} != 'Transfer' AND ${transactionsTable.accountId} IS NOT NULL`)
    .groupBy(transactionsTable.accountId)
    .orderBy(sql`count(*) DESC`)
    .limit(10);

  return rows
    .filter((r) => r.accountId !== null)
    .map((r) => ({ id: r.accountId!, count: Number(r.cnt) }));
}

async function getRecentCategoryUsage(): Promise<{ name: string; count: number }[]> {
  const rows = await db
    .select({
      category: transactionsTable.category,
      cnt: sql<number>`count(*)`.as("cnt"),
    })
    .from(transactionsTable)
    .where(sql`${transactionsTable.type} != 'Transfer'`)
    .groupBy(transactionsTable.category)
    .orderBy(sql`count(*) DESC`)
    .limit(10);

  return rows.map((r) => ({ name: r.category, count: Number(r.cnt) }));
}

const router: IRouter = Router();

router.post("/ai/chat", async (req, res) => {
  try {
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

    let merchantDefaults: MerchantDefaults = { dominantAccount: null, dominantCategory: null };
    let categoryDominantAcct: { id: number } | null = null;
    let recentAccounts: { id: number; count: number }[] = [];
    let recentCategories: { name: string; count: number }[] = [];

    try {
      const words = lastUserMsg.content.split(/\s+/).filter((w: string) => w.length > 2 && !/^\d+$/.test(w));
      const possibleMerchant = words.slice(-3).join(" ");
      [merchantDefaults, recentAccounts, recentCategories] = await Promise.all([
        getMerchantDefaults(possibleMerchant),
        getRecentAccountUsage(),
        getRecentCategoryUsage(),
      ]);
    } catch (e) {
      req.log.warn({ err: e }, "Failed to fetch transaction history defaults");
    }

    const categoryList = userCategories.length > 0
      ? userCategories.map((c: { name: string; type: string }) => `${c.name} (${c.type})`).join(", ")
      : "None";

    const accountList = userAccounts.length > 0
      ? userAccounts.map((a: { id: number; name: string; type: string }) => `${a.name} (id: ${a.id}, type: ${a.type})`).join(", ")
      : "None";

    const today = new Date().toISOString().split("T")[0];
    const dayOfWeek = new Date().toLocaleDateString("en-US", { weekday: "long" });

    const historyContext = [];
    if (merchantDefaults.dominantCategory) {
      historyContext.push(`Merchant history suggests category: "${merchantDefaults.dominantCategory}"`);
    }
    if (merchantDefaults.dominantAccount) {
      historyContext.push(`Merchant history suggests account ID: ${merchantDefaults.dominantAccount.id}`);
    }
    if (recentCategories.length > 0) {
      historyContext.push(`Most used categories (by frequency): ${recentCategories.slice(0, 5).map((c) => c.name).join(", ")}`);
    }
    if (recentAccounts.length > 0) {
      const acctNames = recentAccounts.slice(0, 5).map((a) => {
        const acct = userAccounts.find((ua: { id: number; name: string; type: string }) => ua.id === a.id);
        return acct ? acct.name : `ID:${a.id}`;
      });
      historyContext.push(`Most used accounts (by frequency): ${acctNames.join(", ")}`);
    }

    const systemPrompt = `You are a conversational financial transaction assistant. You help users log transactions through a chat-like interface using slot-filling.

Today is ${dayOfWeek}, ${today}.

Available categories: ${categoryList}
Available accounts: ${accountList}

${historyContext.length > 0 ? "Transaction history insights:\n" + historyContext.join("\n") : ""}

CRITICAL RULES:
- You handle exactly ONE transaction at a time. NEVER batch or combine multiple transactions.
- If the user mentions a new transaction while a previous one was already logged/confirmed, treat it as a completely fresh transaction. Ignore any previously logged transactions from the conversation history.
- Each confirmation must have exactly one transaction in the "transaction" field.

SLOT-FILLING RULES:
1. Extract as many fields as possible from the user's message: amount, description/merchant, category, account, date, transaction type (Income/Expense/Transfer).
2. Smart defaults (apply these, NEVER ask about them if they can be inferred):
   - Date: Always default to today (${today}). Never ask about the date unless the user mentions a specific date.
   - Type: Infer from language — "received", "got paid", "salary", "earned" → Income; "transferred", "moved", "sent to [account]" → Transfer; everything else → Expense.
   - Account: Use merchant history suggestion if available, then category-dominant account if available, then the most frequently used account.
   - Category: Use merchant history suggestion if available, then infer from context (e.g., "Starbucks" → coffee/drinks category, "grocery" → groceries, etc.).
   - Description: Use the merchant/place name from the user's input. If only a category is mentioned, description is optional.
3. Only ask about fields that truly cannot be inferred. Prefer to ask ONE question at a time.
4. When asking about accounts or categories, provide the top 4-5 most relevant options as suggestions.
5. For transfers: identify source and destination accounts. If ambiguous (e.g., "Paid Ravi 500"), ask if it's an expense or transfer.
6. Handle corrections: if the user says "wait, make it 300" or "change the category to Food", update the relevant slot.
7. Handle cancel phrases: if the user says "cancel", "never mind", "forget it", respond with a cancellation.

RESPONSE FORMAT:
You MUST respond with ONLY a valid JSON object (no markdown, no code fences, no explanation) in this format:
{
  "reply": "Your conversational message to the user",
  "type": "question" | "confirmation" | "error" | "cancelled",
  "options": [{"label": "Display Text", "value": "actual_value"}],
  "transaction": {
    "transactionType": "Income" | "Expense" | "Transfer",
    "amount": "string number",
    "date": "YYYY-MM-DD",
    "description": "string",
    "category": "exact category name",
    "accountId": number or null,
    "fromAccountId": number or null,
    "toAccountId": number or null
  }
}

RULES FOR RESPONSE TYPES:
- "question": When you need more info. Include "options" array if asking about categories/accounts (max 5 items + include an "Other..." option if there are more). "transaction" should contain whatever slots are filled so far.
- "confirmation": When ALL required slots are filled. "transaction" must have all fields filled. "reply" should summarize the transaction clearly.
- "cancelled": When user wants to cancel. No transaction needed.
- "error": When input is unintelligible.

For Income/Expense: set accountId, leave fromAccountId and toAccountId as null.
For Transfer: set fromAccountId and toAccountId, leave accountId as null. Set category to "Transfer".

Required slots for confirmation:
- Income/Expense: amount, date, description (can be category name if no merchant), category, accountId, transactionType
- Transfer: amount, date, fromAccountId, toAccountId, transactionType (description optional, category = "Transfer")

The "options" field is only needed when type is "question" and you're asking about a finite set of choices. Sort options by relevance/frequency.`;

    const aiMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const ai = await getAnthropicClient();
    const message = await ai.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: aiMessages,
      system: systemPrompt,
    });

    const block = message.content[0];
    if (block.type !== "text") {
      res.status(500).json({ error: "Unexpected AI response format" });
      return;
    }

    let parsed;
    try {
      let text = block.text.trim();
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        text = jsonMatch[1].trim();
      }
      parsed = JSON.parse(text);
    } catch {
      req.log.error({ rawResponse: block.text }, "Failed to parse AI chat response as JSON");
      res.json({
        reply: "I had trouble understanding that. Could you rephrase your transaction?",
        type: "error" as const,
      });
      return;
    }

    if (parsed.type === "confirmation" && parsed.transaction) {
      const tx = parsed.transaction;
      if (tx.transactionType !== "Transfer" && !tx.accountId && userAccounts.length > 0) {
        if (merchantDefaults.dominantAccount) {
          tx.accountId = merchantDefaults.dominantAccount.id;
        } else if (tx.category) {
          const catAcct = await getCategoryDominantAccount(tx.category);
          if (catAcct) {
            tx.accountId = catAcct.id;
          }
        }
        if (!tx.accountId && recentAccounts.length > 0) {
          tx.accountId = recentAccounts[0].id;
        }
      }
    }

    res.json({
      reply: parsed.reply ?? "I couldn't understand that.",
      type: parsed.type ?? "error",
      options: parsed.options ?? undefined,
      transaction: parsed.transaction ?? undefined,
    });
  } catch (e) {
    req.log.error({ err: e }, "Failed to process AI chat");
    res.status(500).json({ error: "Failed to process your message. Please try again." });
  }
});

export default router;
