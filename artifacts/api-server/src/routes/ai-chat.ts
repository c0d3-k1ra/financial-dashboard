import { Router, type IRouter } from "express";
import { eq, desc, sql, and, ilike, gte, lte } from "drizzle-orm";
import {
  db,
  transactionsTable,
  merchantMappingsTable,
  categoriesTable,
  budgetGoalsTable,
  appSettingsTable,
  accountsTable,
} from "@workspace/db";
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

interface MerchantMapping {
  category: string;
  accountId: number | null;
  useCount: number;
}

function canonicalizeKeyword(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

async function getMerchantMapping(description: string): Promise<MerchantMapping | null> {
  if (!description) return null;
  const keyword = canonicalizeKeyword(description);
  if (!keyword) return null;

  const rows = await db
    .select()
    .from(merchantMappingsTable)
    .where(ilike(merchantMappingsTable.keyword, keyword))
    .orderBy(desc(merchantMappingsTable.useCount))
    .limit(1);

  if (rows.length > 0 && rows[0].useCount >= 3) {
    return {
      category: rows[0].category,
      accountId: rows[0].accountId,
      useCount: rows[0].useCount,
    };
  }
  return null;
}

async function getMerchantMappingCategories(description: string): Promise<{ category: string; count: number }[]> {
  if (!description) return [];
  const keyword = canonicalizeKeyword(description);
  if (!keyword) return [];

  const rows = await db
    .select({
      category: merchantMappingsTable.category,
      useCount: merchantMappingsTable.useCount,
    })
    .from(merchantMappingsTable)
    .where(ilike(merchantMappingsTable.keyword, keyword))
    .orderBy(desc(merchantMappingsTable.useCount));

  return rows.map(r => ({ category: r.category, count: r.useCount }));
}

async function upsertMerchantMapping(description: string, category: string, accountId: number | null) {
  if (!description || !category || category === "Transfer") return;
  const keyword = canonicalizeKeyword(description);
  if (!keyword) return;

  const existing = await db
    .select()
    .from(merchantMappingsTable)
    .where(and(
      ilike(merchantMappingsTable.keyword, keyword),
      eq(merchantMappingsTable.category, category),
    ))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(merchantMappingsTable)
      .set({
        useCount: sql`${merchantMappingsTable.useCount} + 1`,
        lastUsedAt: new Date(),
        accountId: accountId ?? existing[0].accountId,
      })
      .where(eq(merchantMappingsTable.id, existing[0].id));
  } else {
    await db.insert(merchantMappingsTable).values({
      keyword,
      category,
      accountId,
      useCount: 1,
      lastUsedAt: new Date(),
    });
  }
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

interface SpendingAnomaly {
  type: "category" | "merchant";
  currentAmount: number;
  averageAmount: number;
  ratio: number;
  typicalAmount?: number;
}

async function detectSpendingAnomaly(
  amount: number,
  category: string,
  description: string,
): Promise<SpendingAnomaly | null> {
  if (!amount || amount <= 0) return null;

  if (description) {
    const merchantRows = await db
      .select({ amount: transactionsTable.amount })
      .from(transactionsTable)
      .where(and(
        ilike(transactionsTable.description, `%${description}%`),
        sql`${transactionsTable.type} != 'Transfer'`,
      ))
      .orderBy(desc(transactionsTable.createdAt))
      .limit(20);

    if (merchantRows.length >= 3) {
      const merchantAmounts = merchantRows.map(r => Number(r.amount));
      const merchantAvg = merchantAmounts.reduce((s, a) => s + a, 0) / merchantAmounts.length;
      if (merchantAvg > 0 && amount >= merchantAvg * 3) {
        return {
          type: "merchant",
          currentAmount: amount,
          averageAmount: Math.round(merchantAvg),
          ratio: Math.round(amount / merchantAvg * 10) / 10,
          typicalAmount: Math.round(merchantAvg),
        };
      }
    }
  }

  if (category && category !== "Transfer") {
    const catRows = await db
      .select({ amount: transactionsTable.amount })
      .from(transactionsTable)
      .where(and(
        eq(transactionsTable.category, category),
        sql`${transactionsTable.type} != 'Transfer'`,
      ))
      .orderBy(desc(transactionsTable.createdAt))
      .limit(30);

    if (catRows.length >= 3) {
      const catAmounts = catRows.map(r => Number(r.amount));
      const catAvg = catAmounts.reduce((s, a) => s + a, 0) / catAmounts.length;
      if (catAvg > 0 && amount >= catAvg * 3) {
        return {
          type: "category",
          currentAmount: amount,
          averageAmount: Math.round(catAvg),
          ratio: Math.round(amount / catAvg * 10) / 10,
        };
      }
    }
  }

  return null;
}

interface BudgetWarning {
  categoryName: string;
  budgetAmount: number;
  spentSoFar: number;
  afterTransaction: number;
  isOverBudget: boolean;
}

async function checkBudgetWarning(
  category: string,
  amount: number,
  userCategories: { name: string; type: string }[],
): Promise<BudgetWarning | null> {
  if (!category || category === "Transfer" || !amount || amount <= 0) return null;

  const catInfo = userCategories.find(c => c.name === category);
  if (!catInfo || catInfo.type !== "Expense") return null;

  const [catRow] = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.name, category))
    .limit(1);

  if (!catRow) return null;

  const [budgetRow] = await db
    .select()
    .from(budgetGoalsTable)
    .where(eq(budgetGoalsTable.categoryId, catRow.id))
    .limit(1);

  if (!budgetRow || Number(budgetRow.plannedAmount) <= 0) return null;

  const budgetAmount = Number(budgetRow.plannedAmount);

  const [settings] = await db.select().from(appSettingsTable).limit(1);
  const billingDay = settings?.billingCycleDay ?? 25;

  const now = new Date();
  let cycleStart: Date;
  let cycleEnd: Date;

  if (now.getDate() >= billingDay) {
    cycleStart = new Date(now.getFullYear(), now.getMonth(), billingDay);
    cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, billingDay - 1);
  } else {
    cycleStart = new Date(now.getFullYear(), now.getMonth() - 1, billingDay);
    cycleEnd = new Date(now.getFullYear(), now.getMonth(), billingDay - 1);
  }

  const startStr = cycleStart.toISOString().split("T")[0];
  const endStr = cycleEnd.toISOString().split("T")[0];

  const [spentRow] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${transactionsTable.amount}), '0')`.as("total"),
    })
    .from(transactionsTable)
    .where(and(
      eq(transactionsTable.category, category),
      sql`${transactionsTable.type} = 'Expense'`,
      gte(transactionsTable.date, startStr),
      lte(transactionsTable.date, endStr),
    ));

  const spentSoFar = Number(spentRow?.total ?? 0);
  const afterTransaction = spentSoFar + amount;

  if (afterTransaction > budgetAmount) {
    return {
      categoryName: category,
      budgetAmount,
      spentSoFar: Math.round(spentSoFar),
      afterTransaction: Math.round(afterTransaction),
      isOverBudget: spentSoFar >= budgetAmount,
    };
  }

  return null;
}

interface DuplicateWarning {
  existingId: number;
  existingDate: string;
  existingDescription: string;
  existingAmount: string;
}

async function detectDuplicate(
  amount: number,
  category: string,
  description: string,
  date: string,
): Promise<DuplicateWarning | null> {
  if (!amount || amount <= 0 || !date) return null;

  const txDate = new Date(date);
  if (isNaN(txDate.getTime())) return null;

  const dayBefore = new Date(txDate);
  dayBefore.setDate(dayBefore.getDate() - 1);
  const dayAfter = new Date(txDate);
  dayAfter.setDate(dayAfter.getDate() + 1);

  const beforeStr = dayBefore.toISOString().split("T")[0];
  const afterStr = dayAfter.toISOString().split("T")[0];

  const amountStr = amount.toFixed(2);

  const conditions = [
    eq(transactionsTable.amount, amountStr),
    gte(transactionsTable.date, beforeStr),
    lte(transactionsTable.date, afterStr),
  ];

  if (description) {
    conditions.push(ilike(transactionsTable.description, `%${description}%`));
  } else if (category) {
    conditions.push(eq(transactionsTable.category, category));
  } else {
    return null;
  }

  const matches = await db
    .select()
    .from(transactionsTable)
    .where(and(...conditions))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(1);

  if (matches.length > 0) {
    return {
      existingId: matches[0].id,
      existingDate: matches[0].date,
      existingDescription: matches[0].description,
      existingAmount: matches[0].amount,
    };
  }

  return null;
}

async function checkAmbiguousMerchant(
  description: string,
): Promise<{ ambiguous: boolean; categories: { name: string; count: number }[] }> {
  if (!description) return { ambiguous: false, categories: [] };

  const mappings = await getMerchantMappingCategories(description);

  if (mappings.length <= 1) {
    const rows = await db
      .select({
        category: transactionsTable.category,
        cnt: sql<number>`count(*)`.as("cnt"),
      })
      .from(transactionsTable)
      .where(and(
        ilike(transactionsTable.description, `%${description}%`),
        sql`${transactionsTable.type} != 'Transfer'`,
      ))
      .groupBy(transactionsTable.category)
      .orderBy(sql`count(*) DESC`)
      .limit(10);

    if (rows.length < 2) return { ambiguous: false, categories: [] };

    const total = rows.reduce((s, r) => s + Number(r.cnt), 0);
    const topPct = Number(rows[0].cnt) / total;

    if (topPct >= 0.8) return { ambiguous: false, categories: [] };

    return {
      ambiguous: true,
      categories: rows.map(r => ({ name: r.category, count: Number(r.cnt) })),
    };
  }

  const total = mappings.reduce((s, m) => s + m.count, 0);
  const topPct = mappings[0].count / total;

  if (topPct >= 0.8) return { ambiguous: false, categories: [] };

  return {
    ambiguous: true,
    categories: mappings,
  };
}

interface RecurringPattern {
  description: string;
  amount: string;
  category: string;
  accountId: number | null;
  transactionType: string;
}

async function detectRecurringPattern(
  description: string,
  amount?: number,
): Promise<RecurringPattern | null> {
  if (!description) return null;

  const rows = await db
    .select()
    .from(transactionsTable)
    .where(and(
      ilike(transactionsTable.description, `%${description}%`),
      sql`${transactionsTable.type} != 'Transfer'`,
    ))
    .orderBy(desc(transactionsTable.date))
    .limit(12);

  if (rows.length < 3) return null;

  const sorted = [...rows].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const baseAmount = Number(sorted[sorted.length - 1].amount);
  const baseCategory = sorted[sorted.length - 1].category;
  const baseAccountId = sorted[sorted.length - 1].accountId;
  const baseType = sorted[sorted.length - 1].type;

  const matching = sorted.filter(r => {
    const amt = Number(r.amount);
    const amtDiff = Math.abs(amt - baseAmount) / baseAmount;
    return amtDiff <= 0.05 && r.category === baseCategory && r.accountId === baseAccountId;
  });

  if (matching.length < 3) return null;

  let consecutiveMonths = 1;
  for (let i = 1; i < matching.length; i++) {
    const prev = new Date(matching[i - 1].date);
    const curr = new Date(matching[i].date);
    const daysDiff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff >= 25 && daysDiff <= 38) {
      consecutiveMonths++;
    }
  }

  if (consecutiveMonths >= 3) {
    return {
      description: sorted[sorted.length - 1].description,
      amount: amount ? String(amount) : sorted[sorted.length - 1].amount,
      category: baseCategory,
      accountId: baseAccountId,
      transactionType: baseType,
    };
  }

  return null;
}

function findClosestCategories(name: string, categories: { name: string; type: string }[]): string[] {
  const lower = name.toLowerCase();
  const scored = categories.map(c => {
    const cLower = c.name.toLowerCase();
    let score = 0;
    if (cLower.includes(lower) || lower.includes(cLower)) score += 10;
    const words = lower.split(/\s+/);
    for (const w of words) {
      if (cLower.includes(w)) score += 3;
    }
    if (c.type === "Expense") score += 1;
    return { name: c.name, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(s => s.name);
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
              // ignore
            }
          }
          res.json({
            reply: `Created category "${newCatName}". ${pendingTx ? "Here's your updated transaction:" : "You can now use this category."}`,
            type: pendingTx ? "confirmation" : "question",
            transaction: pendingTx ?? undefined,
          });
          return;
        } catch (e) {
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

    let merchantDefaults: MerchantDefaults = { dominantAccount: null, dominantCategory: null };
    let recentAccounts: { id: number; count: number }[] = [];
    let recentCategories: { name: string; count: number }[] = [];
    let merchantMapping: MerchantMapping | null = null;

    try {
      const words = lastUserMsg.content.split(/\s+/).filter((w: string) => w.length > 2 && !/^\d+$/.test(w));
      const possibleMerchant = words.slice(-3).join(" ");
      [merchantDefaults, recentAccounts, recentCategories, merchantMapping] = await Promise.all([
        getMerchantDefaults(possibleMerchant),
        getRecentAccountUsage(),
        getRecentCategoryUsage(),
        getMerchantMapping(possibleMerchant),
      ]);
    } catch (e) {
      req.log.warn({ err: e }, "Failed to fetch transaction history defaults");
    }

    if (merchantMapping) {
      merchantDefaults.dominantCategory = merchantMapping.category;
      if (merchantMapping.accountId) {
        merchantDefaults.dominantAccount = { id: merchantMapping.accountId, name: "" };
      }
    }

    let recurringPattern: RecurringPattern | null = null;
    try {
      const words = lastUserMsg.content.split(/\s+/).filter((w: string) => w.length > 2 && !/^\d+$/.test(w));
      const possibleMerchant = words.slice(-3).join(" ");
      const amountMatch = lastUserMsg.content.match(/[\d,]+\.?\d*/);
      const possibleAmount = amountMatch ? Number(amountMatch[0].replace(/,/g, "")) : undefined;
      recurringPattern = await detectRecurringPattern(possibleMerchant, possibleAmount);
    } catch {
      // ignore
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
    if (recurringPattern) {
      historyContext.push(`RECURRING PATTERN DETECTED: This looks like a recurring transaction. Pre-fill: description="${recurringPattern.description}", amount=${recurringPattern.amount}, category="${recurringPattern.category}", accountId=${recurringPattern.accountId}, type=${recurringPattern.transactionType}. Go straight to confirmation unless user specified different values.`);
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
- IMPORTANT: For category, you MUST use EXACTLY one of the available categories listed above. If no category matches, use the closest available one and set it exactly as listed. Never invent category names that aren't in the available list.
- IMPORTANT: For accountId, you MUST use one of the available account IDs listed above. Never use an ID that isn't in the list.

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

    const responsePayload: Record<string, unknown> = {
      reply: parsed.reply ?? "I couldn't understand that.",
      type: parsed.type ?? "error",
      options: parsed.options ?? undefined,
      transaction: parsed.transaction ?? undefined,
    };

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

      const categoryExists = userCategories.some(c => c.name === tx.category);
      if (tx.category && !categoryExists && tx.category !== "Transfer") {
        const closest = findClosestCategories(tx.category, userCategories);
        const options = closest.map(c => ({ label: c, value: c }));
        options.push({ label: `+ Create "${tx.category}"`, value: `__create_category__:${tx.category}` });

        responsePayload.type = "question";
        responsePayload.reply = `I don't see a category called "${tx.category}". Which would you like to use?`;
        responsePayload.options = options;
        responsePayload.transaction = tx;

        res.json(responsePayload);
        return;
      }

      const accountExists = tx.accountId ? userAccounts.some(a => a.id === tx.accountId) : true;
      if (!accountExists) {
        const options = userAccounts.slice(0, 5).map(a => ({ label: a.name, value: String(a.id) }));
        options.push({ label: `+ Add new account`, value: `__create_account__` });

        responsePayload.type = "question";
        responsePayload.reply = `I couldn't find the account you mentioned. Which account should I use?`;
        responsePayload.options = options;
        responsePayload.transaction = tx;

        res.json(responsePayload);
        return;
      }

      if (tx.description && tx.category !== "Transfer") {
        const ambiguity = await checkAmbiguousMerchant(tx.description);
        if (ambiguity.ambiguous) {
          const matchesExisting = ambiguity.categories.some(c => c.name === tx.category);
          if (!matchesExisting || ambiguity.categories[0].name !== tx.category) {
            const options = ambiguity.categories.slice(0, 5).map(c => ({
              label: `${c.name} (${c.count}x)`,
              value: c.name,
            }));

            responsePayload.type = "question";
            responsePayload.reply = `"${tx.description}" has been categorized differently in the past. Which category fits best?`;
            responsePayload.options = options;
            responsePayload.transaction = tx;

            res.json(responsePayload);
            return;
          }
        }
      }

      const warnings: Record<string, unknown>[] = [];

      try {
        const amount = Number(tx.amount);
        const anomaly = await detectSpendingAnomaly(amount, tx.category, tx.description);
        if (anomaly) {
          warnings.push({
            type: "anomaly",
            anomalyType: anomaly.type,
            currentAmount: anomaly.currentAmount,
            averageAmount: anomaly.averageAmount,
            ratio: anomaly.ratio,
            typicalAmount: anomaly.typicalAmount,
          });
        }
      } catch {
        // ignore
      }

      try {
        const amount = Number(tx.amount);
        const budgetWarning = await checkBudgetWarning(tx.category, amount, userCategories);
        if (budgetWarning) {
          warnings.push({
            type: "budget",
            categoryName: budgetWarning.categoryName,
            budgetAmount: budgetWarning.budgetAmount,
            spentSoFar: budgetWarning.spentSoFar,
            afterTransaction: budgetWarning.afterTransaction,
            isOverBudget: budgetWarning.isOverBudget,
          });
        }
      } catch {
        // ignore
      }

      try {
        const amount = Number(tx.amount);
        const duplicate = await detectDuplicate(amount, tx.category, tx.description, tx.date);
        if (duplicate) {
          warnings.push({
            type: "duplicate",
            existingId: duplicate.existingId,
            existingDate: duplicate.existingDate,
            existingDescription: duplicate.existingDescription,
            existingAmount: duplicate.existingAmount,
          });
        }
      } catch {
        // ignore
      }

      if (warnings.length > 0) {
        responsePayload.warnings = warnings;
      }

      responsePayload.transaction = tx;
    }

    res.json(responsePayload);
  } catch (e) {
    req.log.error({ err: e }, "Failed to process AI chat");
    res.status(500).json({ error: "Failed to process your message. Please try again." });
  }
});

router.post("/ai/chat/confirm", async (req, res) => {
  try {
    const body = z.object({
      description: z.string().optional(),
      category: z.string().optional(),
      accountId: z.number().nullable().optional(),
    }).parse(req.body);

    if (body.description && body.category) {
      await upsertMerchantMapping(body.description, body.category, body.accountId ?? null);
    }

    res.json({ ok: true });
  } catch (e) {
    req.log.error({ err: e }, "Failed to confirm merchant mapping");
    res.status(400).json({ error: "Invalid request" });
  }
});

export default router;
