import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, goalsTable, accountsTable, surplusAllocationsTable, transactionsTable } from "@workspace/db";
import { CreateGoalBody, UpdateGoalBody } from "@workspace/api-zod";

const router: IRouter = Router();

const CATEGORY_ICONS: Record<string, string> = {
  Emergency: "🛡️",
  Debt: "💳",
  Travel: "✈️",
  Purchase: "🛍️",
  General: "🎯",
};

function computeGoalIntelligence(goal: {
  id: number;
  currentAmount: string | null;
  targetAmount: string | null;
  targetDate: string | null;
}, allocations: { amount: string; allocatedAt: Date }[]) {
  const current = Number(goal.currentAmount ?? 0);
  const target = Number(goal.targetAmount ?? 0);

  let velocity = 0;
  if (allocations.length > 0) {
    const totalAllocated = allocations.reduce((s, a) => s + Number(a.amount), 0);
    const firstDate = new Date(Math.min(...allocations.map(a => new Date(a.allocatedAt).getTime())));
    const monthsActive = Math.max(1, (Date.now() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    velocity = totalAllocated / monthsActive;
  }

  let statusIndicator = "On Track";
  let projectedFinishDate: string | null = null;

  if (target > 0 && current >= target) {
    statusIndicator = "Achieved";
  } else if (target > 0 && current < target) {
    const remaining = target - current;
    if (velocity > 0) {
      const monthsToFinish = remaining / velocity;
      const projected = new Date();
      projected.setMonth(projected.getMonth() + Math.ceil(monthsToFinish));
      projectedFinishDate = `${projected.getFullYear()}-${String(projected.getMonth() + 1).padStart(2, "0")}`;

      if (goal.targetDate) {
        const targetD = new Date(goal.targetDate);
        if (projected > targetD) {
          const diff = (projected.getTime() - targetD.getTime()) / (1000 * 60 * 60 * 24 * 30);
          statusIndicator = diff > 3 ? "Behind" : "At Risk";
        } else {
          statusIndicator = "On Track";
        }
      } else {
        statusIndicator = "On Track";
      }
    } else {
      if (goal.targetDate) {
        const targetD = new Date(goal.targetDate);
        statusIndicator = targetD < new Date() ? "Behind" : "At Risk";
      } else {
        statusIndicator = "Not Started";
      }
    }
  }

  return { velocity: Math.round(velocity * 100) / 100, statusIndicator, projectedFinishDate };
}

router.get("/goals", async (req, res) => {
  try {
    const goals = await db.select().from(goalsTable);
    const accounts = await db.select().from(accountsTable);
    const allAllocations = await db.select().from(surplusAllocationsTable);

    const accountMap = new Map(accounts.map(a => [a.id, a.name]));

    const result = goals.map(goal => {
      const goalAllocations = allAllocations.filter(a => a.goalId === goal.id);
      const intelligence = computeGoalIntelligence(goal, goalAllocations);

      return {
        id: goal.id,
        name: goal.name,
        targetAmount: Number(goal.targetAmount ?? 0).toFixed(2),
        currentAmount: Number(goal.currentAmount ?? 0).toFixed(2),
        accountId: goal.accountId,
        accountName: goal.accountId ? accountMap.get(goal.accountId) ?? null : null,
        status: goal.status,
        targetDate: goal.targetDate,
        categoryType: goal.categoryType,
        icon: goal.icon || CATEGORY_ICONS[goal.categoryType] || "🎯",
        ...intelligence,
      };
    });

    res.json(result);
  } catch (e) {
    req.log.error({ err: e }, "Failed to list goals");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/goals", async (req, res) => {
  try {
    const data = CreateGoalBody.parse(req.body);
    const icon = data.icon || CATEGORY_ICONS[data.categoryType] || "🎯";

    const [created] = await db.insert(goalsTable).values({
      name: data.name,
      targetAmount: data.targetAmount,
      currentAmount: "0",
      accountId: data.accountId ?? null,
      targetDate: data.targetDate ?? null,
      categoryType: data.categoryType,
      icon,
      status: "Active",
    }).returning();

    res.status(201).json({
      ...created,
      targetAmount: Number(created.targetAmount ?? 0).toFixed(2),
      currentAmount: Number(created.currentAmount ?? 0).toFixed(2),
      accountName: null,
      velocity: 0,
      statusIndicator: created.targetDate ? "At Risk" : "Not Started",
      projectedFinishDate: null,
    });
  } catch (e) {
    req.log.error({ err: e }, "Failed to create goal");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.put("/goals/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const data = UpdateGoalBody.parse(req.body);

    const existing = await db.select().from(goalsTable).where(eq(goalsTable.id, id));
    if (!existing.length) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }
    const currentAmt = Number(data.currentAmount ?? existing[0].currentAmount ?? 0);
    const targetAmt = Number(data.targetAmount);
    const newStatus = targetAmt > 0 && currentAmt >= targetAmt ? "Achieved" : "Active";

    const setFields: Record<string, unknown> = {
      name: data.name,
      targetAmount: data.targetAmount,
      accountId: data.accountId ?? null,
      targetDate: data.targetDate ?? null,
      categoryType: data.categoryType,
      icon: data.icon || CATEGORY_ICONS[data.categoryType] || "🎯",
      status: newStatus,
    };
    if (data.currentAmount !== undefined) {
      setFields.currentAmount = data.currentAmount;
    }

    const [updated] = await db.update(goalsTable).set(setFields).where(eq(goalsTable.id, id)).returning();

    if (!updated) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }

    const allocations = await db.select().from(surplusAllocationsTable).where(eq(surplusAllocationsTable.goalId, id));
    const intelligence = computeGoalIntelligence(updated, allocations);
    const accounts = updated.accountId
      ? await db.select().from(accountsTable).where(eq(accountsTable.id, updated.accountId))
      : [];

    res.json({
      ...updated,
      targetAmount: Number(updated.targetAmount ?? 0).toFixed(2),
      currentAmount: Number(updated.currentAmount ?? 0).toFixed(2),
      accountName: accounts.length > 0 ? accounts[0].name : null,
      ...intelligence,
    });
  } catch (e) {
    req.log.error({ err: e }, "Failed to update goal");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/goals/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(goalsTable).where(eq(goalsTable.id, id));
    res.status(204).send();
  } catch (e) {
    req.log.error({ err: e }, "Failed to delete goal");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/goals/waterfall", async (req, res) => {
  try {
    const allAccounts = await db.select().from(accountsTable);
    const bankAccounts = allAccounts.filter(a => a.type.toLowerCase() === "bank");
    const totalBankBalance = bankAccounts.reduce((s, a) => s + Number(a.currentBalance ?? 0), 0);

    const activeGoals = await db.select().from(goalsTable).where(eq(goalsTable.status, "Active"));
    const goalAllocations = activeGoals.map(g => ({
      goalId: g.id,
      goalName: g.name,
      allocated: Number(g.currentAmount ?? 0).toFixed(2),
    }));

    const totalAllocated = activeGoals.reduce((s, g) => s + Number(g.currentAmount ?? 0), 0);
    const remainingLiquidCash = totalBankBalance - totalAllocated;

    const expenseResult = await db
      .select({ total: sql<string>`COALESCE(SUM(${transactionsTable.amount}::numeric), 0)` })
      .from(transactionsTable)
      .where(sql`${transactionsTable.type} = 'Expense'`);

    const countResult = await db
      .select({ cnt: sql<string>`COUNT(DISTINCT to_char(${transactionsTable.date}::date, 'YYYY-MM'))` })
      .from(transactionsTable)
      .where(sql`${transactionsTable.type} = 'Expense'`);

    const totalExpenses = Number(expenseResult[0]?.total ?? 0);
    const monthCount = Math.max(1, Number(countResult[0]?.cnt ?? 1));
    const avgMonthlyLivingExpenses = totalExpenses / monthCount;
    const stressTest = remainingLiquidCash < avgMonthlyLivingExpenses;

    res.json({
      totalBankBalance: totalBankBalance.toFixed(2),
      goalAllocations,
      remainingLiquidCash: remainingLiquidCash.toFixed(2),
      avgMonthlyLivingExpenses: avgMonthlyLivingExpenses.toFixed(2),
      stressTest,
    });
  } catch (e) {
    req.log.error({ err: e }, "Failed to get waterfall");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/goals/:id/projection", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const goal = await db.select().from(goalsTable).where(eq(goalsTable.id, id));

    if (!goal.length) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }

    const g = goal[0];
    const allocations = await db.select().from(surplusAllocationsTable).where(eq(surplusAllocationsTable.goalId, id));
    const { velocity } = computeGoalIntelligence(g, allocations);

    const current = Number(g.currentAmount ?? 0);
    const target = Number(g.targetAmount ?? 0);
    const remaining = Math.max(0, target - current);

    let neededVelocity = 0;
    if (g.targetDate && remaining > 0) {
      const targetD = new Date(g.targetDate);
      const monthsLeft = Math.max(1, (targetD.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30));
      neededVelocity = remaining / monthsLeft;
    }

    const now = new Date();
    let y = now.getFullYear();
    let m = now.getMonth() + 1;

    const projection = [];
    for (let i = 0; i < 12; i++) {
      const projMonth = `${y}-${String(m).padStart(2, "0")}`;
      const projBalance = Math.min(current + velocity * i, target > 0 ? target : Infinity);
      const neededBalance = neededVelocity > 0
        ? Math.min(current + neededVelocity * i, target > 0 ? target : Infinity)
        : null;
      projection.push({
        month: projMonth,
        projectedBalance: projBalance.toFixed(2),
        neededBalance: neededBalance !== null ? neededBalance.toFixed(2) : null,
        targetAmount: target.toFixed(2),
      });
      m++;
      if (m > 12) { m = 1; y++; }
    }

    res.json(projection);
  } catch (e) {
    req.log.error({ err: e }, "Failed to get goal projection");
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
