import { Router, type IRouter } from "express";
import { eq, and, ne } from "drizzle-orm";
import { db, categoriesTable, budgetGoalsTable, accountsTable, goalsTable } from "@workspace/db";
import { AiParseBody } from "@workspace/api-zod";
import { BUDGET_DEFAULTS, DEFAULT_PLANNED } from "../lib/budget-defaults";
import { getAppSettings, getCurrencySymbol } from "../lib/settings-helper";

async function validateGoalAccountBalance(
  accountId: number,
  newGoalAmount: number,
): Promise<{ valid: boolean; error?: string }> {
  const account = await db.select().from(accountsTable).where(eq(accountsTable.id, accountId));
  if (!account.length) {
    return { valid: false, error: "Funding account not found." };
  }

  const { currencyCode } = await getAppSettings();
  const cs = getCurrencySymbol(currencyCode);
  const accountBalance = Number(account[0].currentBalance ?? 0);

  const existingGoals = await db
    .select({ currentAmount: goalsTable.currentAmount })
    .from(goalsTable)
    .where(
      and(eq(goalsTable.accountId, accountId), ne(goalsTable.status, "Achieved")),
    );

  const existingTotal = existingGoals.reduce((sum, g) => sum + Number(g.currentAmount ?? 0), 0);
  const totalRequired = existingTotal + newGoalAmount;

  if (totalRequired > accountBalance) {
    const shortfall = totalRequired - accountBalance;
    return {
      valid: false,
      error: `Insufficient account balance. Account "${account[0].name}" has ${cs}${accountBalance.toFixed(2)} but goals would require ${cs}${totalRequired.toFixed(2)} (shortfall: ${cs}${shortfall.toFixed(2)}).`,
    };
  }

  return { valid: true };
}

const VALID_ACCOUNT_TYPES = ["bank", "credit_card", "loan"];
const ACCOUNT_TYPE_ALIASES: Record<string, string> = {
  savings: "bank",
  current: "bank",
  cash: "bank",
  wallet: "bank",
  bank: "bank",
  credit_card: "credit_card",
  loan: "loan",
};
const VALID_GOAL_CATEGORIES = ["Emergency", "Debt", "Travel", "Purchase", "General"];

function validateAddCategory(parsed: Record<string, unknown>) {
  const categoryName = typeof parsed.categoryName === "string" && parsed.categoryName.trim() ? parsed.categoryName.trim() : null;
  if (!categoryName) return null;
  const categoryType = parsed.categoryType === "Income" ? "Income" as const : "Expense" as const;
  return { categoryName, categoryType };
}

function validateAddAccount(parsed: Record<string, unknown>) {
  const accountName = typeof parsed.accountName === "string" && parsed.accountName.trim() ? parsed.accountName.trim() : null;
  if (!accountName) return null;
  const rawType = typeof parsed.accountType === "string" ? parsed.accountType : "bank";
  const accountType = ACCOUNT_TYPE_ALIASES[rawType] || "bank";
  const rawDay = typeof parsed.billingDueDay === "number" ? parsed.billingDueDay : null;
  const billingDueDay = rawDay !== null && Number.isInteger(rawDay) && rawDay >= 1 && rawDay <= 31 ? rawDay : null;
  return { accountName, accountType, billingDueDay };
}

function validateSetBudget(parsed: Record<string, unknown>) {
  const categoryName = typeof parsed.categoryName === "string" && parsed.categoryName.trim() ? parsed.categoryName.trim() : null;
  if (!categoryName) return null;
  const rawAmount = parsed.plannedAmount;
  const plannedAmount = typeof rawAmount === "number" ? String(rawAmount) : typeof rawAmount === "string" && rawAmount.trim() ? rawAmount.trim() : null;
  if (!plannedAmount || isNaN(Number(plannedAmount)) || Number(plannedAmount) <= 0) return null;
  return { categoryName, plannedAmount };
}

function validateAddSavingsGoal(parsed: Record<string, unknown>) {
  const goalName = typeof parsed.goalName === "string" && parsed.goalName.trim() ? parsed.goalName.trim() : null;
  if (!goalName) return null;
  const rawAmount = parsed.targetAmount;
  const targetAmount = typeof rawAmount === "number" ? String(rawAmount) : typeof rawAmount === "string" && rawAmount.trim() ? rawAmount.trim() : null;
  if (!targetAmount || isNaN(Number(targetAmount)) || Number(targetAmount) <= 0) return null;
  const targetDate = typeof parsed.targetDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.targetDate) ? parsed.targetDate : null;
  const categoryType = typeof parsed.categoryType === "string" && VALID_GOAL_CATEGORIES.includes(parsed.categoryType) ? parsed.categoryType : "General";
  return { goalName, targetAmount, targetDate, categoryType };
}

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

const CATEGORY_ICONS: Record<string, string> = {
  Emergency: "🛡️",
  Debt: "💳",
  Travel: "✈️",
  Purchase: "🛍️",
  General: "🎯",
};

const router: IRouter = Router();

router.post("/ai/parse", async (req, res) => {
  try {
    const data = AiParseBody.parse(req.body);
    const { text, categories: userCategories, accounts: userAccounts } = data;
    const { currencyCode } = await getAppSettings();
    const cs = getCurrencySymbol(currencyCode);

    const categoryList = userCategories.length > 0
      ? userCategories.map((c: { id: number; name: string; type: string }) => `${c.name} (id: ${c.id}, type: ${c.type})`).join(", ")
      : "None";

    const accountList = userAccounts.length > 0
      ? userAccounts.map((a: { id: number; name: string; type: string }) => `${a.name} (id: ${a.id}, type: ${a.type})`).join(", ")
      : "None";

    const today = new Date().toISOString().split("T")[0];
    const dayOfWeek = new Date().toLocaleDateString("en-US", { weekday: "long" });

    const systemPrompt = `You are a financial assistant that understands natural language commands. Identify the user's intent and extract structured data.

Today is ${dayOfWeek}, ${today}.

The user's available categories are: ${categoryList}
The user's available accounts are: ${accountList}

Supported intents:
1. "add_transaction" — logging an expense or income (e.g. "Spent 450 at Starbucks", "Got paid 50000 salary")
2. "transfer" — moving money between accounts (e.g. "Transfer 5000 from SBI to HDFC")
3. "add_category" — creating a new category (e.g. "Create a new category called Subscriptions", "Add an income category named Freelance")
4. "add_account" — creating a new account (e.g. "Add a credit card called Amex Gold with due date on the 15th", "Add a savings account called Emergency Fund")
5. "set_budget" — setting or updating a budget for a category (e.g. "Set my Food budget to 500", "Change Transportation budget to 3000")
6. "add_savings_goal" — creating a savings goal (e.g. "I want to save 50000 for a vacation by December", "Create a goal to save 100000 for a car")

Rules:
- Determine the intent first, then extract intent-specific fields.
- For add_transaction: extract transactionType ("Income" or "Expense"), amount, date, description, category (exact name from list), accountId.
- For transfer: extract amount, date, description, fromAccountId, toAccountId.
- For add_category: extract categoryName and categoryType ("Income" or "Expense"). Default to "Expense" if not specified.
- For add_account: extract accountName, accountType ("bank", "credit_card", "loan"), billingDueDay (1-31, for credit cards). Default to "bank" if not specified. Map savings accounts, current accounts, cash, and wallets to "bank".
- For set_budget: extract categoryName (must match an existing category from the list), plannedAmount.
- For add_savings_goal: extract goalName, targetAmount, targetDate (YYYY-MM-DD or null), categoryType ("Emergency", "Debt", "Travel", "Purchase", or "General"). Default categoryType to "General".
- Resolve relative dates: "today" = ${today}, "yesterday" = one day before today, "last Friday" = the most recent past Friday, "by December" = last day of December this year.
- Match category and account names against the provided lists. Use exact names.
- Amount should be a string number without currency symbols.
- If you cannot confidently determine a field, set it to null.

Respond with ONLY a valid JSON object (no markdown, no explanation):

For add_transaction:
{ "intent": "add_transaction", "transactionType": "Income"|"Expense", "amount": "string or null", "date": "YYYY-MM-DD or null", "description": "string or null", "category": "exact category name or null", "accountId": number or null }

For transfer:
{ "intent": "transfer", "amount": "string or null", "date": "YYYY-MM-DD or null", "description": "string or null", "fromAccountId": number or null, "toAccountId": number or null }

For add_category:
{ "intent": "add_category", "categoryName": "string", "categoryType": "Income"|"Expense" }

For add_account:
{ "intent": "add_account", "accountName": "string", "accountType": "bank"|"credit_card"|"loan", "billingDueDay": number or null }

For set_budget:
{ "intent": "set_budget", "categoryName": "exact category name", "categoryId": number or null, "plannedAmount": "string number" }

For add_savings_goal:
{ "intent": "add_savings_goal", "goalName": "string", "targetAmount": "string number", "targetDate": "YYYY-MM-DD or null", "categoryType": "Emergency"|"Debt"|"Travel"|"Purchase"|"General" }`;

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

    const intent = parsed.intent;

    const makeResponse = (fields: Record<string, unknown>) => ({
      intent: fields.intent,
      transactionType: fields.transactionType ?? null,
      amount: fields.amount ?? null,
      date: fields.date ?? null,
      description: fields.description ?? null,
      category: fields.category ?? null,
      accountId: fields.accountId ?? null,
      fromAccountId: fields.fromAccountId ?? null,
      toAccountId: fields.toAccountId ?? null,
      message: fields.message ?? null,
      createdEntityId: fields.createdEntityId ?? null,
      createdEntityName: fields.createdEntityName ?? null,
    });

    if (intent === "add_transaction") {
      const txType = parsed.transactionType;
      const validTxType = txType === "Income" || txType === "Expense" ? txType : null;
      res.json(makeResponse({
        intent: "add_transaction",
        transactionType: validTxType,
        amount: typeof parsed.amount === "string" ? parsed.amount : null,
        date: typeof parsed.date === "string" ? parsed.date : null,
        description: typeof parsed.description === "string" ? parsed.description : null,
        category: typeof parsed.category === "string" ? parsed.category : null,
        accountId: typeof parsed.accountId === "number" ? parsed.accountId : null,
      }));
      return;
    }

    if (intent === "transfer") {
      res.json(makeResponse({
        intent: "transfer",
        transactionType: "Transfer",
        amount: typeof parsed.amount === "string" ? parsed.amount : null,
        date: typeof parsed.date === "string" ? parsed.date : null,
        description: typeof parsed.description === "string" ? parsed.description : null,
        fromAccountId: typeof parsed.fromAccountId === "number" ? parsed.fromAccountId : null,
        toAccountId: typeof parsed.toAccountId === "number" ? parsed.toAccountId : null,
      }));
      return;
    }

    if (intent === "add_category") {
      const validated = validateAddCategory(parsed);
      if (!validated) {
        res.status(400).json({ error: "Could not determine category details. Please try rephrasing." });
        return;
      }
      const { categoryName, categoryType } = validated;

      const [created] = await db
        .insert(categoriesTable)
        .values({ name: categoryName, type: categoryType })
        .returning();

      if (categoryType === "Expense") {
        const plannedAmount = BUDGET_DEFAULTS[categoryName] ?? DEFAULT_PLANNED;
        const existing = await db
          .select()
          .from(budgetGoalsTable)
          .where(eq(budgetGoalsTable.categoryId, created.id));
        if (existing.length === 0) {
          await db.insert(budgetGoalsTable).values({
            categoryId: created.id,
            plannedAmount: plannedAmount.toFixed(2),
          });
        }
      }

      res.json(makeResponse({
        intent: "add_category",
        message: `Created ${categoryType.toLowerCase()} category "${categoryName}"`,
        createdEntityId: created.id,
        createdEntityName: categoryName,
      }));
      return;
    }

    if (intent === "add_account") {
      const validated = validateAddAccount(parsed);
      if (!validated) {
        res.status(400).json({ error: "Could not determine account details. Please try rephrasing." });
        return;
      }
      const { accountName, accountType, billingDueDay } = validated;

      const [created] = await db
        .insert(accountsTable)
        .values({
          name: accountName,
          type: accountType,
          currentBalance: "0",
          creditLimit: null,
          billingDueDay: accountType === "credit_card" ? (billingDueDay ?? null) : null,
          emiAmount: null,
          emiDay: null,
          loanTenure: null,
          interestRate: null,
          linkedAccountId: null,
          useInSurplus: false,
          sharedLimitGroup: null,
        })
        .returning();

      res.json(makeResponse({
        intent: "add_account",
        message: `Created ${accountType.replace("_", " ")} account "${accountName}"`,
        createdEntityId: created.id,
        createdEntityName: accountName,
      }));
      return;
    }

    if (intent === "set_budget") {
      const validated = validateSetBudget(parsed);
      if (!validated) {
        res.status(400).json({ error: "Could not determine budget details. Please try rephrasing." });
        return;
      }
      const { categoryName, plannedAmount } = validated;

      const [found] = await db
        .select()
        .from(categoriesTable)
        .where(eq(categoriesTable.name, categoryName));
      if (!found) {
        res.status(400).json({ error: `Category "${categoryName}" not found. Please create it first.` });
        return;
      }
      const categoryId = found.id;

      const existing = await db
        .select()
        .from(budgetGoalsTable)
        .where(eq(budgetGoalsTable.categoryId, categoryId));

      let result;
      if (existing.length > 0) {
        [result] = await db
          .update(budgetGoalsTable)
          .set({ plannedAmount })
          .where(eq(budgetGoalsTable.categoryId, categoryId))
          .returning();
      } else {
        [result] = await db.insert(budgetGoalsTable).values({
          categoryId,
          plannedAmount,
        }).returning();
      }

      res.json(makeResponse({
        intent: "set_budget",
        amount: plannedAmount,
        category: categoryName,
        message: `Set budget for "${categoryName}" to ${cs}${Number(plannedAmount).toLocaleString()}`,
        createdEntityId: result.id,
        createdEntityName: categoryName,
      }));
      return;
    }

    if (intent === "add_savings_goal") {
      const validated = validateAddSavingsGoal(parsed);
      if (!validated) {
        res.status(400).json({ error: "Could not determine savings goal details. Please try rephrasing." });
        return;
      }
      const { goalName, targetAmount, targetDate, categoryType } = validated;

      const allAccounts = await db.select().from(accountsTable);
      const bankAccount = allAccounts.find((a) => a.type === "bank") ?? allAccounts[0];
      if (!bankAccount) {
        res.status(400).json({ error: "No accounts found. Please create an account first before setting a savings goal." });
        return;
      }

      const validation = await validateGoalAccountBalance(bankAccount.id, 0);
      if (!validation.valid) {
        res.status(400).json({ error: validation.error });
        return;
      }

      const icon = CATEGORY_ICONS[categoryType] || "🎯";

      const [created] = await db.insert(goalsTable).values({
        name: goalName,
        targetAmount,
        currentAmount: "0",
        accountId: bankAccount.id,
        targetDate: targetDate ?? null,
        categoryType,
        icon,
        status: "Active",
      }).returning();

      res.json(makeResponse({
        intent: "add_savings_goal",
        amount: targetAmount,
        date: targetDate,
        message: `Created savings goal "${goalName}" for ${cs}${Number(targetAmount).toLocaleString()}${targetDate ? ` by ${targetDate}` : ""}`,
        createdEntityId: created.id,
        createdEntityName: goalName,
      }));
      return;
    }

    res.status(400).json({ error: "Could not determine what you want to do. Please try rephrasing." });
  } catch (e) {
    req.log.error({ err: e }, "Failed to parse AI input");
    res.status(500).json({ error: "Failed to process your request. Please try again." });
  }
});

export default router;
