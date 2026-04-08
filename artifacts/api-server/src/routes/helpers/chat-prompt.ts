import type { RecurringPattern } from "./recurring-patterns";
import { detectRecurringPattern } from "./recurring-patterns";
import {
  type MerchantDefaults,
  type MerchantMapping,
  getMerchantDefaults,
  getMerchantMapping,
  getRecentAccountUsage,
  getRecentCategoryUsage,
} from "./merchant-mapping";

interface PromptContext {
  userCategories: { name: string; type: string }[];
  userAccounts: { id: number; name: string; type: string }[];
  historyContext: string[];
}

export function buildSystemPrompt(ctx: PromptContext): string {
  const { userCategories, userAccounts, historyContext } = ctx;

  const categoryList = userCategories.length > 0
    ? userCategories.map((c) => `${c.name} (${c.type})`).join(", ")
    : "None";

  const accountList = userAccounts.length > 0
    ? userAccounts.map((a) => `${a.name} (id: ${a.id}, type: ${a.type})`).join(", ")
    : "None";

  const today = new Date().toISOString().split("T")[0];
  const dayOfWeek = new Date().toLocaleDateString("en-US", { weekday: "long" });

  return `You are a conversational financial transaction assistant. You help users log transactions through a chat-like interface using slot-filling.

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
}

export interface MerchantContext {
  merchantDefaults: MerchantDefaults;
  recentAccounts: { id: number; count: number }[];
  recentCategories: { name: string; count: number }[];
  recurringPattern: RecurringPattern | null;
}

export async function fetchMerchantContext(userMessage: string): Promise<MerchantContext> {
  let merchantDefaults: MerchantDefaults = { dominantAccount: null, dominantCategory: null };
  let recentAccounts: { id: number; count: number }[] = [];
  let recentCategories: { name: string; count: number }[] = [];
  let merchantMapping: MerchantMapping | null = null;

  const words = userMessage.split(/\s+/).filter((w: string) => w.length > 2 && !/^\d+$/.test(w));
  const possibleMerchant = words.slice(-3).join(" ");

  try {
    [merchantDefaults, recentAccounts, recentCategories, merchantMapping] = await Promise.all([
      getMerchantDefaults(possibleMerchant),
      getRecentAccountUsage(),
      getRecentCategoryUsage(),
      getMerchantMapping(possibleMerchant),
    ]);
  } catch { /* merchant lookup is best-effort */ }

  if (merchantMapping) {
    merchantDefaults.dominantCategory = merchantMapping.category;
    if (merchantMapping.accountId) {
      merchantDefaults.dominantAccount = { id: merchantMapping.accountId, name: "" };
    }
  }

  let recurringPattern: RecurringPattern | null = null;
  try {
    const amountMatch = userMessage.match(/[\d,]+\.?\d*/);
    const possibleAmount = amountMatch ? Number(amountMatch[0].replace(/,/g, "")) : undefined;
    recurringPattern = await detectRecurringPattern(possibleMerchant, possibleAmount);
  } catch { /* recurring pattern detection is best-effort */ }

  return { merchantDefaults, recentAccounts, recentCategories, recurringPattern };
}

export function buildHistoryContext(
  merchantDefaults: { dominantCategory: string | null; dominantAccount: { id: number; name: string } | null },
  recentCategories: { name: string; count: number }[],
  recentAccounts: { id: number; count: number }[],
  userAccounts: { id: number; name: string; type: string }[],
  recurringPattern: RecurringPattern | null,
): string[] {
  const historyContext: string[] = [];
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
      const acct = userAccounts.find((ua) => ua.id === a.id);
      return acct ? acct.name : `ID:${a.id}`;
    });
    historyContext.push(`Most used accounts (by frequency): ${acctNames.join(", ")}`);
  }
  if (recurringPattern) {
    historyContext.push(`RECURRING PATTERN DETECTED: This looks like a recurring transaction. Pre-fill: description="${recurringPattern.description}", amount=${recurringPattern.amount}, category="${recurringPattern.category}", accountId=${recurringPattern.accountId}, type=${recurringPattern.transactionType}. Go straight to confirmation unless user specified different values.`);
  }
  return historyContext;
}
