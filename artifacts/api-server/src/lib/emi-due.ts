import { sql } from "drizzle-orm";
import { db, transactionsTable } from "@workspace/db";
import type { Account } from "@workspace/db";

export interface EmiDueResult {
  totalEmiDue: number;
  emiPaidLoanIds: Set<number>;
  activeLoanAccounts: Account[];
}

export async function calculateTotalEmiDue(
  allAccounts: Account[],
  startDate: string,
  endDate: string,
): Promise<EmiDueResult> {
  const activeLoanAccounts = allAccounts.filter(
    (a) =>
      a.type === "loan" &&
      Number(a.currentBalance ?? 0) > 0 &&
      a.emiAmount &&
      Number(a.emiAmount) > 0,
  );

  const activeLoanIds = activeLoanAccounts.map((a) => a.id);

  const emiPaidResult =
    activeLoanIds.length > 0
      ? await db
          .select({
            toAccountId: transactionsTable.toAccountId,
            accountId: transactionsTable.accountId,
          })
          .from(transactionsTable)
          .where(
            sql`${transactionsTable.category} = 'EMI' AND ${transactionsTable.date}::date >= ${startDate}::date AND ${transactionsTable.date}::date <= ${endDate}::date`,
          )
      : [];

  const emiPaidLoanIds = new Set<number>();
  for (const r of emiPaidResult) {
    if (r.toAccountId && activeLoanIds.includes(r.toAccountId)) {
      emiPaidLoanIds.add(r.toAccountId);
    } else if (r.accountId && activeLoanIds.includes(r.accountId)) {
      emiPaidLoanIds.add(r.accountId);
    }
  }

  const cycleStart = new Date(startDate + "T00:00:00");
  const cycleEnd = new Date(endDate + "T23:59:59");

  const totalEmiDue = activeLoanAccounts
    .filter((a) => {
      if (emiPaidLoanIds.has(a.id)) return false;

      const emiDay = a.emiDay;
      if (emiDay && a.createdAt) {
        const createdAt = new Date(a.createdAt);
        if (createdAt >= cycleStart && createdAt <= cycleEnd) {
          const emiDateInCycle = buildEmiDateInCycle(emiDay, startDate, endDate);
          if (emiDateInCycle && createdAt > emiDateInCycle) {
            return false;
          }
        }
      }

      return true;
    })
    .reduce((sum, a) => sum + Number(a.emiAmount ?? 0), 0);

  return { totalEmiDue, emiPaidLoanIds, activeLoanAccounts };
}

function buildEmiDateInCycle(
  emiDay: number,
  startDate: string,
  endDate: string,
): Date | null {
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T23:59:59");

  const startYear = start.getFullYear();
  const startMonth = start.getMonth();
  const endYear = end.getFullYear();
  const endMonth = end.getMonth();

  let checkYear = startYear;
  let checkMonth = startMonth;

  while (
    checkYear < endYear ||
    (checkYear === endYear && checkMonth <= endMonth)
  ) {
    const lastDayOfMonth = new Date(checkYear, checkMonth + 1, 0).getDate();
    const clampedDay = Math.min(emiDay, lastDayOfMonth);
    const candidate = new Date(checkYear, checkMonth, clampedDay, 0, 0, 0);

    if (candidate >= start && candidate <= end) {
      return candidate;
    }

    checkMonth++;
    if (checkMonth > 11) {
      checkMonth = 0;
      checkYear++;
    }
  }

  return null;
}
