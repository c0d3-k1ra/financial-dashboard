import { describe, it, expect } from "vitest";
import { db, mockChain } from "../test/db-mock";
import {
  canonicalizeKeyword,
  findClosestCategories,
  getMerchantMapping,
  getMerchantDefaults,
  upsertMerchantMapping,
  getCategoryDominantAccount,
  getRecentAccountUsage,
  getRecentCategoryUsage,
  checkAmbiguousMerchant,
  getMerchantMappingCategories,
} from "../routes/helpers/merchant-mapping";
import { detectQueryIntent } from "../routes/helpers/query-handler";
import { buildSystemPrompt, buildHistoryContext, fetchMerchantContext } from "../routes/helpers/chat-prompt";
import { parseAiResponse, validateAndEnrichConfirmation } from "../routes/helpers/chat-confirmation";
import { detectRecurringPattern } from "../routes/helpers/recurring-patterns";
import { detectSpendingAnomaly, checkBudgetWarning, detectDuplicate } from "../routes/helpers/anomaly-detection";

describe("canonicalizeKeyword", () => {
  it("lowercases and trims", () => {
    expect(canonicalizeKeyword("  Starbucks  ")).toBe("starbucks");
  });
  it("collapses spaces", () => {
    expect(canonicalizeKeyword("Big  Bazaar")).toBe("big bazaar");
  });
});

describe("findClosestCategories", () => {
  const categories = [
    { name: "Food", type: "Expense" },
    { name: "Transport", type: "Expense" },
    { name: "Salary", type: "Income" },
    { name: "Groceries", type: "Expense" },
  ];
  it("finds partial match", () => {
    const result = findClosestCategories("foo", categories);
    expect(result).toContain("Food");
  });
  it("returns max 3", () => {
    const result = findClosestCategories("a", categories);
    expect(result.length).toBeLessThanOrEqual(3);
  });
  it("returns empty for no match", () => {
    const incomeOnly = [{ name: "Salary", type: "Income" }];
    const result = findClosestCategories("zzzzz", incomeOnly);
    expect(result).toHaveLength(0);
  });
});

describe("getMerchantMapping", () => {
  it("returns null for empty description", async () => {
    expect(await getMerchantMapping("")).toBeNull();
  });
  it("returns null when no rows", async () => {
    expect(await getMerchantMapping("Starbucks")).toBeNull();
  });
  it("returns mapping when useCount >= 3", async () => {
    db.select.mockReturnValueOnce(
      mockChain([{ keyword: "starbucks", category: "Food", accountId: 1, useCount: 5 }])
    );
    const result = await getMerchantMapping("Starbucks");
    expect(result).toEqual({ category: "Food", accountId: 1, useCount: 5 });
  });
  it("returns null when useCount < 3", async () => {
    db.select.mockReturnValueOnce(
      mockChain([{ keyword: "starbucks", category: "Food", accountId: 1, useCount: 2 }])
    );
    expect(await getMerchantMapping("Starbucks")).toBeNull();
  });
});

describe("getMerchantMappingCategories", () => {
  it("returns empty for empty description", async () => {
    expect(await getMerchantMappingCategories("")).toEqual([]);
  });
  it("returns categories", async () => {
    db.select.mockReturnValueOnce(
      mockChain([{ category: "Food", useCount: 5 }, { category: "Drinks", useCount: 3 }])
    );
    const result = await getMerchantMappingCategories("Starbucks");
    expect(result).toHaveLength(2);
  });
});

describe("getMerchantDefaults", () => {
  it("returns defaults for empty description", async () => {
    const result = await getMerchantDefaults("");
    expect(result.dominantAccount).toBeNull();
    expect(result.dominantCategory).toBeNull();
  });
  it("returns defaults when < 3 rows", async () => {
    db.select.mockReturnValueOnce(mockChain([{ accountId: 1, category: "Food" }]));
    const result = await getMerchantDefaults("Starbucks");
    expect(result.dominantAccount).toBeNull();
  });
  it("returns dominant account and category", async () => {
    const rows = Array(5).fill(null).map(() => ({ accountId: 1, category: "Food" }));
    db.select.mockReturnValueOnce(mockChain(rows));
    const result = await getMerchantDefaults("Starbucks");
    expect(result.dominantAccount).toEqual({ id: 1, name: "" });
    expect(result.dominantCategory).toBe("Food");
  });
});

describe("upsertMerchantMapping", () => {
  it("skips empty description", async () => {
    await upsertMerchantMapping("", "Food", null);
  });
  it("skips Transfer category", async () => {
    await upsertMerchantMapping("Test", "Transfer", null);
  });
  it("updates existing mapping", async () => {
    db.select.mockReturnValueOnce(
      mockChain([{ id: 1, keyword: "starbucks", category: "Food", accountId: 1, useCount: 3 }])
    );
    await upsertMerchantMapping("Starbucks", "Food", 1);
    expect(db.update).toHaveBeenCalled();
  });
  it("inserts new mapping", async () => {
    await upsertMerchantMapping("NewPlace", "Food", 1);
    expect(db.insert).toHaveBeenCalled();
  });
});

describe("getCategoryDominantAccount", () => {
  it("returns null for empty", async () => {
    expect(await getCategoryDominantAccount("")).toBeNull();
  });
  it("returns null when < 3 rows", async () => {
    db.select.mockReturnValueOnce(mockChain([{ accountId: 1 }]));
    expect(await getCategoryDominantAccount("Food")).toBeNull();
  });
  it("returns dominant when >= 70%", async () => {
    const rows = Array(10).fill(null).map(() => ({ accountId: 1 }));
    db.select.mockReturnValueOnce(mockChain(rows));
    const result = await getCategoryDominantAccount("Food");
    expect(result).toEqual({ id: 1 });
  });
  it("returns null when not dominant", async () => {
    const rows = [
      ...Array(3).fill(null).map(() => ({ accountId: 1 })),
      ...Array(3).fill(null).map(() => ({ accountId: 2 })),
      ...Array(3).fill(null).map(() => ({ accountId: 3 })),
    ];
    db.select.mockReturnValueOnce(mockChain(rows));
    expect(await getCategoryDominantAccount("Food")).toBeNull();
  });
});

describe("getRecentAccountUsage", () => {
  it("returns empty when no data", async () => {
    const result = await getRecentAccountUsage();
    expect(result).toEqual([]);
  });
  it("returns accounts with counts", async () => {
    db.select.mockReturnValueOnce(
      mockChain([{ accountId: 1, cnt: 10 }, { accountId: 2, cnt: 5 }])
    );
    const result = await getRecentAccountUsage();
    expect(result).toHaveLength(2);
  });
});

describe("getRecentCategoryUsage", () => {
  it("returns empty when no data", async () => {
    const result = await getRecentCategoryUsage();
    expect(result).toEqual([]);
  });
  it("returns categories with counts", async () => {
    db.select.mockReturnValueOnce(
      mockChain([{ category: "Food", cnt: 10 }])
    );
    const result = await getRecentCategoryUsage();
    expect(result).toHaveLength(1);
  });
});

describe("checkAmbiguousMerchant", () => {
  it("returns not ambiguous for empty", async () => {
    const result = await checkAmbiguousMerchant("");
    expect(result.ambiguous).toBe(false);
  });
  it("returns not ambiguous when < 2 categories from history", async () => {
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ category: "Food", cnt: 5 }]));
    const result = await checkAmbiguousMerchant("Starbucks");
    expect(result.ambiguous).toBe(false);
  });
  it("returns ambiguous when multiple categories", async () => {
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([
        { category: "Food", cnt: 5 },
        { category: "Drinks", cnt: 4 },
      ]));
    const result = await checkAmbiguousMerchant("Starbucks");
    expect(result.ambiguous).toBe(true);
    expect(result.categories).toHaveLength(2);
  });
  it("returns not ambiguous when dominant at 80%", async () => {
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([
        { category: "Food", cnt: 8 },
        { category: "Drinks", cnt: 2 },
      ]));
    const result = await checkAmbiguousMerchant("Starbucks");
    expect(result.ambiguous).toBe(false);
  });
  it("returns ambiguous from merchant mappings", async () => {
    db.select
      .mockReturnValueOnce(mockChain([
        { category: "Food", useCount: 5 },
        { category: "Drinks", useCount: 4 },
      ]));
    const result = await checkAmbiguousMerchant("Starbucks");
    expect(result.ambiguous).toBe(true);
  });
  it("returns not ambiguous when mapping dominant", async () => {
    db.select
      .mockReturnValueOnce(mockChain([
        { category: "Food", useCount: 9 },
        { category: "Drinks", useCount: 1 },
      ]));
    const result = await checkAmbiguousMerchant("Starbucks");
    expect(result.ambiguous).toBe(false);
  });
});

describe("detectQueryIntent", () => {
  it("detects today spending", () => {
    expect(detectQueryIntent("How much did I spend today?")).toEqual({ type: "today_spending" });
  });
  it("detects this week spending", () => {
    expect(detectQueryIntent("What did I spend this week?")).toEqual({ type: "period_spending", period: "this_week" });
  });
  it("detects this month spending", () => {
    expect(detectQueryIntent("Show my spending this month")).toEqual({ type: "period_spending", period: "this_month" });
  });
  it("detects last month spending", () => {
    expect(detectQueryIntent("How much did I spend last month?")).toEqual({ type: "period_spending", period: "last_month" });
  });
  it("detects yesterday spending", () => {
    expect(detectQueryIntent("What did I spend yesterday?")).toEqual({ type: "period_spending", period: "yesterday" });
  });
  it("detects category spending", () => {
    const result = detectQueryIntent("How much on food?");
    expect(result?.type).toBe("category_spending");
    expect(result?.category).toBe("food");
  });
  it("detects account balance", () => {
    expect(detectQueryIntent("What's my balance?")).toEqual({ type: "account_balance" });
  });
  it("detects debt summary", () => {
    expect(detectQueryIntent("Show my credit card debt")).toEqual({ type: "debt_summary" });
  });
  it("detects recent transactions", () => {
    expect(detectQueryIntent("Show my recent transactions")).toEqual({ type: "recent_transactions", limit: 5 });
  });
  it("detects N recent transactions", () => {
    expect(detectQueryIntent("Show last 10 transactions")).toEqual({ type: "recent_transactions", limit: 10 });
  });
  it("detects biggest expense", () => {
    const result = detectQueryIntent("What is the most expensive purchase?");
    expect(result?.type).toBe("top_expenses");
  });
  it("detects monthly summary", () => {
    expect(detectQueryIntent("Show my financial summary")).toEqual({ type: "monthly_summary" });
  });
  it("returns null for transaction-like text", () => {
    expect(detectQueryIntent("Spent 500 at Starbucks")).toBeNull();
  });
  it("returns null for unknown", () => {
    expect(detectQueryIntent("hello there")).toBeNull();
  });
  it("detects spending on category with period", () => {
    const result = detectQueryIntent("How much on food this week?");
    expect(result?.type).toBe("category_spending");
    expect(result?.period).toBe("this_week");
  });
  it("detects top spending", () => {
    const result = detectQueryIntent("Show top spending");
    expect(result?.type).toBe("top_expenses");
    expect(result?.limit).toBe(5);
  });
  it("detects spending for today implicit", () => {
    expect(detectQueryIntent("How much did I spend?")).toEqual({ type: "today_spending" });
  });
  it("detects category breakdown", () => {
    expect(detectQueryIntent("Show category breakdown")).toEqual({ type: "monthly_summary" });
  });
  it("detects check balance", () => {
    expect(detectQueryIntent("Check my balance")).toEqual({ type: "account_balance" });
  });
  it("detects total debt / owe", () => {
    expect(detectQueryIntent("How much do I owe?")).toEqual({ type: "debt_summary" });
  });
  it("detects savings rate / surplus", () => {
    expect(detectQueryIntent("What is my savings rate?")).toEqual({ type: "monthly_summary" });
  });
  it("detects spending for (category) pattern", () => {
    const result = detectQueryIntent("Spending for groceries");
    expect(result?.type).toBe("category_spending");
  });
  it("detects spending on last month category", () => {
    const result = detectQueryIntent("How much on food last month?");
    expect(result?.type).toBe("category_spending");
    expect(result?.period).toBe("last_month");
  });
  it("detects spending today for category", () => {
    const result = detectQueryIntent("How much on food today?");
    expect(result?.type).toBe("category_spending");
    expect(result?.period).toBe("today");
  });
  it("detects current cycle spending", () => {
    const result = detectQueryIntent("How much did I spend in current cycle?");
    expect(result?.type).toBe("period_spending");
    expect(result?.period).toBe("this_month");
  });
});

describe("parseAiResponse", () => {
  it("parses valid JSON", () => {
    expect(parseAiResponse('{"reply":"ok"}')).toEqual({ reply: "ok" });
  });
  it("parses JSON in code fence", () => {
    expect(parseAiResponse('```json\n{"reply":"ok"}\n```')).toEqual({ reply: "ok" });
  });
  it("returns null for invalid JSON", () => {
    expect(parseAiResponse("not json")).toBeNull();
  });
  it("handles empty string", () => {
    expect(parseAiResponse("")).toBeNull();
  });
});

describe("buildSystemPrompt", () => {
  it("builds prompt with categories and accounts", () => {
    const result = buildSystemPrompt({
      userCategories: [{ name: "Food", type: "Expense" }],
      userAccounts: [{ id: 1, name: "SBI", type: "bank" }],
      historyContext: ["Merchant history suggests category: Food"],
    });
    expect(result).toContain("Food");
    expect(result).toContain("SBI");
    expect(result).toContain("Merchant history");
  });
  it("handles empty lists", () => {
    const result = buildSystemPrompt({
      userCategories: [],
      userAccounts: [],
      historyContext: [],
    });
    expect(result).toContain("None");
  });
});

describe("buildHistoryContext", () => {
  it("builds context from defaults", () => {
    const result = buildHistoryContext(
      { dominantCategory: "Food", dominantAccount: { id: 1, name: "SBI" } },
      [{ name: "Food", count: 10 }],
      [{ id: 1, count: 20 }],
      [{ id: 1, name: "SBI", type: "bank" }],
      null,
    );
    expect(result.some(s => s.includes('Merchant history suggests category: "Food"'))).toBe(true);
    expect(result.some(s => s.includes("Merchant history suggests account ID: 1"))).toBe(true);
    expect(result.some(s => s.includes("Most used categories"))).toBe(true);
    expect(result.some(s => s.includes("Most used accounts"))).toBe(true);
  });
  it("includes recurring pattern", () => {
    const result = buildHistoryContext(
      { dominantCategory: null, dominantAccount: null },
      [], [], [],
      { description: "Netflix", amount: "499", category: "Subscriptions", accountId: 1, transactionType: "Expense" },
    );
    expect(result.some(s => s.includes("RECURRING PATTERN DETECTED"))).toBe(true);
  });
  it("returns empty for no data", () => {
    const result = buildHistoryContext(
      { dominantCategory: null, dominantAccount: null },
      [], [], [], null,
    );
    expect(result).toHaveLength(0);
  });
});

describe("fetchMerchantContext", () => {
  it("fetches context for message", async () => {
    const result = await fetchMerchantContext("Spent 500 at Starbucks");
    expect(result).toHaveProperty("merchantDefaults");
    expect(result).toHaveProperty("recentAccounts");
    expect(result).toHaveProperty("recentCategories");
    expect(result).toHaveProperty("recurringPattern");
  });
});

describe("validateAndEnrichConfirmation", () => {
  it("returns null for valid tx with existing category", async () => {
    const tx = { transactionType: "Expense", amount: "500", date: "2025-03-01", description: "Test", category: "Food", accountId: 1 };
    const payload = { reply: "ok", type: "confirmation", transaction: tx };
    const result = await validateAndEnrichConfirmation(
      tx, payload,
      [{ name: "Food", type: "Expense" }],
      [{ id: 1, name: "SBI", type: "bank" }],
      { dominantAccount: null, dominantCategory: null },
      [],
    );
    expect(result).toBeNull();
  });

  it("returns question when category not found", async () => {
    const tx = { transactionType: "Expense", amount: "500", category: "NonExistent", accountId: 1 };
    const payload = { reply: "ok", type: "confirmation" };
    const result = await validateAndEnrichConfirmation(
      tx, payload,
      [{ name: "Food", type: "Expense" }],
      [{ id: 1, name: "SBI", type: "bank" }],
      { dominantAccount: null, dominantCategory: null },
      [],
    );
    expect(result?.type).toBe("question");
    expect(result?.reply).toContain("don't see a category");
  });

  it("returns question when account not found", async () => {
    const tx = { transactionType: "Expense", amount: "500", category: "Food", accountId: 999 };
    const payload = { reply: "ok", type: "confirmation" };
    const result = await validateAndEnrichConfirmation(
      tx, payload,
      [{ name: "Food", type: "Expense" }],
      [{ id: 1, name: "SBI", type: "bank" }],
      { dominantAccount: null, dominantCategory: null },
      [],
    );
    expect(result?.type).toBe("question");
    expect(result?.reply).toContain("couldn't find the account");
  });

  it("auto-fills accountId from merchant defaults", async () => {
    const tx = { transactionType: "Expense", amount: "500", category: "Food", accountId: null as number | null };
    const payload = { reply: "ok", type: "confirmation", transaction: tx };
    const result = await validateAndEnrichConfirmation(
      tx, payload,
      [{ name: "Food", type: "Expense" }],
      [{ id: 1, name: "SBI", type: "bank" }],
      { dominantAccount: { id: 1, name: "SBI" }, dominantCategory: null },
      [],
    );
    expect(result).toBeNull();
    expect(tx.accountId).toBe(1);
  });

  it("auto-fills accountId from recent accounts", async () => {
    const tx = { transactionType: "Expense", amount: "500", category: "Food", accountId: null as number | null };
    const payload = { reply: "ok", type: "confirmation", transaction: tx };
    const result = await validateAndEnrichConfirmation(
      tx, payload,
      [{ name: "Food", type: "Expense" }],
      [{ id: 1, name: "SBI", type: "bank" }],
      { dominantAccount: null, dominantCategory: null },
      [{ id: 1, count: 10 }],
    );
    expect(result).toBeNull();
    expect(tx.accountId).toBe(1);
  });

  it("skips account fill for transfers", async () => {
    const tx = { transactionType: "Transfer", amount: "500", category: "Transfer", accountId: null as number | null, fromAccountId: 1, toAccountId: 2 };
    const payload = { reply: "ok", type: "confirmation", transaction: tx };
    const result = await validateAndEnrichConfirmation(
      tx, payload,
      [{ name: "Food", type: "Expense" }],
      [{ id: 1, name: "SBI", type: "bank" }],
      { dominantAccount: null, dominantCategory: null },
      [],
    );
    expect(result).toBeNull();
    expect(tx.accountId).toBeNull();
  });

  it("auto-fills accountId from category dominant account", async () => {
    const rows = Array(5).fill(null).map(() => ({ accountId: 1 }));
    db.select.mockReturnValueOnce(mockChain(rows));
    const tx = { transactionType: "Expense", amount: "500", category: "Food", accountId: null as number | null };
    const payload = { reply: "ok", type: "confirmation", transaction: tx };
    const result = await validateAndEnrichConfirmation(
      tx, payload,
      [{ name: "Food", type: "Expense" }],
      [{ id: 1, name: "SBI", type: "bank" }],
      { dominantAccount: null, dominantCategory: null },
      [],
    );
    expect(result).toBeNull();
    expect(tx.accountId).toBe(1);
  });

  it("handles ambiguous merchant with matching category", async () => {
    db.select.mockReturnValueOnce(mockChain([
      { category: "Food", cnt: "3" },
      { category: "Snacks", cnt: "2" },
    ]));
    const tx = { transactionType: "Expense", amount: "500", date: "2025-03-01", description: "Starbucks", category: "Snacks", accountId: 1 };
    const payload = { reply: "ok", type: "confirmation", transaction: tx };
    const result = await validateAndEnrichConfirmation(
      tx, payload,
      [{ name: "Food", type: "Expense" }, { name: "Snacks", type: "Expense" }],
      [{ id: 1, name: "SBI", type: "bank" }],
      { dominantAccount: null, dominantCategory: null },
      [],
    );
    expect(result?.type).toBe("question");
    expect(result?.reply).toContain("categorized differently");
  });

  it("collects anomaly warning when amount is high", async () => {
    const merchantHistory = Array(5).fill(null).map(() => ({ amount: "100" }));
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ category: "Food", cnt: "10" }]))
      .mockReturnValueOnce(mockChain(merchantHistory))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([]));
    const tx = { transactionType: "Expense", amount: "5000", date: "2025-03-01", description: "Starbucks", category: "Food", accountId: 1 };
    const payload = { reply: "ok", type: "confirmation", warnings: undefined as unknown } as Record<string, unknown>;
    const result = await validateAndEnrichConfirmation(
      tx, payload,
      [{ name: "Food", type: "Expense" }],
      [{ id: 1, name: "SBI", type: "bank" }],
      { dominantAccount: null, dominantCategory: null },
      [],
    );
    expect(result).toBeNull();
    expect(payload.warnings).toBeDefined();
    expect(Array.isArray(payload.warnings)).toBe(true);
  });

  it("collects budget warning", async () => {
    db.select.mockReturnValueOnce(mockChain([]));
    db.select
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Food" }]))
      .mockReturnValueOnce(mockChain([{ id: 1, categoryId: 1, plannedAmount: "5000" }]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ total: "4500" }]));
    db.select.mockReturnValueOnce(mockChain([]));
    const tx = { transactionType: "Expense", amount: "1000", date: "2025-03-01", description: "Lunch", category: "Food", accountId: 1 };
    const payload = { reply: "ok", type: "confirmation", warnings: undefined as unknown } as Record<string, unknown>;
    const result = await validateAndEnrichConfirmation(
      tx, payload,
      [{ name: "Food", type: "Expense" }],
      [{ id: 1, name: "SBI", type: "bank" }],
      { dominantAccount: null, dominantCategory: null },
      [],
    );
    expect(result).toBeNull();
    if (payload.warnings) {
      const warnings = payload.warnings as Array<Record<string, unknown>>;
      expect(warnings.some(w => w.type === "budget")).toBe(true);
    }
  });

  it("collects duplicate warning", async () => {
    db.select.mockReturnValueOnce(mockChain([]));
    db.select.mockReturnValueOnce(mockChain([]));
    db.select.mockReturnValueOnce(
      mockChain([{ id: 99, date: "2025-03-01", description: "Coffee", amount: "500.00", createdAt: new Date() }])
    );
    const tx = { transactionType: "Expense", amount: "500", date: "2025-03-01", description: "Coffee", category: "Food", accountId: 1 };
    const payload = { reply: "ok", type: "confirmation", warnings: undefined as unknown } as Record<string, unknown>;
    const result = await validateAndEnrichConfirmation(
      tx, payload,
      [{ name: "Food", type: "Expense" }],
      [{ id: 1, name: "SBI", type: "bank" }],
      { dominantAccount: null, dominantCategory: null },
      [],
    );
    expect(result).toBeNull();
    if (payload.warnings) {
      const warnings = payload.warnings as Array<Record<string, unknown>>;
      expect(warnings.some(w => w.type === "duplicate")).toBe(true);
    }
  });
});

describe("detectRecurringPattern", () => {
  it("returns null for empty description", async () => {
    expect(await detectRecurringPattern("")).toBeNull();
  });
  it("returns null when < 3 rows", async () => {
    db.select.mockReturnValueOnce(mockChain([{ date: "2025-01-01", amount: "499", category: "Sub", accountId: 1, type: "Expense", description: "Netflix" }]));
    expect(await detectRecurringPattern("Netflix")).toBeNull();
  });
  it("detects recurring pattern", async () => {
    const rows = [
      { date: "2025-01-15", amount: "499", category: "Sub", accountId: 1, type: "Expense", description: "Netflix" },
      { date: "2025-02-15", amount: "499", category: "Sub", accountId: 1, type: "Expense", description: "Netflix" },
      { date: "2025-03-15", amount: "499", category: "Sub", accountId: 1, type: "Expense", description: "Netflix" },
    ];
    db.select.mockReturnValueOnce(mockChain(rows));
    const result = await detectRecurringPattern("Netflix");
    expect(result).not.toBeNull();
    expect(result?.category).toBe("Sub");
  });
  it("returns null when not matching pattern", async () => {
    const rows = [
      { date: "2025-01-15", amount: "499", category: "Sub", accountId: 1, type: "Expense", description: "Netflix" },
      { date: "2025-02-15", amount: "999", category: "Food", accountId: 2, type: "Expense", description: "Netflix" },
      { date: "2025-03-15", amount: "1499", category: "Travel", accountId: 3, type: "Expense", description: "Netflix" },
    ];
    db.select.mockReturnValueOnce(mockChain(rows));
    expect(await detectRecurringPattern("Netflix")).toBeNull();
  });
  it("passes custom amount", async () => {
    const rows = [
      { date: "2025-01-15", amount: "499", category: "Sub", accountId: 1, type: "Expense", description: "Netflix" },
      { date: "2025-02-15", amount: "499", category: "Sub", accountId: 1, type: "Expense", description: "Netflix" },
      { date: "2025-03-15", amount: "499", category: "Sub", accountId: 1, type: "Expense", description: "Netflix" },
    ];
    db.select.mockReturnValueOnce(mockChain(rows));
    const result = await detectRecurringPattern("Netflix", 599);
    expect(result?.amount).toBe("599");
  });
});

describe("detectSpendingAnomaly", () => {
  it("returns null for zero amount", async () => {
    expect(await detectSpendingAnomaly(0, "Food", "Starbucks")).toBeNull();
  });
  it("returns null for negative amount", async () => {
    expect(await detectSpendingAnomaly(-100, "Food", "Starbucks")).toBeNull();
  });
  it("detects merchant anomaly", async () => {
    const rows = Array(5).fill(null).map(() => ({ amount: "100" }));
    db.select.mockReturnValueOnce(mockChain(rows));
    const result = await detectSpendingAnomaly(500, "Food", "Starbucks");
    expect(result).not.toBeNull();
    expect(result?.type).toBe("merchant");
  });
  it("no anomaly when below threshold", async () => {
    const rows = Array(5).fill(null).map(() => ({ amount: "100" }));
    db.select.mockReturnValueOnce(mockChain(rows));
    const result = await detectSpendingAnomaly(200, "Food", "Starbucks");
    expect(result).toBeNull();
  });
  it("detects category anomaly when no description", async () => {
    const rows = Array(5).fill(null).map(() => ({ amount: "100" }));
    db.select.mockReturnValueOnce(mockChain(rows));
    const result = await detectSpendingAnomaly(500, "Food", "");
    expect(result).not.toBeNull();
    expect(result?.type).toBe("category");
  });
  it("no anomaly for Transfer category without description", async () => {
    const result = await detectSpendingAnomaly(500, "Transfer", "");
    expect(result).toBeNull();
  });
  it("falls through to category when merchant has < 3 rows", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ amount: "100" }]))
      .mockReturnValueOnce(mockChain(Array(5).fill(null).map(() => ({ amount: "100" }))));
    const result = await detectSpendingAnomaly(500, "Food", "NewMerchant");
    expect(result).not.toBeNull();
    expect(result?.type).toBe("category");
  });
});

describe("checkBudgetWarning", () => {
  it("returns null for no category", async () => {
    expect(await checkBudgetWarning("", 100, [])).toBeNull();
  });
  it("returns null for Transfer category", async () => {
    expect(await checkBudgetWarning("Transfer", 100, [])).toBeNull();
  });
  it("returns null when category not in list", async () => {
    expect(await checkBudgetWarning("Food", 100, [{ name: "Transport", type: "Expense" }])).toBeNull();
  });
  it("returns null for Income category", async () => {
    expect(await checkBudgetWarning("Salary", 100, [{ name: "Salary", type: "Income" }])).toBeNull();
  });
  it("returns warning when over budget", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Food" }]))
      .mockReturnValueOnce(mockChain([{ id: 1, categoryId: 1, plannedAmount: "5000" }]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ total: "4500" }]));
    const result = await checkBudgetWarning("Food", 1000, [{ name: "Food", type: "Expense" }]);
    expect(result).not.toBeNull();
    expect(result?.afterTransaction).toBe(5500);
  });
  it("returns null when under budget", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Food" }]))
      .mockReturnValueOnce(mockChain([{ id: 1, categoryId: 1, plannedAmount: "10000" }]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ total: "2000" }]));
    const result = await checkBudgetWarning("Food", 500, [{ name: "Food", type: "Expense" }]);
    expect(result).toBeNull();
  });
  it("returns null when no budget set", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Food" }]))
      .mockReturnValueOnce(mockChain([]));
    const result = await checkBudgetWarning("Food", 500, [{ name: "Food", type: "Expense" }]);
    expect(result).toBeNull();
  });
});

describe("detectDuplicate", () => {
  it("returns null for zero amount", async () => {
    expect(await detectDuplicate(0, "Food", "Test", "2025-03-01")).toBeNull();
  });
  it("returns null for no date", async () => {
    expect(await detectDuplicate(100, "Food", "Test", "")).toBeNull();
  });
  it("returns null for invalid date", async () => {
    expect(await detectDuplicate(100, "Food", "Test", "invalid")).toBeNull();
  });
  it("detects duplicate by description", async () => {
    db.select.mockReturnValueOnce(
      mockChain([{ id: 5, date: "2025-03-01", description: "Coffee", amount: "100.00", createdAt: new Date() }])
    );
    const result = await detectDuplicate(100, "Food", "Coffee", "2025-03-01");
    expect(result).not.toBeNull();
    expect(result?.existingDescription).toBe("Coffee");
  });
  it("detects duplicate by category when no description", async () => {
    db.select.mockReturnValueOnce(
      mockChain([{ id: 6, date: "2025-03-01", description: "Test", amount: "100.00", createdAt: new Date() }])
    );
    const result = await detectDuplicate(100, "Food", "", "2025-03-01");
    expect(result).not.toBeNull();
  });
  it("returns null when no description and no category", async () => {
    expect(await detectDuplicate(100, "", "", "2025-03-01")).toBeNull();
  });
  it("returns null when no match found", async () => {
    db.select.mockReturnValueOnce(mockChain([]));
    const result = await detectDuplicate(100, "Food", "Coffee", "2025-03-01");
    expect(result).toBeNull();
  });
});
