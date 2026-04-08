import { desc, sql, and, ilike } from "drizzle-orm";
import { likeContains } from "../../lib/escape-like";
import { db, transactionsTable } from "@workspace/db";

export interface RecurringPattern {
  description: string;
  amount: string;
  category: string;
  accountId: number | null;
  transactionType: string;
}

export async function detectRecurringPattern(
  description: string,
  amount?: number,
): Promise<RecurringPattern | null> {
  if (!description) return null;

  const rows = await db
    .select()
    .from(transactionsTable)
    .where(and(
      ilike(transactionsTable.description, likeContains(description)),
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
