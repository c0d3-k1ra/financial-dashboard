import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";
import type { AccountResponse, GoalResponse, WaterfallResponse, ProjectionPoint } from "../test/types";

async function createAccount(name: string, balance = "100000"): Promise<AccountResponse> {
  const res = await request(app).post("/api/accounts").send({ name, type: "bank", currentBalance: balance });
  return res.body as AccountResponse;
}

describe("Goals API", () => {
  it("G-01: create a goal", async () => {
    const acc = await createAccount("GoalBank1");
    const res = await request(app).post("/api/goals").send({
      name: "Emergency Fund", targetAmount: "300000", accountId: acc.id, categoryType: "Emergency",
    });
    expect(res.status).toBe(201);
    const body = res.body as GoalResponse;
    expect(body.name).toBe("Emergency Fund");
    expect(body.currentAmount).toBe("0.00");
    expect(body.status).toBe("Active");
  });

  it("G-02: update a goal", async () => {
    const acc = await createAccount("GoalBank2");
    const goal = await request(app).post("/api/goals").send({
      name: "Travel Fund", targetAmount: "50000", accountId: acc.id, categoryType: "Travel",
    });
    const goalBody = goal.body as GoalResponse;
    const res = await request(app).put(`/api/goals/${goalBody.id}`).send({
      name: "Travel Fund Updated", targetAmount: "75000", accountId: acc.id, categoryType: "Travel",
    });
    expect(res.status).toBe(200);
    const body = res.body as GoalResponse;
    expect(body.name).toBe("Travel Fund Updated");
    expect(body.targetAmount).toBe("75000.00");
  });

  it("G-03: delete a goal", async () => {
    const acc = await createAccount("GoalBank3");
    const goal = await request(app).post("/api/goals").send({
      name: "Temp Goal", targetAmount: "10000", accountId: acc.id, categoryType: "General",
    });
    const goalBody = goal.body as GoalResponse;
    const res = await request(app).delete(`/api/goals/${goalBody.id}`);
    expect(res.status).toBe(204);
  });

  it("G-04: list goals with intelligence data", async () => {
    const acc = await createAccount("GoalBank4");
    await request(app).post("/api/goals").send({
      name: "Emergency", targetAmount: "300000", accountId: acc.id, categoryType: "Emergency",
    });

    const res = await request(app).get("/api/goals");
    const body = res.body as GoalResponse[];
    expect(body.length).toBe(1);
    expect(body[0]).toHaveProperty("velocity");
    expect(body[0]).toHaveProperty("statusIndicator");
    expect(body[0]).toHaveProperty("projectedFinishDate");
  });

  it("G-05: update goal with currentAmount to achieve it", async () => {
    const acc = await createAccount("GoalBank5");
    const goal = await request(app).post("/api/goals").send({
      name: "Small Goal", targetAmount: "1000", accountId: acc.id, categoryType: "General",
    });
    const goalBody = goal.body as GoalResponse;
    const res = await request(app).put(`/api/goals/${goalBody.id}`).send({
      name: "Small Goal", targetAmount: "1000", currentAmount: "1000", accountId: acc.id, categoryType: "General",
    });
    const body = res.body as GoalResponse;
    expect(body.status).toBe("Achieved");
  });

  it("G-12: waterfall calculation with liquid cash", async () => {
    const acc = await createAccount("WaterfallBank", "500000");
    await request(app).post("/api/goals").send({
      name: "Emergency", targetAmount: "300000", accountId: acc.id, categoryType: "Emergency",
    });

    const res = await request(app).get("/api/goals/waterfall");
    expect(res.status).toBe(200);
    const body = res.body as WaterfallResponse;
    expect(body).toHaveProperty("totalBankBalance");
    expect(body).toHaveProperty("remainingLiquidCash");
    expect(body).toHaveProperty("goalAllocations");
    expect(Number(body.totalBankBalance)).toBe(500000);
  });

  it("G-13: stress test (Goal Rich Cash Poor)", async () => {
    const acc = await createAccount("PoorBank", "10000");

    const goal = await request(app).post("/api/goals").send({
      name: "Big Goal", targetAmount: "500000", accountId: acc.id, categoryType: "General",
    });
    const goalBody = goal.body as GoalResponse;

    await request(app).put(`/api/goals/${goalBody.id}`).send({
      name: "Big Goal", targetAmount: "500000", currentAmount: "8000", accountId: acc.id, categoryType: "General",
    });

    await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "5000", description: "Expense", category: "Living Expenses", type: "Expense", accountId: acc.id,
    });

    const res = await request(app).get("/api/goals/waterfall");
    const body = res.body as WaterfallResponse;
    expect(Number(body.remainingLiquidCash)).toBeLessThan(Number(body.totalBankBalance));
    expect(body.stressTest).toBe(true);
  });

  it("G-14: 12-month projection", async () => {
    const acc = await createAccount("ProjectionBank");
    const goal = await request(app).post("/api/goals").send({
      name: "Long Term", targetAmount: "500000", accountId: acc.id, categoryType: "General", targetDate: "2028-01-01",
    });
    const goalBody = goal.body as GoalResponse;

    const res = await request(app).get(`/api/goals/${goalBody.id}/projection`);
    expect(res.status).toBe(200);
    const body = res.body as ProjectionPoint[];
    expect(body.length).toBe(12);
    expect(body[0]).toHaveProperty("month");
    expect(body[0]).toHaveProperty("projectedBalance");
    expect(body[0]).toHaveProperty("targetAmount");
  });

  it("G-15: zero-velocity projection stays flat", async () => {
    const acc = await createAccount("FlatBank");
    const goal = await request(app).post("/api/goals").send({
      name: "Flat Goal", targetAmount: "100000", accountId: acc.id, categoryType: "General",
    });
    const goalBody = goal.body as GoalResponse;

    const res = await request(app).get(`/api/goals/${goalBody.id}/projection`);
    const body = res.body as ProjectionPoint[];
    const balances = body.map(p => p.projectedBalance);
    expect(new Set(balances).size).toBe(1);
  });

  it("G-16: projection for non-existent goal returns 404", async () => {
    const res = await request(app).get("/api/goals/99999/projection");
    expect(res.status).toBe(404);
  });
});
