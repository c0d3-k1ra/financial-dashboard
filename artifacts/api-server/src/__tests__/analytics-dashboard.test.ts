import { describe, it, expect } from "vitest";
import request from "supertest";
import { db, mockChain } from "../test/db-mock";
import app from "../app";

describe("Analytics API", () => {
  it("GET /analytics/spend-by-category returns data", async () => {
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ category: "Food", total: "3000" }]));
    const res = await request(app).get("/api/analytics/spend-by-category?month=2025-03");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("GET /analytics/spend-by-category with accountType=cc", async () => {
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([]));
    const res = await request(app).get("/api/analytics/spend-by-category?month=2025-03&accountType=cc");
    expect(res.status).toBe(200);
  });

  it("GET /analytics/spend-by-category with accountType=non_cc", async () => {
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([]));
    const res = await request(app).get("/api/analytics/spend-by-category?month=2025-03&accountType=non_cc");
    expect(res.status).toBe(200);
  });

  it("GET /analytics/spend-by-category rejects invalid month", async () => {
    const res = await request(app).get("/api/analytics/spend-by-category?month=bad");
    expect(res.status).toBe(400);
  });

  it("GET /analytics/spend-by-category rejects invalid accountType", async () => {
    const res = await request(app).get("/api/analytics/spend-by-category?month=2025-03&accountType=invalid");
    expect(res.status).toBe(400);
  });

  it("GET /analytics/spend-by-category filters zero totals", async () => {
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ category: "Food", total: "0" }]));
    const res = await request(app).get("/api/analytics/spend-by-category?month=2025-03");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("GET /analytics/category-trend returns data", async () => {
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ category: "Food", cycleIdx: "0", total: "3000" }]));
    const res = await request(app).get("/api/analytics/category-trend?month=2025-03");
    expect(res.status).toBe(200);
  });

  it("GET /analytics/category-trend rejects invalid month", async () => {
    const res = await request(app).get("/api/analytics/category-trend?month=bad");
    expect(res.status).toBe(400);
  });

  it("GET /analytics/category-trend filters zero spend categories", async () => {
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ category: "Travel", cycleIdx: "0", total: "0" }]));
    const res = await request(app).get("/api/analytics/category-trend?month=2025-03");
    expect(res.status).toBe(200);
  });

  it("GET /analytics/category-trend with null cycleIdx skipped", async () => {
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ category: "Food", cycleIdx: null, total: "500" }]));
    const res = await request(app).get("/api/analytics/category-trend?month=2025-03");
    expect(res.status).toBe(200);
  });

  it("GET /analytics/cc-dues returns data", async () => {
    db.select
      .mockReturnValueOnce(mockChain([
        { id: 1, name: "HDFC CC", type: "credit_card", currentBalance: "-10000", billingDueDay: 15, creditLimit: "100000", sharedLimitGroup: null },
      ]))
      .mockReturnValueOnce(mockChain([]));
    const res = await request(app).get("/api/analytics/cc-dues");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("HDFC CC");
  });

  it("GET /analytics/cc-dues with shared limit group", async () => {
    db.select
      .mockReturnValueOnce(mockChain([
        { id: 1, name: "CC1", type: "credit_card", currentBalance: "-5000", billingDueDay: 15, creditLimit: "100000", sharedLimitGroup: "shared1" },
        { id: 2, name: "CC2", type: "credit_card", currentBalance: "-3000", billingDueDay: 20, creditLimit: "100000", sharedLimitGroup: "shared1" },
      ]))
      .mockReturnValueOnce(mockChain([
        { toAccountId: 1, maxDate: "2025-03-01" },
      ]));
    const res = await request(app).get("/api/analytics/cc-dues");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it("GET /analytics/cc-dues with no cc accounts", async () => {
    const res = await request(app).get("/api/analytics/cc-dues");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("GET /analytics/cc-dues with no billing due day", async () => {
    db.select
      .mockReturnValueOnce(mockChain([
        { id: 1, name: "CC", type: "credit_card", currentBalance: "-5000", billingDueDay: null, creditLimit: "50000", sharedLimitGroup: null },
      ]));
    const res = await request(app).get("/api/analytics/cc-dues");
    expect(res.status).toBe(200);
    expect(res.body[0].daysUntilDue).toBeNull();
  });
});

describe("Dashboard API", () => {
  it("GET /dashboard/summary returns data", async () => {
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ total: "50000" }]))
      .mockReturnValueOnce(mockChain([{ total: "10000" }]))
      .mockReturnValueOnce(mockChain([{ total: "5000" }]))
      .mockReturnValueOnce(mockChain([{ total: "3000" }]))
      .mockReturnValueOnce(mockChain([{ total: "15000" }]))
      .mockReturnValueOnce(mockChain([{ id: 1, type: "bank", currentBalance: "200000", useInSurplus: true, emiAmount: null }]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Food", type: "Expense" }]))
      .mockReturnValueOnce(mockChain([{ categoryId: 1, plannedAmount: "5000" }]));
    const res = await request(app).get("/api/dashboard/summary?month=2025-03");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("bankBalance");
    expect(res.body).toHaveProperty("totalIncome");
    expect(res.body).toHaveProperty("totalExpenses");
    expect(res.body).toHaveProperty("monthlySurplus");
    expect(res.body).toHaveProperty("burnRate");
  });

  it("GET /dashboard/summary rejects invalid month", async () => {
    const res = await request(app).get("/api/dashboard/summary?month=bad");
    expect(res.status).toBe(400);
  });

  it("GET /dashboard/summary rejects missing month", async () => {
    const res = await request(app).get("/api/dashboard/summary");
    expect(res.status).toBe(400);
  });

  it("GET /dashboard/summary with cc and loan accounts", async () => {
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ total: "50000" }]))
      .mockReturnValueOnce(mockChain([{ total: "10000" }]))
      .mockReturnValueOnce(mockChain([{ total: "5000" }]))
      .mockReturnValueOnce(mockChain([{ total: "3000" }]))
      .mockReturnValueOnce(mockChain([{ total: "15000" }]))
      .mockReturnValueOnce(mockChain([
        { id: 1, type: "bank", currentBalance: "200000", useInSurplus: true, emiAmount: null },
        { id: 2, type: "credit_card", currentBalance: "-50000", useInSurplus: false, emiAmount: null },
        { id: 3, type: "loan", currentBalance: "-300000", useInSurplus: false, emiAmount: "10000", emiDay: 5, createdAt: new Date("2024-01-01") },
      ]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Food", type: "Expense" }]))
      .mockReturnValueOnce(mockChain([{ categoryId: 1, plannedAmount: "5000" }]));
    const res = await request(app).get("/api/dashboard/summary?month=2025-03");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("unpaidCcDues");
    expect(res.body).toHaveProperty("totalLoanOutstanding");
    expect(res.body).toHaveProperty("totalEmiDue");
  });

  it("GET /dashboard/summary with monthly config startingBalance", async () => {
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ month: "2025-03", startingBalance: "50000" }]))
      .mockReturnValueOnce(mockChain([{ total: null }]))
      .mockReturnValueOnce(mockChain([{ total: null }]))
      .mockReturnValueOnce(mockChain([{ total: null }]))
      .mockReturnValueOnce(mockChain([{ total: null }]))
      .mockReturnValueOnce(mockChain([{ total: null }]))
      .mockReturnValueOnce(mockChain([
        { id: 1, type: "bank", currentBalance: null, useInSurplus: true, emiAmount: null },
      ]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([]));
    const res = await request(app).get("/api/dashboard/summary?month=2025-03");
    expect(res.status).toBe(200);
    expect(res.body.startingBalance).toBe("50000.00");
    expect(res.body.burnRate).toBe(0);
  });

  it("GET /dashboard/summary with burnRate > 0", async () => {
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ total: "100000" }]))
      .mockReturnValueOnce(mockChain([{ total: "20000" }]))
      .mockReturnValueOnce(mockChain([{ total: "5000" }]))
      .mockReturnValueOnce(mockChain([{ total: "10000" }]))
      .mockReturnValueOnce(mockChain([{ total: "30000" }]))
      .mockReturnValueOnce(mockChain([
        { id: 1, type: "bank", currentBalance: "200000", useInSurplus: true, emiAmount: null },
      ]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Food", type: "Expense" }]))
      .mockReturnValueOnce(mockChain([{ categoryId: 1, plannedAmount: "25000" }]));
    const res = await request(app).get("/api/dashboard/summary?month=2025-03");
    expect(res.status).toBe(200);
    expect(Number(res.body.burnRate)).toBeGreaterThan(0);
  });

  it("GET /dashboard/monthly-trend returns data", async () => {
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([
        { cycleIdx: "0", type: "Income", total: "50000" },
        { cycleIdx: "0", type: "Expense", total: "30000" },
      ]));
    const res = await request(app).get("/api/dashboard/monthly-trend");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(6);
  });

  it("GET /dashboard/monthly-trend with null cycleIdx", async () => {
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ cycleIdx: null, type: "Income", total: "1000" }]));
    const res = await request(app).get("/api/dashboard/monthly-trend");
    expect(res.status).toBe(200);
  });

  it("GET /billing-cycles returns list", async () => {
    db.select.mockReturnValueOnce(mockChain([]));
    const res = await request(app).get("/api/billing-cycles");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(12);
    expect(res.body[0]).toHaveProperty("label");
    expect(res.body[0]).toHaveProperty("startDate");
  });
});

describe("Trends API", () => {
  it("GET /trends/cc-spend returns data", async () => {
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ cycleIdx: "0", total: "5000" }]));
    const res = await request(app).get("/api/trends/cc-spend?month=2025-03");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(6);
  });

  it("GET /trends/cc-spend rejects invalid month", async () => {
    const res = await request(app).get("/api/trends/cc-spend?month=bad");
    expect(res.status).toBe(400);
  });

  it("GET /trends/cc-spend with null cycleIdx", async () => {
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ cycleIdx: null, total: "1000" }]));
    const res = await request(app).get("/api/trends/cc-spend?month=2025-03");
    expect(res.status).toBe(200);
  });

  it("GET /trends/living-expenses returns data", async () => {
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ cycleIdx: "0", total: "15000" }]));
    const res = await request(app).get("/api/trends/living-expenses?month=2025-03");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(6);
  });

  it("GET /trends/living-expenses rejects invalid month", async () => {
    const res = await request(app).get("/api/trends/living-expenses?month=bad");
    expect(res.status).toBe(400);
  });
});
