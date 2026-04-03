import { Router, type IRouter } from "express";
import { eq, desc, ilike, and, sql } from "drizzle-orm";
import { db, transactionsTable, accountsTable } from "@workspace/db";
import {
  ListTransactionsQueryParams,
  CreateTransactionBody,
  UpdateTransactionParams,
  ParseNaturalTransactionBody,
} from "@workspace/api-zod";
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

const router: IRouter = Router();

router.get("/transactions", async (req, res) => {
  try {
    const params = ListTransactionsQueryParams.parse(req.query);
    const conditions = [];

    if (params.cycleStart && params.cycleEnd) {
      conditions.push(sql`${transactionsTable.date}::date >= ${params.cycleStart}::date`);
      conditions.push(sql`${transactionsTable.date}::date <= ${params.cycleEnd}::date`);
    } else if (params.month) {
      conditions.push(sql`to_char(${transactionsTable.date}::date, 'YYYY-MM') = ${params.month}`);
    }
    if (params.type) {
      conditions.push(eq(transactionsTable.type, params.type));
    }
    if (params.category) {
      conditions.push(eq(transactionsTable.category, params.category));
    }
    if (params.search) {
      conditions.push(ilike(transactionsTable.description, `%${params.search}%`));
    }
    if (params.accountId) {
      conditions.push(eq(transactionsTable.accountId, Number(params.accountId)));
    }
    if (params.amountMin) {
      conditions.push(sql`${transactionsTable.amount}::numeric >= ${params.amountMin}::numeric`);
    }
    if (params.amountMax) {
      conditions.push(sql`${transactionsTable.amount}::numeric <= ${params.amountMax}::numeric`);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const results = await db
      .select()
      .from(transactionsTable)
      .where(where)
      .orderBy(desc(transactionsTable.date), desc(transactionsTable.id));

    res.json(results);
  } catch (e) {
    req.log.error({ err: e }, "Failed to list transactions");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.get("/transactions/recent", async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const results = await db
      .select()
      .from(transactionsTable)
      .where(sql`${transactionsTable.type} != 'Transfer'`)
      .orderBy(desc(transactionsTable.date), desc(transactionsTable.id))
      .limit(limit);
    res.json(results);
  } catch (e) {
    req.log.error({ err: e }, "Failed to get recent transactions");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/transactions", async (req, res) => {
  try {
    const data = CreateTransactionBody.parse(req.body);

    if (data.type === "Transfer") {
      res.status(400).json({ error: "Use the /transfers endpoint to create transfers." });
      return;
    }

    if (Number(data.amount) < 0) {
      res.status(400).json({ error: "Amount must be non-negative." });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(transactionsTable)
        .values({
          date: data.date,
          amount: data.amount,
          description: data.description,
          category: data.category,
          type: data.type,
          accountId: data.accountId,
        })
        .returning();

      if (data.type === "Income") {
        await tx
          .update(accountsTable)
          .set({ currentBalance: sql`${accountsTable.currentBalance}::numeric + ${data.amount}::numeric` })
          .where(eq(accountsTable.id, data.accountId));
      } else if (data.type === "Expense") {
        await tx
          .update(accountsTable)
          .set({ currentBalance: sql`${accountsTable.currentBalance}::numeric - ${data.amount}::numeric` })
          .where(eq(accountsTable.id, data.accountId));
      }

      return created;
    });

    res.status(201).json(result);
  } catch (e) {
    req.log.error({ err: e }, "Failed to create transaction");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.put("/transactions/:id", async (req, res) => {
  try {
    const { id } = UpdateTransactionParams.parse({ id: req.params.id });
    const data = CreateTransactionBody.parse(req.body);

    if (data.type === "Transfer") {
      res.status(400).json({ error: "Use the /transfers endpoint to create transfers." });
      return;
    }

    if (Number(data.amount) < 0) {
      res.status(400).json({ error: "Amount must be non-negative." });
      return;
    }

    const [existing] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    if (existing.type === "Transfer") {
      res.status(400).json({ error: "Transfer transactions cannot be edited. Delete and recreate instead." });
      return;
    }

    const updated = await db.transaction(async (tx) => {
      if (existing.accountId) {
        if (existing.type === "Income") {
          await tx
            .update(accountsTable)
            .set({ currentBalance: sql`${accountsTable.currentBalance}::numeric - ${existing.amount}::numeric` })
            .where(eq(accountsTable.id, existing.accountId));
        } else if (existing.type === "Expense") {
          await tx
            .update(accountsTable)
            .set({ currentBalance: sql`${accountsTable.currentBalance}::numeric + ${existing.amount}::numeric` })
            .where(eq(accountsTable.id, existing.accountId));
        }
      }

      const [result] = await tx
        .update(transactionsTable)
        .set({
          date: data.date,
          amount: data.amount,
          description: data.description,
          category: data.category,
          type: data.type,
          accountId: data.accountId,
        })
        .where(eq(transactionsTable.id, id))
        .returning();

      if (data.type === "Income") {
        await tx
          .update(accountsTable)
          .set({ currentBalance: sql`${accountsTable.currentBalance}::numeric + ${data.amount}::numeric` })
          .where(eq(accountsTable.id, data.accountId));
      } else if (data.type === "Expense") {
        await tx
          .update(accountsTable)
          .set({ currentBalance: sql`${accountsTable.currentBalance}::numeric - ${data.amount}::numeric` })
          .where(eq(accountsTable.id, data.accountId));
      }

      return result;
    });

    res.json(updated);
  } catch (e) {
    req.log.error({ err: e }, "Failed to update transaction");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/transactions/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const [existing] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id));

    if (existing) {
      await db.transaction(async (tx) => {
        if (existing.type === "Transfer") {
          if (existing.accountId) {
            const [fromAcct] = await tx.select().from(accountsTable).where(eq(accountsTable.id, existing.accountId));
            const fromIsDebt = fromAcct && (fromAcct.type === "credit_card" || fromAcct.type === "loan");
            if (fromIsDebt) {
              await tx
                .update(accountsTable)
                .set({ currentBalance: sql`${accountsTable.currentBalance}::numeric - ${existing.amount}::numeric` })
                .where(eq(accountsTable.id, existing.accountId));
            } else {
              await tx
                .update(accountsTable)
                .set({ currentBalance: sql`${accountsTable.currentBalance}::numeric + ${existing.amount}::numeric` })
                .where(eq(accountsTable.id, existing.accountId));
            }
          }
          if (existing.toAccountId) {
            const [toAcct] = await tx.select().from(accountsTable).where(eq(accountsTable.id, existing.toAccountId));
            const toIsDebt = toAcct && (toAcct.type === "credit_card" || toAcct.type === "loan");
            if (toIsDebt) {
              await tx
                .update(accountsTable)
                .set({ currentBalance: sql`${accountsTable.currentBalance}::numeric + ${existing.amount}::numeric` })
                .where(eq(accountsTable.id, existing.toAccountId));
            } else {
              await tx
                .update(accountsTable)
                .set({ currentBalance: sql`${accountsTable.currentBalance}::numeric - ${existing.amount}::numeric` })
                .where(eq(accountsTable.id, existing.toAccountId));
            }
          }
        } else if (existing.accountId) {
          if (existing.type === "Income") {
            await tx
              .update(accountsTable)
              .set({ currentBalance: sql`${accountsTable.currentBalance}::numeric - ${existing.amount}::numeric` })
              .where(eq(accountsTable.id, existing.accountId));
          } else if (existing.type === "Expense") {
            await tx
              .update(accountsTable)
              .set({ currentBalance: sql`${accountsTable.currentBalance}::numeric + ${existing.amount}::numeric` })
              .where(eq(accountsTable.id, existing.accountId));
          }
        }

        await tx.delete(transactionsTable).where(eq(transactionsTable.id, id));
      });
    }

    res.status(204).send();
  } catch (e) {
    req.log.error({ err: e }, "Failed to delete transaction");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/transactions/parse-natural", async (req, res) => {
  try {
    const data = ParseNaturalTransactionBody.parse(req.body);
    const { text, categories: userCategories, accounts: userAccounts } = data;

    const categoryList = userCategories.length > 0
      ? userCategories.map((c) => `${c.name} (${c.type})`).join(", ")
      : "None";

    const accountList = userAccounts.length > 0
      ? userAccounts.map((a) => `${a.name} (id: ${a.id}, type: ${a.type})`).join(", ")
      : "None";

    const today = new Date().toISOString().split("T")[0];
    const dayOfWeek = new Date().toLocaleDateString("en-US", { weekday: "long" });

    const systemPrompt = `You are a financial transaction parser. Extract structured transaction data from natural language input.

Today is ${dayOfWeek}, ${today}.

The user's available categories are: ${categoryList}
The user's available accounts are: ${accountList}

Rules:
1. Determine if this is an Income, Expense, or Transfer transaction.
2. For transfers, look for keywords like "transfer", "move", "send money from X to Y", "pay X from Y".
3. Resolve relative dates: "today" = ${today}, "yesterday" = one day before today, "last Friday" = the most recent past Friday, "on the 15th" = the 15th of the current month (or previous month if the 15th hasn't occurred yet).
4. Match category names and account names against the provided lists. Use exact names from the lists.
5. If you cannot confidently determine a field, set it to null.
6. Amount should be a string number without currency symbols.
7. For transfers, identify fromAccountId and toAccountId from the account list by matching names.

Respond with ONLY a valid JSON object (no markdown, no explanation) in this format:
{
  "transactionType": "Income" | "Expense" | "Transfer",
  "amount": "string number or null",
  "date": "YYYY-MM-DD or null",
  "description": "string or null",
  "category": "exact category name or null",
  "accountId": number or null,
  "fromAccountId": number or null,
  "toAccountId": number or null
}

For Income/Expense: set accountId to the matched account id, leave fromAccountId and toAccountId as null.
For Transfer: set fromAccountId and toAccountId, leave accountId as null. Set category to "Transfer".`;

    const ai = await getAnthropicClient();
    const message = await ai.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 8192,
      messages: [{ role: "user", content: text.trim() }],
      system: systemPrompt,
    });

    const block = message.content[0];
    if (block.type !== "text") {
      res.status(500).json({ error: "Unexpected AI response format" });
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(block.text);
    } catch {
      req.log.error({ rawResponse: block.text }, "Failed to parse AI response as JSON");
      res.status(500).json({ error: "AI returned invalid response. Please try rephrasing." });
      return;
    }

    res.json({
      transactionType: parsed.transactionType ?? null,
      amount: parsed.amount ?? null,
      date: parsed.date ?? null,
      description: parsed.description ?? null,
      category: parsed.category ?? null,
      accountId: parsed.accountId ?? null,
      fromAccountId: parsed.fromAccountId ?? null,
      toAccountId: parsed.toAccountId ?? null,
    });
  } catch (e) {
    req.log.error({ err: e }, "Failed to parse natural language transaction");
    res.status(500).json({ error: "Failed to parse transaction. Please try again." });
  }
});

export default router;
