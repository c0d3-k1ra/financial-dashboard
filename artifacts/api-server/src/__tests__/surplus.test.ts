import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";
import type { AccountResponse, GoalResponse, SurplusMonthlyResponse, DistributeResult, AllocationResponse } from "../test/types";

async function createAccount(name: string, balance = "100000"): Promise<AccountResponse> {
  const res = await request(app).post("/api/accounts").send({ name, type: "bank", currentBalance: balance });
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
    const acc = await createAccount("SurplusBank1");
    await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "80000", description: "Salary", category: "Paycheck (Salary)", type: "Income", accountId: acc.id,
    });
    await request(app).post("/api/transactions").send({
      date: "2025-03-05", amount: "30000", description: "Rent", category: "Living Expenses", type: "Expense", accountId: acc.id,
    });

    const res = await request(app).get("/api/surplus/monthly?month=2025-03");
    expect(res.status).toBe(200);
    const body = res.body as SurplusMonthlyResponse;
    expect(Number(body.surplus)).toBe(50000);
    expect(Number(body.income)).toBe(80000);
    expect(Number(body.expenses)).toBe(30000);
  });

  it("S-02: monthly surplus calculation (zero)", async () => {
    const acc = await createAccount("SurplusBank2");
    await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "50000", description: "Salary", category: "Paycheck (Salary)", type: "Income", accountId: acc.id,
    });
    await request(app).post("/api/transactions").send({
      date: "2025-03-05", amount: "50000", description: "All expenses", category: "Living Expenses", type: "Expense", accountId: acc.id,
    });

    const res = await request(app).get("/api/surplus/monthly?month=2025-03");
    const body = res.body as SurplusMonthlyResponse;
    expect(Number(body.surplus)).toBe(0);
  });

  it("S-03: monthly surplus calculation (negative)", async () => {
    const acc = await createAccount("SurplusBank3");
    await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "30000", description: "Salary", category: "Paycheck (Salary)", type: "Income", accountId: acc.id,
    });
    await request(app).post("/api/transactions").send({
      date: "2025-03-05", amount: "50000", description: "Expenses", category: "Living Expenses", type: "Expense", accountId: acc.id,
    });

    const res = await request(app).get("/api/surplus/monthly?month=2025-03");
    const body = res.body as SurplusMonthlyResponse;
    expect(Number(body.surplus)).toBeLessThan(0);
  });

  it("S-04: distribute surplus across multiple goals", async () => {
    const acc = await createAccount("DistBank1", "200000");
    const goal1 = await createGoal("Emergency", acc.id, "300000");
    const goal2 = await createGoal("Travel", acc.id, "100000");

    await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "100000", description: "Salary", category: "Paycheck (Salary)", type: "Income", accountId: acc.id,
    });

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
    const acc = await createAccount("DistBank5", "200000");
    const goal = await createGoal("SingleGoal", acc.id, "100000");

    await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "80000", description: "Salary", category: "Paycheck (Salary)", type: "Income", accountId: acc.id,
    });

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
    const acc = await createAccount("DistBank6", "200000");
    const goal = await createGoal("TrackGoal", acc.id, "100000");

    await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "80000", description: "Salary", category: "Paycheck (Salary)", type: "Income", accountId: acc.id,
    });

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
    const acc = await createAccount("DistBank7", "200000");
    const goal = await createGoal("BigGoal", acc.id, "1000000");

    await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "50000", description: "Salary", category: "Paycheck (Salary)", type: "Income", accountId: acc.id,
    });

    const res = await request(app).post("/api/surplus/distribute").send({
      month: "2025-03",
      sourceAccountId: acc.id,
      allocations: [{ goalId: goal.id, amount: "60000" }],
    });
    expect(res.status).toBe(400);
  });

  it("S-11: surplus distribution to different account creates transfer", async () => {
    const sourceAcc = await createAccount("SourceBank", "200000");
    const destAcc = await createAccount("DestBank", "0");
    const goal = await createGoal("TransferGoal", destAcc.id, "100000");

    await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "80000", description: "Salary", category: "Paycheck (Salary)", type: "Income", accountId: sourceAcc.id,
    });

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
    const acc = await createAccount("AllocBank", "200000");
    const goal = await createGoal("HistoryGoal", acc.id, "100000");

    await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "80000", description: "Salary", category: "Paycheck (Salary)", type: "Income", accountId: acc.id,
    });

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
});
