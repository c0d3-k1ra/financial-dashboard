import {
  getCategoryDominantAccount,
  checkAmbiguousMerchant,
  findClosestCategories,
} from "./merchant-mapping";

import {
  detectSpendingAnomaly,
  checkBudgetWarning,
  detectDuplicate,
} from "./anomaly-detection";

import type { MerchantDefaults } from "./merchant-mapping";

export interface TransactionSlots {
  transactionType?: string;
  amount?: string;
  date?: string;
  description?: string;
  category?: string;
  accountId?: number | null;
  fromAccountId?: number | null;
  toAccountId?: number | null;
}

export interface ResponsePayload {
  reply: string;
  type: string;
  options?: { label: string; value: string }[];
  transaction?: TransactionSlots;
  warnings?: Record<string, unknown>[];
}

export async function validateAndEnrichConfirmation(
  tx: TransactionSlots,
  responsePayload: ResponsePayload,
  userCategories: { name: string; type: string }[],
  userAccounts: { id: number; name: string; type: string }[],
  merchantDefaults: MerchantDefaults,
  recentAccounts: { id: number; count: number }[],
): Promise<ResponsePayload | null> {
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

    return {
      ...responsePayload,
      type: "question",
      reply: `I don't see a category called "${tx.category}". Which would you like to use?`,
      options,
      transaction: tx,
    };
  }

  const accountExists = tx.accountId ? userAccounts.some(a => a.id === tx.accountId) : true;
  if (!accountExists) {
    const options = userAccounts.slice(0, 5).map(a => ({ label: a.name, value: String(a.id) }));
    options.push({ label: `+ Add new account`, value: `__create_account__` });

    return {
      ...responsePayload,
      type: "question",
      reply: `I couldn't find the account you mentioned. Which account should I use?`,
      options,
      transaction: tx,
    };
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

        return {
          ...responsePayload,
          type: "question",
          reply: `"${tx.description}" has been categorized differently in the past. Which category fits best?`,
          options,
          transaction: tx,
        };
      }
    }
  }

  const warnings = await collectWarnings(tx, userCategories);
  if (warnings.length > 0) {
    responsePayload.warnings = warnings;
  }
  responsePayload.transaction = tx;

  return null;
}

async function collectWarnings(
  tx: TransactionSlots,
  userCategories: { name: string; type: string }[],
): Promise<Record<string, unknown>[]> {
  const warnings: Record<string, unknown>[] = [];
  const amount = Number(tx.amount);

  const category = tx.category ?? "";
  const description = tx.description ?? "";
  const date = tx.date ?? "";

  try {
    const anomaly = await detectSpendingAnomaly(amount, category, description);
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
  }

  try {
    const budgetWarning = await checkBudgetWarning(category, amount, userCategories);
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
  }

  try {
    const duplicate = await detectDuplicate(amount, category, description, date);
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
  }

  return warnings;
}

export function parseAiResponse(text: string): Record<string, unknown> | null {
  let cleaned = text.trim();
  const jsonMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    cleaned = jsonMatch[1].trim();
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}
