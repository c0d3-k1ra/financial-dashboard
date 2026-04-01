import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";
import type {
  AccountResponse, DashboardSummary, MonthlyTrendPoint,
  CycleDataPoint, SpendByCategoryRow, CcDueItem, BillingCycleItem, CategoryTrendItem
} from "../test/types";

async function createAccount(name: string, type = "bank", balance = "100000", extra: Record<string, string | number> = {}): Promise<AccountResponse> {
  const res = await request(app).post("/api/accounts").send({ name, type, currentBalance: balance, ...extra });
  return res.body as AccountResponse;
}

describe("Dashboard & Analytics API", () => {
  it("D-01: dashboard summary with healthy cash", async () => {
    const acc = await createAccount("DashBank1", "bank", "200000");
    await request(app).post("/api/monthly-config").send({ month: "2025-03", startingBalance: "200000" });
    await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "80000", description: "Salary", category: "Paycheck (Salary)", type: "Income", accountId: acc.id,
    });
    await request(app).post("/api/transactions").send({
      date: "2025-03-05", amount: "30000", description: "Expenses", category: "Living Expenses", type: "Expense", accountId: acc.id,
    });

    const res = await request(app).get("/api/dashboard/summary?month=2025-03");
    expect(res.status).toBe(200);
    const body = res.body as DashboardSummary;
    expect(Number(body.totalIncome)).toBe(80000);
    expect(Number(body.totalExpenses)).toBe(30000);
    expect(Number(body.monthlySurplus)).toBe(50000);
  });

  it("D-02: dashboard summary with low cash", async () => {
    const acc = await createAccount("DashBank2", "bank", "5000");
    await request(app).post("/api/monthly-config").send({ month: "2025-03", startingBalance: "5000" });
    await request(app).post("/api/transactions").send({
      date: "2025-03-05", amount: "4000", description: "Expenses", category: "Living Expenses", type: "Expense", accountId: acc.id,
    });

    const res = await request(app).get("/api/dashboard/summary?month=2025-03");
    const body = res.body as DashboardSummary;
    expect(Number(body.endBalance)).toBe(1000);
  });

  it("D-03: net liquidity calculation", async () => {
    const bank = await createAccount("DashBank3", "bank", "100000");
    await request(app).post("/api/monthly-config").send({ month: "2025-03", startingBalance: "100000" });
    await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "20000", description: "CC bill", category: "Credit Card (CC)", type: "Expense", accountId: bank.id,
    });

    const res = await request(app).get("/api/dashboard/summary?month=2025-03");
    const body = res.body as DashboardSummary;
    expect(Number(body.unpaidCcDues)).toBe(20000);
    expect(Number(body.netLiquidity)).toBe(Number(body.endBalance) - 20000);
  });

  it("D-04: burn rate under 100%", async () => {
    const acc = await createAccount("DashBank4", "bank", "100000");
    const catRes = await request(app).post("/api/categories").send({ name: "Living Expenses", type: "Expense" });
    const catId = (catRes.body as { id: number }).id;
    await request(app).post("/api/budget-goals").send({ categoryId: catId, plannedAmount: "30000" });
    await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "20000", description: "Living", category: "Living Expenses", type: "Expense", accountId: acc.id,
    });

    const res = await request(app).get("/api/dashboard/summary?month=2025-03");
    const body = res.body as DashboardSummary;
    expect(body.burnRate).toBeLessThan(100);
    expect(body.burnRate).toBeGreaterThan(0);
  });

  it("D-05: burn rate over 100%", async () => {
    const acc = await createAccount("DashBank5", "bank", "100000");
    const catRes = await request(app).post("/api/categories").send({ name: "Living Expenses", type: "Expense" });
    const catId = (catRes.body as { id: number }).id;
    await request(app).post("/api/budget-goals").send({ categoryId: catId, plannedAmount: "10000" });
    await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "15000", description: "Living", category: "Living Expenses", type: "Expense", accountId: acc.id,
    });

    const res = await request(app).get("/api/dashboard/summary?month=2025-03");
    const body = res.body as DashboardSummary;
    expect(body.burnRate).toBeGreaterThan(100);
  });

  it("D-06: burn rate zero when no planned budget", async () => {
    await createAccount("DashBank6", "bank", "100000");
    const res = await request(app).get("/api/dashboard/summary?month=2025-03");
    const body = res.body as DashboardSummary;
    expect(body.burnRate).toBe(0);
  });

  it("D-07: monthly trend returns 6 data points", async () => {
    const res = await request(app).get("/api/dashboard/monthly-trend");
    expect(res.status).toBe(200);
    const body = res.body as MonthlyTrendPoint[];
    expect(body.length).toBe(6);
    for (const point of body) {
      expect(point).toHaveProperty("month");
      expect(point).toHaveProperty("income");
      expect(point).toHaveProperty("expenses");
    }
  });

  it("D-08: cc spend trend returns data", async () => {
    const res = await request(app).get("/api/trends/cc-spend?month=2025-03");
    expect(res.status).toBe(200);
    const body = res.body as CycleDataPoint[];
    expect(body.length).toBe(6);
  });

  it("D-09: living expense trend returns data", async () => {
    const res = await request(app).get("/api/trends/living-expenses?month=2025-03");
    expect(res.status).toBe(200);
    const body = res.body as CycleDataPoint[];
    expect(body.length).toBe(6);
  });

  it("D-10: spend by category returns grouped data", async () => {
    const acc = await createAccount("SpendCatBank");
    await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "5000", description: "Food", category: "Food", type: "Expense", accountId: acc.id,
    });
    await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "2000", description: "Transport", category: "Transportation", type: "Expense", accountId: acc.id,
    });

    const res = await request(app).get("/api/analytics/spend-by-category?month=2025-03");
    expect(res.status).toBe(200);
    const body = res.body as SpendByCategoryRow[];
    expect(body.length).toBeGreaterThanOrEqual(2);
    expect(body[0]).toHaveProperty("category");
    expect(body[0]).toHaveProperty("total");
  });

  it("D-11: CC dues listing", async () => {
    await createAccount("ICICI CC", "credit_card", "-25000", { billingDueDay: 15, creditLimit: "200000" });

    const res = await request(app).get("/api/analytics/cc-dues");
    expect(res.status).toBe(200);
    const body = res.body as CcDueItem[];
    expect(body.length).toBe(1);
    expect(body[0]).toHaveProperty("outstanding");
    expect(body[0]).toHaveProperty("daysUntilDue");
    expect(body[0].daysUntilDue).toBeGreaterThanOrEqual(0);
  });

  it("D-12: CC dues urgency with small daysUntilDue", async () => {
    const today = new Date();
    const dueSoon = ((today.getDate() + 3) % 28) + 1;
    await createAccount("Urgent CC", "credit_card", "-10000", { billingDueDay: dueSoon, creditLimit: "100000" });

    const res = await request(app).get("/api/analytics/cc-dues");
    const body = res.body as CcDueItem[];
    expect(body.length).toBe(1);
    expect(body[0].daysUntilDue).toBeLessThanOrEqual(31);
  });

  it("D-13: billing cycles endpoint returns data", async () => {
    const res = await request(app).get("/api/billing-cycles");
    expect(res.status).toBe(200);
    const body = res.body as BillingCycleItem[];
    expect(body.length).toBe(12);
    for (const cycle of body) {
      expect(cycle).toHaveProperty("label");
      expect(cycle).toHaveProperty("startDate");
      expect(cycle).toHaveProperty("endDate");
    }
  });

  it("D-14: dashboard summary with invalid month format", async () => {
    const res = await request(app).get("/api/dashboard/summary?month=invalid");
    expect(res.status).toBe(400);
  });

  it("D-15: category trend returns data", async () => {
    const acc = await createAccount("TrendBank");
    await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "5000", description: "Food", category: "Food", type: "Expense", accountId: acc.id,
    });

    const res = await request(app).get("/api/analytics/category-trend?month=2025-03");
    expect(res.status).toBe(200);
    const body = res.body as CategoryTrendItem[];
    expect(Array.isArray(body)).toBe(true);
  });

  it("D-16: cc spend trend invalid month", async () => {
    const res = await request(app).get("/api/trends/cc-spend?month=bad");
    expect(res.status).toBe(400);
  });

  it("D-17: living expense trend invalid month", async () => {
    const res = await request(app).get("/api/trends/living-expenses?month=bad");
    expect(res.status).toBe(400);
  });
});
