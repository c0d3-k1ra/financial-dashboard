import { Router, type IRouter } from "express";
import { eq, sql, and, ne } from "drizzle-orm";
import { db, goalsTable, accountsTable, surplusAllocationsTable, transactionsTable } from "@workspace/db";
import { CreateGoalBody, UpdateGoalBody } from "@workspace/api-zod";
import { computeGoalIntelligence } from "../lib/goal-intelligence";
import { getAppSettings, getCurrencySymbol } from "../lib/settings-helper";
import { parseIntParam } from "../lib/parse-params";
import { asyncHandler } from "../lib/async-handler";

const router: IRouter = Router();

async function validateAccountBalance(
  accountId: number,
  newGoalAmount: number,
  excludeGoalId?: number,
): Promise<{ valid: boolean; error?: string }> {
  const { currencyCode } = await getAppSettings();
  const cs = getCurrencySymbol(currencyCode);
  const account = await db.select().from(accountsTable).where(eq(accountsTable.id, accountId));
  if (!account.length) {
    return { valid: false, error: "Funding account not found." };
  }

  const accountBalance = Number(account[0].currentBalance ?? 0);

  const existingGoals = await db
    .select({ currentAmount: goalsTable.currentAmount })
    .from(goalsTable)
    .where(
      excludeGoalId
        ? and(eq(goalsTable.accountId, accountId), ne(goalsTable.id, excludeGoalId), ne(goalsTable.status, "Achieved"))
        : and(eq(goalsTable.accountId, accountId), ne(goalsTable.status, "Achieved")),
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

const CATEGORY_ICONS: Record<string, string> = {
  Emergency: "🛡️",
  Debt: "💳",
  Travel: "✈️",
  Purchase: "🛍️",
  General: "🎯",
};

router.get("/goals", asyncHandler(async (req, res) => {
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
}));

router.post("/goals", asyncHandler(async (req, res) => {
  const data = CreateGoalBody.parse(req.body);
  const icon = data.icon || CATEGORY_ICONS[data.categoryType] || "🎯";

  if (data.accountId) {
    const validation = await validateAccountBalance(data.accountId, 0);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }
  }

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
}));

router.put("/goals/:id", asyncHandler(async (req, res) => {
  const id = parseIntParam(req.params.id, "id");
  const data = UpdateGoalBody.parse(req.body);

  const existing = await db.select().from(goalsTable).where(eq(goalsTable.id, id));
  if (!existing.length) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }
  const currentAmt = Number(data.currentAmount ?? existing[0].currentAmount ?? 0);
  const targetAmt = Number(data.targetAmount);

  const effectiveAccountId = data.accountId ?? existing[0].accountId;
  const oldCurrentAmt = Number(existing[0].currentAmount ?? 0);
  const accountChanged = data.accountId !== undefined && data.accountId !== existing[0].accountId;
  const amountIncreased = currentAmt > oldCurrentAmt;

  if (effectiveAccountId && (accountChanged || amountIncreased)) {
    const validation = await validateAccountBalance(effectiveAccountId, currentAmt, id);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }
  }

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
}));

router.delete("/goals/:id", asyncHandler(async (req, res) => {
  const id = parseIntParam(req.params.id, "id");

  const [linkedAllocations] = await db
    .select({ count: sql<number>`count(*)` })
    .from(surplusAllocationsTable)
    .where(eq(surplusAllocationsTable.goalId, id));

  if (Number(linkedAllocations.count) > 0) {
    res.status(409).json({
      error: `Cannot delete goal: ${linkedAllocations.count} surplus allocation(s) are linked to it. Remove them first.`,
    });
    return;
  }

  await db.delete(goalsTable).where(eq(goalsTable.id, id));
  res.status(204).send();
}));

router.get("/goals/waterfall", asyncHandler(async (req, res) => {
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
}));

router.get("/goals/:id/projection", asyncHandler(async (req, res) => {
  const id = parseIntParam(req.params.id, "id");
  const goal = await db.select().from(goalsTable).where(eq(goalsTable.id, id));

  if (!goal.length) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  const g = goal[0];
  const allocations = await db
    .select()
    .from(surplusAllocationsTable)
    .where(eq(surplusAllocationsTable.goalId, id));
  const { velocity } = computeGoalIntelligence(g, allocations);

  const current = Number(g.currentAmount ?? 0);
  const target = Number(g.targetAmount ?? 0);
  const remaining = Math.max(0, target - current);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const historyByMonth = new Map<string, number>();
  allocations
    .sort((a, b) => a.month.localeCompare(b.month))
    .forEach(a => {
      historyByMonth.set(a.month, (historyByMonth.get(a.month) ?? 0) + Number(a.amount));
    });

  const historyData: { month: string; actual: number }[] = [];
  let cumulative = 0;
  const sortedMonths = [...historyByMonth.keys()].sort();
  for (const month of sortedMonths) {
    cumulative += historyByMonth.get(month)!;
    historyData.push({ month, actual: Math.round(cumulative * 100) / 100 });
  }

  if (historyData.length === 0 || historyData[historyData.length - 1].month !== currentMonth) {
    historyData.push({ month: currentMonth, actual: current });
  }

  let futureMonths = 12;
  if (g.targetDate && remaining > 0) {
    const targetD = new Date(g.targetDate);
    const diffMs = targetD.getTime() - now.getTime();
    const monthsToTarget = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24 * 30)));
    futureMonths = Math.max(12, monthsToTarget + 1);
  }

  const projectionData: { month: string; currentPace: number; neededPace: number | null }[] = [];

  let neededVelocity: number | null = null;
  if (g.targetDate && remaining > 0) {
    const targetD = new Date(g.targetDate);
    const monthsLeft = Math.max(1, Math.round((targetD.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)));
    neededVelocity = remaining / monthsLeft;
  }

  let py = now.getFullYear();
  let pm = now.getMonth() + 1;
  for (let i = 0; i < futureMonths; i++) {
    const projMonth = `${py}-${String(pm).padStart(2, "0")}`;
    const paceBalance = Math.min(current + velocity * i, target > 0 ? target : Infinity);
    const neededBalance = neededVelocity !== null
      ? Math.min(current + neededVelocity * i, target > 0 ? target : Infinity)
      : null;

    projectionData.push({
      month: projMonth,
      currentPace: Math.round(paceBalance * 100) / 100,
      neededPace: neededBalance !== null ? Math.round(neededBalance * 100) / 100 : null,
    });
    pm++;
    if (pm > 12) { pm = 1; py++; }
  }

  const allMonths = new Set<string>();
  historyData.forEach(h => allMonths.add(h.month));
  projectionData.forEach(p => allMonths.add(p.month));

  const historyMap = new Map(historyData.map(h => [h.month, h.actual]));
  const projMap = new Map(projectionData.map(p => [p.month, p]));

  const combined = [...allMonths].sort().map(month => ({
    month,
    actual: historyMap.get(month) ?? null,
    currentPace: projMap.get(month)?.currentPace ?? null,
    neededPace: projMap.get(month)?.neededPace ?? null,
    targetAmount: target,
  }));

  res.json(combined);
}));

export default router;
