import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, transactionsTable, monthlyConfigTable, goalsTable, surplusAllocationsTable, accountsTable } from "@workspace/db";
import { DistributeSurplusBody } from "@workspace/api-zod";

const router: IRouter = Router();

function getNextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  let ny = y;
  let nm = m + 1;
  if (nm > 12) { nm = 1; ny++; }
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

router.get("/surplus/monthly", async (req, res) => {
  try {
    const month = req.query.month as string;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: "Invalid month format. Use YYYY-MM." });
      return;
    }

    const incomeResult = await db
      .select({ total: sql<string>`COALESCE(SUM(${transactionsTable.amount}::numeric), 0)` })
      .from(transactionsTable)
      .where(sql`${transactionsTable.type} = 'Income' AND to_char(${transactionsTable.date}::date, 'YYYY-MM') = ${month}`);

    const expenseResult = await db
      .select({ total: sql<string>`COALESCE(SUM(${transactionsTable.amount}::numeric), 0)` })
      .from(transactionsTable)
      .where(sql`${transactionsTable.type} = 'Expense' AND to_char(${transactionsTable.date}::date, 'YYYY-MM') = ${month}`);

    const income = Number(incomeResult[0]?.total ?? 0);
    const expenses = Number(expenseResult[0]?.total ?? 0);
    const surplus = income - expenses;

    res.json({
      month,
      income: income.toFixed(2),
      expenses: expenses.toFixed(2),
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

    const incomeResult = await db
      .select({ total: sql<string>`COALESCE(SUM(${transactionsTable.amount}::numeric), 0)` })
      .from(transactionsTable)
      .where(sql`${transactionsTable.type} = 'Income' AND to_char(${transactionsTable.date}::date, 'YYYY-MM') = ${month}`);

    const expenseResult = await db
      .select({ total: sql<string>`COALESCE(SUM(${transactionsTable.amount}::numeric), 0)` })
      .from(transactionsTable)
      .where(sql`${transactionsTable.type} = 'Expense' AND to_char(${transactionsTable.date}::date, 'YYYY-MM') = ${month}`);

    const surplus = Number(incomeResult[0]?.total ?? 0) - Number(expenseResult[0]?.total ?? 0);

    if (surplus <= 0) {
      res.status(400).json({ error: "No surplus available for this month." });
      return;
    }

    if (totalAllocation > surplus) {
      res.status(400).json({ error: `Total allocation (₹${totalAllocation.toFixed(2)}) exceeds surplus (₹${surplus.toFixed(2)}).` });
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
      const totalExpenses = Number(expenseResult[0]?.total ?? 0);
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

export default router;
