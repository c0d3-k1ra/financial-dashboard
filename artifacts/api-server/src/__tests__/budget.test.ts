import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";
import type { AccountResponse, BudgetGoalResponse, BudgetAnalysisRow } from "../test/types";

describe("Budget API", () => {
  it("B-01: create budget goal", async () => {
    const res = await request(app).post("/api/budget-goals").send({ category: "Food", plannedAmount: "8000" });
    expect(res.status).toBe(200);
    const body = res.body as BudgetGoalResponse;
    expect(body.category).toBe("Food");
    expect(Number(body.plannedAmount)).toBe(8000);
  });

  it("B-02: upsert existing budget goal updates amount", async () => {
    await request(app).post("/api/budget-goals").send({ category: "Food", plannedAmount: "8000" });
    const res = await request(app).post("/api/budget-goals").send({ category: "Food", plannedAmount: "10000" });
    expect(res.status).toBe(200);
    const body = res.body as BudgetGoalResponse;
    expect(Number(body.plannedAmount)).toBe(10000);
  });

  it("B-03: list budget goals", async () => {
    await request(app).post("/api/budget-goals").send({ category: "Food", plannedAmount: "8000" });
    await request(app).post("/api/budget-goals").send({ category: "Travel", plannedAmount: "5000" });

    const res = await request(app).get("/api/budget-goals");
    const body = res.body as BudgetGoalResponse[];
    expect(body.length).toBe(2);
  });

  it("B-04: delete budget goal", async () => {
    const created = await request(app).post("/api/budget-goals").send({ category: "Temp", plannedAmount: "1000" });
    const createdBody = created.body as BudgetGoalResponse;
    const res = await request(app).delete(`/api/budget-goals/${createdBody.id}`);
    expect(res.status).toBe(204);
  });

  it("B-05: budget analysis shows under budget", async () => {
    const acc = await request(app).post("/api/accounts").send({ name: "BudgetBank", type: "bank", currentBalance: "50000" });
    const accBody = acc.body as AccountResponse;
    await request(app).post("/api/budget-goals").send({ category: "Food", plannedAmount: "10000" });
    await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "5000", description: "Food", category: "Food", type: "Expense", accountId: accBody.id,
    });

    const res = await request(app).get("/api/budget-analysis?month=2025-03");
    expect(res.status).toBe(200);
    const body = res.body as BudgetAnalysisRow[];
    const foodRow = body.find(r => r.category === "Food");
    expect(foodRow).toBeDefined();
    expect(Number(foodRow!.difference)).toBeGreaterThan(0);
    expect(foodRow!.overBudget).toBe(false);
  });

  it("B-06: budget analysis shows over budget", async () => {
    const acc = await request(app).post("/api/accounts").send({ name: "BudgetBank2", type: "bank", currentBalance: "50000" });
    const accBody = acc.body as AccountResponse;
    await request(app).post("/api/budget-goals").send({ category: "Food", plannedAmount: "3000" });
    await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "5000", description: "Food", category: "Food", type: "Expense", accountId: accBody.id,
    });

    const res = await request(app).get("/api/budget-analysis?month=2025-03");
    const body = res.body as BudgetAnalysisRow[];
    const foodRow = body.find(r => r.category === "Food");
    expect(Number(foodRow!.difference)).toBeLessThan(0);
    expect(foodRow!.overBudget).toBe(true);
  });

  it("B-07: budget analysis for month with no transactions", async () => {
    await request(app).post("/api/budget-goals").send({ category: "Food", plannedAmount: "8000" });

    const res = await request(app).get("/api/budget-analysis?month=2024-01");
    const body = res.body as BudgetAnalysisRow[];
    const foodRow = body.find(r => r.category === "Food");
    expect(foodRow!.actual).toBe("0.00");
    expect(foodRow!.overBudget).toBe(false);
  });
});
