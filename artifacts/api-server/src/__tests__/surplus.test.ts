import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";
import type { AccountResponse, GoalResponse, SurplusMonthlyResponse, DistributeResult, AllocationResponse, UndoSurplusResult, CanUndoSurplusResult } from "../test/types";

async function createAccount(name: string, balance = "100000", extra: Record<string, unknown> = {}): Promise<AccountResponse> {
  const res = await request(app).post("/api/accounts").send({ name, type: "bank", currentBalance: balance, ...extra });
  return res.body as AccountResponse;
}

async function createGoal(name: string, accountId: number, target = "100000"): Promise<GoalResponse> {
  const res = await request(app).post("/api/goals").send({
    name, targetAmount: target, accountId, categoryType: "General",
  });
  return res.body as GoalResponse;
}

describe("Surplus API", () => {
  it("S-01: monthly surplus calculation (positive)", async () => {
    const acc = await createAccount("SurplusBank1", "150000", { useInSurplus: true });

    const res = await request(app).get("/api/surplus/monthly?month=2025-03");
    expect(res.status).toBe(200);
    const body = res.body as SurplusMonthlyResponse;
    expect(Number(body.surplus)).toBe(150000);
  });

  it("S-02: monthly surplus calculation (zero)", async () => {
    const acc = await createAccount("SurplusBank2", "20000", { useInSurplus: true });
    await request(app).post("/api/accounts").send({
      name: "SurplusCc2", type: "credit_card", currentBalance: "-20000",
      billingDueDay: 15, creditLimit: "100000",
    });

    const res = await request(app).get("/api/surplus/monthly?month=2025-03");
    const body = res.body as SurplusMonthlyResponse;
    expect(Number(body.surplus)).toBe(0);
  });

  it("S-03: monthly surplus calculation (negative)", async () => {
    const acc = await createAccount("SurplusBank3", "10000", { useInSurplus: true });
    await request(app).post("/api/accounts").send({
      name: "SurplusCc3", type: "credit_card", currentBalance: "-30000",
      billingDueDay: 15, creditLimit: "100000",
    });

    const res = await request(app).get("/api/surplus/monthly?month=2025-03");
    const body = res.body as SurplusMonthlyResponse;
    expect(Number(body.surplus)).toBeLessThan(0);
  });

  it("S-04: distribute surplus across multiple goals", async () => {
    const acc = await createAccount("DistBank1", "200000", { useInSurplus: true });
    const goal1 = await createGoal("Emergency", acc.id, "300000");
    const goal2 = await createGoal("Travel", acc.id, "100000");

    const res = await request(app).post("/api/surplus/distribute").send({
      month: "2025-03",
      sourceAccountId: acc.id,
      allocations: [
        { goalId: goal1.id, amount: "20000" },
        { goalId: goal2.id, amount: "10000" },
      ],
    });
    expect(res.status).toBe(200);
    const body = res.body as DistributeResult;
    expect(body.success).toBe(true);
    expect(Number(body.allocatedTotal)).toBe(30000);
  });

  it("S-05: distribute when zero surplus returns error", async () => {
    const acc = await createAccount("DistBank2", "200000");
    const goal = await createGoal("Goal", acc.id);

    const res = await request(app).post("/api/surplus/distribute").send({
      month: "2025-03",
      sourceAccountId: acc.id,
      allocations: [{ goalId: goal.id, amount: "5000" }],
    });
    expect(res.status).toBe(400);
  });

  it("S-06: distribute when negative surplus returns error", async () => {
    const acc = await createAccount("DistBank3", "200000");
    const goal = await createGoal("Goal2", acc.id);

    await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "10000", description: "Salary", category: "Paycheck (Salary)", type: "Income", accountId: acc.id,
    });
    await request(app).post("/api/transactions").send({
      date: "2025-03-05", amount: "20000", description: "Expenses", category: "Living Expenses", type: "Expense", accountId: acc.id,
    });

    const res = await request(app).post("/api/surplus/distribute").send({
      month: "2025-03",
      sourceAccountId: acc.id,
      allocations: [{ goalId: goal.id, amount: "5000" }],
    });
    expect(res.status).toBe(400);
  });

  it("S-07: distribute with no allocations returns error", async () => {
    const acc = await createAccount("DistBank4");
    const res = await request(app).post("/api/surplus/distribute").send({
      month: "2025-03",
      sourceAccountId: acc.id,
      allocations: [],
    });
    expect(res.status).toBe(400);
  });

  it("S-08: single goal distribution", async () => {
    const acc = await createAccount("DistBank5", "200000", { useInSurplus: true });
    const goal = await createGoal("SingleGoal", acc.id, "100000");

    const res = await request(app).post("/api/surplus/distribute").send({
      month: "2025-03",
      sourceAccountId: acc.id,
      allocations: [{ goalId: goal.id, amount: "20000" }],
    });
    expect(res.status).toBe(200);
    const body = res.body as DistributeResult;
    expect(body.success).toBe(true);
    expect(Number(body.allocatedTotal)).toBe(20000);
  });

  it("S-09: surplus allocation updates goal currentAmount", async () => {
    const acc = await createAccount("DistBank6", "200000", { useInSurplus: true });
    const goal = await createGoal("TrackGoal", acc.id, "100000");

    await request(app).post("/api/surplus/distribute").send({
      month: "2025-03",
      sourceAccountId: acc.id,
      allocations: [{ goalId: goal.id, amount: "15000" }],
    });

    const goals = await request(app).get("/api/goals");
    const updatedGoal = (goals.body as GoalResponse[]).find(g => g.id === goal.id);
    expect(Number(updatedGoal!.currentAmount)).toBe(15000);
  });

  it("S-10: distribute exceeding surplus returns error", async () => {
    const acc = await createAccount("DistBank7", "200000", { useInSurplus: true });
    const goal = await createGoal("BigGoal", acc.id, "1000000");

    const res = await request(app).post("/api/surplus/distribute").send({
      month: "2025-03",
      sourceAccountId: acc.id,
      allocations: [{ goalId: goal.id, amount: "300000" }],
    });
    expect(res.status).toBe(400);
  });

  it("S-11: surplus distribution to different account creates transfer", async () => {
    const sourceAcc = await createAccount("SourceBank", "200000", { useInSurplus: true });
    const destAcc = await createAccount("DestBank", "0");
    const goal = await createGoal("TransferGoal", destAcc.id, "100000");

    const res = await request(app).post("/api/surplus/distribute").send({
      month: "2025-03",
      sourceAccountId: sourceAcc.id,
      allocations: [{ goalId: goal.id, amount: "20000" }],
    });
    expect(res.status).toBe(200);
    const body = res.body as DistributeResult;
    expect(body.transfers).toBeGreaterThan(0);
  });

  it("S-12: allocation history listing", async () => {
    const acc = await createAccount("AllocBank", "200000", { useInSurplus: true });
    const goal = await createGoal("HistoryGoal", acc.id, "100000");

    await request(app).post("/api/surplus/distribute").send({
      month: "2025-03",
      sourceAccountId: acc.id,
      allocations: [{ goalId: goal.id, amount: "10000" }],
    });

    const res = await request(app).get("/api/surplus/allocations");
    expect(res.status).toBe(200);
    const body = res.body as AllocationResponse[];
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toHaveProperty("goalName");
    expect(body[0]).toHaveProperty("amount");
    expect(body[0]).toHaveProperty("month");
  });

  it("S-13: invalid month format returns error", async () => {
    const res = await request(app).get("/api/surplus/monthly?month=invalid");
    expect(res.status).toBe(400);
  });

  it("S-14: can-undo returns false when no distribution exists", async () => {
    const res = await request(app).get("/api/surplus/can-undo?month=2099-01");
    expect(res.status).toBe(200);
    const body = res.body as CanUndoSurplusResult;
    expect(body.canUndo).toBe(false);
    expect(body.month).toBe("2099-01");
  });

  it("S-15: undo fails when no distribution exists", async () => {
    const res = await request(app).post("/api/surplus/undo").send({ month: "2099-01" });
    expect(res.status).toBe(400);
  });

  it("S-16: undo reverses distribution and restores goal amounts", async () => {
    const acc = await createAccount("UndoBank1", "500000", { useInSurplus: true });
    const goal = await createGoal("UndoGoal1", acc.id, "100000");

    await request(app).post("/api/surplus/distribute").send({
      month: "2098-06",
      sourceAccountId: acc.id,
      allocations: [{ goalId: goal.id, amount: "50000" }],
    });

    const goalsAfterDist = await request(app).get("/api/goals");
    const goalAfterDist = (goalsAfterDist.body as GoalResponse[]).find(g => g.id === goal.id);
    expect(Number(goalAfterDist!.currentAmount)).toBe(50000);

    const canUndoRes = await request(app).get("/api/surplus/can-undo?month=2098-06");
    const canUndoBody = canUndoRes.body as CanUndoSurplusResult;
    expect(canUndoBody.canUndo).toBe(true);
    expect(canUndoBody.allocations).toHaveLength(1);
    expect(Number(canUndoBody.allocations![0].amount)).toBe(50000);

    const undoRes = await request(app).post("/api/surplus/undo").send({ month: "2098-06" });
    expect(undoRes.status).toBe(200);
    const undoBody = undoRes.body as UndoSurplusResult;
    expect(undoBody.success).toBe(true);
    expect(undoBody.deletedAllocations).toBe(1);
    expect(undoBody.revertedGoals).toBe(1);

    const goalsAfterUndo = await request(app).get("/api/goals");
    const goalAfterUndo = (goalsAfterUndo.body as GoalResponse[]).find(g => g.id === goal.id);
    expect(Number(goalAfterUndo!.currentAmount)).toBe(0);

    const allocRes = await request(app).get("/api/surplus/allocations");
    const remaining = (allocRes.body as AllocationResponse[]).filter(a => a.month === "2098-06" && a.goalId === goal.id);
    expect(remaining).toHaveLength(0);
  });

  it("S-17: undo with cross-account transfer reverses balances", async () => {
    const sourceAcc = await createAccount("UndoSource2", "500000", { useInSurplus: true });
    const destAcc = await createAccount("UndoDest2", "0");
    const goal = await createGoal("UndoTransferGoal", destAcc.id, "100000");

    const distRes = await request(app).post("/api/surplus/distribute").send({
      month: "2098-07",
      sourceAccountId: sourceAcc.id,
      allocations: [{ goalId: goal.id, amount: "30000" }],
    });
    expect(distRes.status).toBe(200);
    expect((distRes.body as DistributeResult).transfers).toBe(1);

    const canUndoRes = await request(app).get("/api/surplus/can-undo?month=2098-07");
    expect((canUndoRes.body as CanUndoSurplusResult).transferCount).toBe(1);

    const accsBeforeUndo = await request(app).get("/api/accounts");
    const srcBefore = (accsBeforeUndo.body as AccountResponse[]).find(a => a.id === sourceAcc.id);
    const dstBefore = (accsBeforeUndo.body as AccountResponse[]).find(a => a.id === destAcc.id);

    const undoRes = await request(app).post("/api/surplus/undo").send({ month: "2098-07" });
    expect(undoRes.status).toBe(200);
    expect((undoRes.body as UndoSurplusResult).deletedTransfers).toBe(1);

    const accsAfterUndo = await request(app).get("/api/accounts");
    const srcAfter = (accsAfterUndo.body as AccountResponse[]).find(a => a.id === sourceAcc.id);
    const dstAfter = (accsAfterUndo.body as AccountResponse[]).find(a => a.id === destAcc.id);

    expect(Number(srcAfter!.currentBalance)).toBe(Number(srcBefore!.currentBalance) + 30000);
    expect(Number(dstAfter!.currentBalance)).toBe(Number(dstBefore!.currentBalance) - 30000);
  });

  it("S-18: undo reverts achieved status back to active", async () => {
    const acc = await createAccount("UndoAchieveBank", "500000", { useInSurplus: true });
    const goal = await createGoal("UndoSmallGoal", acc.id, "10000");

    await request(app).post("/api/surplus/distribute").send({
      month: "2098-08",
      sourceAccountId: acc.id,
      allocations: [{ goalId: goal.id, amount: "15000" }],
    });

    const goalsAfterDist = await request(app).get("/api/goals");
    const achieved = (goalsAfterDist.body as GoalResponse[]).find(g => g.id === goal.id);
    expect(achieved!.status).toBe("Achieved");

    await request(app).post("/api/surplus/undo").send({ month: "2098-08" });

    const goalsAfterUndo = await request(app).get("/api/goals");
    const reverted = (goalsAfterUndo.body as GoalResponse[]).find(g => g.id === goal.id);
    expect(reverted!.status).toBe("Active");
  });

  it("S-19: can-undo returns false after undo is performed", async () => {
    const acc = await createAccount("UndoCheckBank", "500000", { useInSurplus: true });
    const goal = await createGoal("UndoCheckGoal", acc.id, "100000");

    await request(app).post("/api/surplus/distribute").send({
      month: "2098-09",
      sourceAccountId: acc.id,
      allocations: [{ goalId: goal.id, amount: "10000" }],
    });

    const canUndo1 = await request(app).get("/api/surplus/can-undo?month=2098-09");
    expect((canUndo1.body as CanUndoSurplusResult).canUndo).toBe(true);

    await request(app).post("/api/surplus/undo").send({ month: "2098-09" });

    const canUndo2 = await request(app).get("/api/surplus/can-undo?month=2098-09");
    expect((canUndo2.body as CanUndoSurplusResult).canUndo).toBe(false);
  });

  it("S-20: can-undo invalid month returns error", async () => {
    const res = await request(app).get("/api/surplus/can-undo?month=bad");
    expect(res.status).toBe(400);
  });
});
