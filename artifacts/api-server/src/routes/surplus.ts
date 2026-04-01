import { Router, type IRouter } from "express";
import { eq, sql, and, ne } from "drizzle-orm";
import { db, transactionsTable, monthlyConfigTable, goalsTable, surplusAllocationsTable, accountsTable } from "@workspace/db";
import { DistributeSurplusBody, UndoSurplusDistributionBody } from "@workspace/api-zod";
import { getCycleDates } from "../lib/billing-cycle";
import { getAppSettings } from "../lib/settings-helper";

const router: IRouter = Router();

function getNextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  let ny = y;
  let nm = m + 1;
  if (nm > 12) { nm = 1; ny++; }
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

function extractTotal(result: unknown): number {
  const rows = (result as { rows: { total: string }[] }).rows;
  return Number(rows?.[0]?.total ?? 0);
}

router.get("/surplus/monthly", async (req, res) => {
  try {
    const month = req.query.month as string;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: "Invalid month format. Use YYYY-MM." });
      return;
    }

    const settings = await getAppSettings();
    const { startDate, endDate } = getCycleDates(month, settings.billingCycleDay);

    const surplusAccounts = await db
      .select({ id: accountsTable.id, currentBalance: accountsTable.currentBalance })
      .from(accountsTable)
      .where(sql`${accountsTable.useInSurplus} = true`);

    const grossBalance = surplusAccounts.reduce((sum, a) => sum + Number(a.currentBalance ?? 0), 0);

    const allAccounts = await db.select().from(accountsTable);
    const totalCcOutstanding = allAccounts
      .filter(a => a.type === "credit_card")
      .reduce((sum, a) => sum + Math.abs(Number(a.currentBalance ?? 0)), 0);
    const activeLoanAccounts = allAccounts.filter(a => a.type === "loan" && Number(a.currentBalance ?? 0) > 0 && a.emiAmount && Number(a.emiAmount) > 0);
    const activeLoanIds = activeLoanAccounts.map(a => a.id);
    const emiPaidResult = activeLoanIds.length > 0
      ? await db
          .select({ toAccountId: transactionsTable.toAccountId, accountId: transactionsTable.accountId })
          .from(transactionsTable)
          .where(sql`${transactionsTable.category} = 'EMI' AND ${transactionsTable.date}::text LIKE ${month + '%'}`)
      : [];
    const emiPaidLoanIds = new Set<number>();
    for (const r of emiPaidResult) {
      if (r.toAccountId && activeLoanIds.includes(r.toAccountId)) emiPaidLoanIds.add(r.toAccountId);
      else if (r.accountId && activeLoanIds.includes(r.accountId)) emiPaidLoanIds.add(r.accountId);
    }
    const totalEmiDue = activeLoanAccounts
      .filter(a => !emiPaidLoanIds.has(a.id))
      .reduce((sum, a) => sum + Number(a.emiAmount ?? 0), 0);

    const surplus = grossBalance - totalEmiDue - totalCcOutstanding;

    res.json({
      month,
      surplus: surplus.toFixed(2),
    });
  } catch (e) {
    req.log.error({ err: e }, "Failed to get monthly surplus");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/surplus/distribute", async (req, res) => {
  try {
    const data = DistributeSurplusBody.parse(req.body);
    const { month, sourceAccountId, allocations } = data;

    if (!allocations || allocations.length === 0) {
      res.status(400).json({ error: "No allocations provided" });
      return;
    }

    const sourceAccount = await db.select().from(accountsTable).where(eq(accountsTable.id, sourceAccountId));
    if (!sourceAccount.length) {
      res.status(404).json({ error: "Source account not found" });
      return;
    }

    const sourceBalance = Number(sourceAccount[0].currentBalance ?? 0);
    const totalAllocation = allocations.reduce((s, a) => s + Number(a.amount), 0);

    if (totalAllocation > sourceBalance) {
      res.status(400).json({ error: `Insufficient balance. Source account has ₹${sourceBalance.toFixed(2)} but ₹${totalAllocation.toFixed(2)} requested.` });
      return;
    }

    const settings = await getAppSettings();
    const { startDate, endDate } = getCycleDates(month, settings.billingCycleDay);

    const surplusAccounts = await db
      .select({ id: accountsTable.id, currentBalance: accountsTable.currentBalance })
      .from(accountsTable)
      .where(sql`${accountsTable.useInSurplus} = true`);

    const grossBalance = surplusAccounts.reduce((sum, a) => sum + Number(a.currentBalance ?? 0), 0);

    const allAccountsForSurplus = await db.select().from(accountsTable);
    const totalCcOutstandingForSurplus = allAccountsForSurplus
      .filter(a => a.type === "credit_card")
      .reduce((sum, a) => sum + Math.abs(Number(a.currentBalance ?? 0)), 0);
    const activeLoanAccountsForSurplus = allAccountsForSurplus.filter(a => a.type === "loan" && Number(a.currentBalance ?? 0) > 0 && a.emiAmount && Number(a.emiAmount) > 0);
    const activeLoanIdsForSurplus = activeLoanAccountsForSurplus.map(a => a.id);
    const emiPaidResultForSurplus = activeLoanIdsForSurplus.length > 0
      ? await db
          .select({ toAccountId: transactionsTable.toAccountId, accountId: transactionsTable.accountId })
          .from(transactionsTable)
          .where(sql`${transactionsTable.category} = 'EMI' AND ${transactionsTable.date}::text LIKE ${month + '%'}`)
      : [];
    const emiPaidLoanIdsForSurplus = new Set<number>();
    for (const r of emiPaidResultForSurplus) {
      if (r.toAccountId && activeLoanIdsForSurplus.includes(r.toAccountId)) emiPaidLoanIdsForSurplus.add(r.toAccountId);
      else if (r.accountId && activeLoanIdsForSurplus.includes(r.accountId)) emiPaidLoanIdsForSurplus.add(r.accountId);
    }
    const totalEmiDueForSurplus = activeLoanAccountsForSurplus
      .filter(a => !emiPaidLoanIdsForSurplus.has(a.id))
      .reduce((sum, a) => sum + Number(a.emiAmount ?? 0), 0);

    const surplus = grossBalance - totalEmiDueForSurplus - totalCcOutstandingForSurplus;

    if (surplus <= 0) {
      res.status(400).json({ error: "No surplus available for this month." });
      return;
    }

    if (totalAllocation > surplus) {
      res.status(400).json({ error: `Total allocation (₹${totalAllocation.toFixed(2)}) exceeds available surplus (₹${surplus.toFixed(2)}).` });
      return;
    }

    for (const alloc of allocations) {
      const goalExists = await db.select().from(goalsTable).where(eq(goalsTable.id, alloc.goalId));
      if (!goalExists.length) {
        res.status(400).json({ error: `Goal ID ${alloc.goalId} not found.` });
        return;
      }
      if (Number(alloc.amount) <= 0) {
        res.status(400).json({ error: `Amount for goal "${goalExists[0].name}" must be positive.` });
        return;
      }
    }

    const accountAllocMap = new Map<number, number>();
    for (const alloc of allocations) {
      const goal = await db.select().from(goalsTable).where(eq(goalsTable.id, alloc.goalId));
      if (goal.length && goal[0].accountId) {
        const accId = goal[0].accountId;
        accountAllocMap.set(accId, (accountAllocMap.get(accId) ?? 0) + Number(alloc.amount));
      }
    }

    for (const [accId, incomingAmount] of accountAllocMap) {
      const account = await db.select().from(accountsTable).where(eq(accountsTable.id, accId));
      if (!account.length) continue;

      let effectiveBalance = Number(account[0].currentBalance ?? 0);
      if (accId !== sourceAccountId) {
        effectiveBalance += incomingAmount;
      }

      const existingGoals = await db
        .select({ currentAmount: goalsTable.currentAmount })
        .from(goalsTable)
        .where(and(eq(goalsTable.accountId, accId), ne(goalsTable.status, "Achieved")));

      const existingTotal = existingGoals.reduce((sum, g) => sum + Number(g.currentAmount ?? 0), 0);
      const totalRequired = existingTotal + incomingAmount;

      if (totalRequired > effectiveBalance) {
        const shortfall = totalRequired - effectiveBalance;
        res.status(400).json({
          error: `Account "${account[0].name}" cannot support this allocation. Balance would be ₹${effectiveBalance.toFixed(2)} but goals would require ₹${totalRequired.toFixed(2)} (shortfall: ₹${shortfall.toFixed(2)}).`,
        });
        return;
      }
    }

    let transferCount = 0;
    let actualAllocated = 0;
    const today = new Date().toISOString().split("T")[0];

    await db.transaction(async (tx) => {
      const freshSource = await tx.select().from(accountsTable).where(eq(accountsTable.id, sourceAccountId));
      if (!freshSource.length || Number(freshSource[0].currentBalance ?? 0) < totalAllocation) {
        throw new Error("Insufficient balance (concurrent modification detected)");
      }

      for (const alloc of allocations) {
        const amount = Number(alloc.amount);

        const goal = await tx.select().from(goalsTable).where(eq(goalsTable.id, alloc.goalId));
        if (!goal.length) throw new Error(`Goal ${alloc.goalId} not found`);

        await tx
          .update(goalsTable)
          .set({ currentAmount: sql`${goalsTable.currentAmount}::numeric + ${amount}` })
          .where(eq(goalsTable.id, alloc.goalId));

        const updatedGoal = await tx.select().from(goalsTable).where(eq(goalsTable.id, alloc.goalId));
        if (updatedGoal.length > 0 && Number(updatedGoal[0].currentAmount ?? 0) >= Number(updatedGoal[0].targetAmount ?? 0) && Number(updatedGoal[0].targetAmount ?? 0) > 0) {
          await tx.update(goalsTable).set({ status: "Achieved" }).where(eq(goalsTable.id, alloc.goalId));
        }

        actualAllocated += amount;

        await tx.insert(surplusAllocationsTable).values({
          month,
          goalId: alloc.goalId,
          amount: amount.toFixed(2),
          sourceAccountId,
        });

        if (goal[0].accountId !== sourceAccountId) {
          await tx
            .update(accountsTable)
            .set({ currentBalance: sql`${accountsTable.currentBalance}::numeric - ${amount}` })
            .where(eq(accountsTable.id, sourceAccountId));

          await tx
            .update(accountsTable)
            .set({ currentBalance: sql`${accountsTable.currentBalance}::numeric + ${amount}` })
            .where(eq(accountsTable.id, goal[0].accountId));

          await tx.insert(transactionsTable).values({
            date: today,
            amount: amount.toFixed(2),
            description: `Goal Transfer: ${goal[0].name}`,
            category: "Transfer",
            type: "Transfer",
            accountId: sourceAccountId,
            toAccountId: goal[0].accountId,
          });

          transferCount++;
        }
      }

      const config = await tx.select().from(monthlyConfigTable).where(eq(monthlyConfigTable.month, month));
      const startingBalance = config.length > 0 ? Number(config[0].startingBalance) : 0;
      const totalIncome = Number(incomeResult[0]?.total ?? 0);
      const totalExpenses = extractTotal(bankExpResult) + extractTotal(ccTrResult);
      const endBalance = startingBalance + totalIncome - totalExpenses;
      const nextMonth = getNextMonth(month);

      const existingNext = await tx.select().from(monthlyConfigTable).where(eq(monthlyConfigTable.month, nextMonth));
      if (existingNext.length > 0) {
        await tx.update(monthlyConfigTable).set({ startingBalance: endBalance.toFixed(2) }).where(eq(monthlyConfigTable.month, nextMonth));
      } else {
        await tx.insert(monthlyConfigTable).values({ month: nextMonth, startingBalance: endBalance.toFixed(2) });
      }
    });

    res.json({
      success: true,
      allocatedTotal: actualAllocated.toFixed(2),
      transfers: transferCount,
      surplus: surplus.toFixed(2),
    });
  } catch (e) {
    req.log.error({ err: e }, "Failed to distribute surplus");
    res.status(400).json({ error: String(e instanceof Error ? e.message : "Invalid request") });
  }
});

router.get("/surplus/allocations", async (req, res) => {
  try {
    const allocations = await db.select().from(surplusAllocationsTable);
    const goals = await db.select().from(goalsTable);
    const goalMap = new Map(goals.map(g => [g.id, g.name]));

    const result = allocations.map(a => ({
      id: a.id,
      month: a.month,
      goalId: a.goalId,
      goalName: goalMap.get(a.goalId) ?? "Unknown",
      amount: Number(a.amount).toFixed(2),
      sourceAccountId: a.sourceAccountId,
      allocatedAt: a.allocatedAt.toISOString(),
    }));

    res.json(result);
  } catch (e) {
    req.log.error({ err: e }, "Failed to list allocations");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/surplus/can-undo", async (req, res) => {
  try {
    const month = req.query.month as string;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: "Invalid month format. Use YYYY-MM." });
      return;
    }

    const allocations = await db
      .select()
      .from(surplusAllocationsTable)
      .where(eq(surplusAllocationsTable.month, month));

    if (allocations.length === 0) {
      res.json({ canUndo: false, month });
      return;
    }

    const newerAllocations = await db
      .select()
      .from(surplusAllocationsTable)
      .where(sql`${surplusAllocationsTable.month} > ${month}`);

    if (newerAllocations.length > 0) {
      res.json({ canUndo: false, month });
      return;
    }

    const nextMonth = getNextMonth(month);
    const { startDate: nextStart, endDate: nextEnd } = getCycleDates(nextMonth);
    const nextMonthTxs = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(transactionsTable)
      .where(sql`${transactionsTable.date}::date >= ${nextStart}::date AND ${transactionsTable.date}::date <= ${nextEnd}::date AND ${transactionsTable.description} NOT LIKE 'Goal Transfer:%'`);

    if (Number(nextMonthTxs[0]?.count ?? 0) > 0) {
      res.json({ canUndo: false, month });
      return;
    }

    const goals = await db.select().from(goalsTable);
    const goalMap = new Map(goals.map(g => [g.id, g.name]));

    let transferCount = 0;
    for (const alloc of allocations) {
      const goal = goals.find(g => g.id === alloc.goalId);
      if (goal && alloc.sourceAccountId && goal.accountId !== alloc.sourceAccountId) {
        transferCount++;
      }
    }

    res.json({
      canUndo: true,
      month,
      allocations: allocations.map(a => ({
        goalId: a.goalId,
        goalName: goalMap.get(a.goalId) ?? "Unknown",
        amount: Number(a.amount).toFixed(2),
      })),
      transferCount,
    });
  } catch (e) {
    req.log.error({ err: e }, "Failed to check undo availability");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/surplus/undo", async (req, res) => {
  try {
    const data = UndoSurplusDistributionBody.parse(req.body);
    const { month } = data;

    if (!/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: "Invalid month format. Use YYYY-MM." });
      return;
    }

    const allocations = await db
      .select()
      .from(surplusAllocationsTable)
      .where(eq(surplusAllocationsTable.month, month));

    if (allocations.length === 0) {
      res.status(400).json({ error: "No distribution found for this month." });
      return;
    }

    const newerAllocations = await db
      .select()
      .from(surplusAllocationsTable)
      .where(sql`${surplusAllocationsTable.month} > ${month}`);

    if (newerAllocations.length > 0) {
      res.status(400).json({ error: "Can only undo the most recent distribution." });
      return;
    }

    const nextMonth = getNextMonth(month);
    const { startDate: nextStart, endDate: nextEnd } = getCycleDates(nextMonth);
    const nextMonthTxs = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(transactionsTable)
      .where(sql`${transactionsTable.date}::date >= ${nextStart}::date AND ${transactionsTable.date}::date <= ${nextEnd}::date AND ${transactionsTable.description} NOT LIKE 'Goal Transfer:%'`);

    if (Number(nextMonthTxs[0]?.count ?? 0) > 0) {
      res.status(400).json({ error: "Cannot undo — new transactions exist in the next cycle." });
      return;
    }

    let deletedTransfers = 0;
    let revertedGoals = 0;

    const allocDates = allocations.map(a => a.allocatedAt.toISOString().split("T")[0]);
    const earliestAllocDate = allocDates.sort()[0];
    const latestAllocDate = allocDates.sort()[allocDates.length - 1];

    const otherAllocMonths = await db.execute(sql`
      SELECT DISTINCT month FROM ${surplusAllocationsTable} WHERE month != ${month}
    `);
    const hasOtherMonthsWithNextConfig = (otherAllocMonths as { rows: { month: string }[] }).rows?.some(
      (r) => getNextMonth(r.month) === nextMonth
    );

    await db.transaction(async (tx) => {
      for (const alloc of allocations) {
        const amount = Number(alloc.amount);
        const goal = await tx.select().from(goalsTable).where(eq(goalsTable.id, alloc.goalId));
        if (!goal.length) continue;

        await tx
          .update(goalsTable)
          .set({ currentAmount: sql`${goalsTable.currentAmount}::numeric - ${amount}` })
          .where(eq(goalsTable.id, alloc.goalId));

        const updatedGoal = await tx.select().from(goalsTable).where(eq(goalsTable.id, alloc.goalId));
        if (updatedGoal.length > 0) {
          const current = Number(updatedGoal[0].currentAmount ?? 0);
          const target = Number(updatedGoal[0].targetAmount ?? 0);
          if (target > 0 && current < target && updatedGoal[0].status === "Achieved") {
            await tx.update(goalsTable).set({ status: "Active" }).where(eq(goalsTable.id, alloc.goalId));
          }
        }
        revertedGoals++;

        if (alloc.sourceAccountId && goal[0].accountId !== alloc.sourceAccountId) {
          await tx
            .update(accountsTable)
            .set({ currentBalance: sql`${accountsTable.currentBalance}::numeric + ${amount}` })
            .where(eq(accountsTable.id, alloc.sourceAccountId));

          await tx
            .update(accountsTable)
            .set({ currentBalance: sql`${accountsTable.currentBalance}::numeric - ${amount}` })
            .where(eq(accountsTable.id, goal[0].accountId));

          const matchingTxs = await tx
            .select({ id: transactionsTable.id })
            .from(transactionsTable)
            .where(
              and(
                eq(transactionsTable.type, "Transfer"),
                eq(transactionsTable.accountId, alloc.sourceAccountId!),
                eq(transactionsTable.toAccountId, goal[0].accountId),
                sql`${transactionsTable.description} = ${"Goal Transfer: " + goal[0].name}`,
                sql`${transactionsTable.amount}::numeric = ${amount}`,
                sql`${transactionsTable.date}::date >= ${earliestAllocDate}::date AND ${transactionsTable.date}::date <= ${latestAllocDate}::date`
              )
            )
            .limit(1);

          if (matchingTxs.length > 0) {
            await tx.delete(transactionsTable).where(eq(transactionsTable.id, matchingTxs[0].id));
            deletedTransfers++;
          }
        }
      }

      await tx.delete(surplusAllocationsTable).where(eq(surplusAllocationsTable.month, month));

      if (!hasOtherMonthsWithNextConfig) {
        await tx.delete(monthlyConfigTable).where(eq(monthlyConfigTable.month, nextMonth));
      }
    });

    res.json({
      success: true,
      deletedAllocations: allocations.length,
      deletedTransfers,
      revertedGoals,
    });
  } catch (e) {
    req.log.error({ err: e }, "Failed to undo surplus distribution");
    res.status(400).json({ error: String(e instanceof Error ? e.message : "Invalid request") });
  }
});

export default router;
