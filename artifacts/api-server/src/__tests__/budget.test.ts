import { describe, it, expect } from "vitest";
import request from "supertest";
import { db, mockChain } from "../test/db-mock";
import app from "../app";

describe("Budget Goals API", () => {
  it("GET /budget-goals returns list", async () => {
    db.select.mockReturnValueOnce(
      mockChain([{ id: 1, categoryId: 1, plannedAmount: "5000", category: "Food" }])
    );
    const res = await request(app).get("/api/budget-goals");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("POST /budget-goals creates new", async () => {
    db.select.mockReturnValueOnce(mockChain([]));
    db.insert.mockReturnValueOnce(
      mockChain([{ id: 1, categoryId: 1, plannedAmount: "5000" }])
    );
    db.select.mockReturnValueOnce(
      mockChain([{ id: 1, categoryId: 1, plannedAmount: "5000", category: "Food" }])
    );
    const res = await request(app).post("/api/budget-goals").send({
      categoryId: 1, plannedAmount: "5000",
    });
    expect(res.status).toBe(200);
  });

  it("POST /budget-goals updates existing", async () => {
    db.select.mockReturnValueOnce(
      mockChain([{ id: 1, categoryId: 1, plannedAmount: "3000" }])
    );
    db.update.mockReturnValueOnce(
      mockChain([{ id: 1, categoryId: 1, plannedAmount: "5000" }])
    );
    db.select.mockReturnValueOnce(
      mockChain([{ id: 1, categoryId: 1, plannedAmount: "5000", category: "Food" }])
    );
    const res = await request(app).post("/api/budget-goals").send({
      categoryId: 1, plannedAmount: "5000",
    });
    expect(res.status).toBe(200);
  });

  it("DELETE /budget-goals/:id deletes", async () => {
    const res = await request(app).delete("/api/budget-goals/1");
    expect(res.status).toBe(204);
  });

  it("DELETE /budget-goals/:id rejects invalid id", async () => {
    const res = await request(app).delete("/api/budget-goals/abc");
    expect(res.status).toBe(400);
  });

  it("POST /budget-goals rejects empty body", async () => {
    const res = await request(app).post("/api/budget-goals").send({});
    expect(res.status).toBe(400);
  });
});

describe("Budget Analysis API", () => {
  it("GET /budget-analysis returns analysis", async () => {
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Food", type: "Expense" }]))
      .mockReturnValueOnce(mockChain([{ id: 10, categoryId: 1, plannedAmount: "5000" }]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ category: "Food", total: "3000" }]));
    const res = await request(app).get("/api/budget-analysis?month=2025-03");
    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(1);
    expect(res.body.rows[0].category).toBe("Food");
  });

  it("GET /budget-analysis rejects invalid month", async () => {
    const res = await request(app).get("/api/budget-analysis?month=invalid");
    expect(res.status).toBe(400);
  });

  it("GET /budget-analysis rejects missing month", async () => {
    const res = await request(app).get("/api/budget-analysis");
    expect(res.status).toBe(400);
  });

  it("GET /budget-analysis handles over budget category", async () => {
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Food", type: "Expense" }]))
      .mockReturnValueOnce(mockChain([{ id: 10, categoryId: 1, plannedAmount: "2000" }]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ category: "Food", total: "5000" }]));
    const res = await request(app).get("/api/budget-analysis?month=2025-03");
    expect(res.status).toBe(200);
    expect(res.body.rows[0].overBudget).toBe(true);
    expect(res.body.rows[0].paceStatus).toBe("over_budget");
  });

  it("GET /budget-analysis handles fixed category", async () => {
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Term Insurance", type: "Expense" }]))
      .mockReturnValueOnce(mockChain([{ id: 10, categoryId: 1, plannedAmount: "2509" }]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ category: "Term Insurance", total: "2509" }]));
    const res = await request(app).get("/api/budget-analysis?month=2025-03");
    expect(res.status).toBe(200);
    expect(res.body.rows[0].categoryType).toBe("fixed");
    expect(res.body.rows[0].paceMessage).toBe("Paid");
  });

  it("GET /budget-analysis handles EMI category with loan", async () => {
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "EMI (PL)", type: "Expense" }]))
      .mockReturnValueOnce(mockChain([{ id: 10, categoryId: 1, plannedAmount: "5000" }]))
      .mockReturnValueOnce(mockChain([{
        id: 2, name: "PL", type: "loan", currentBalance: "100000",
        emiAmount: "5000", emiDay: 5, interestRate: "12",
      }]))
      .mockReturnValueOnce(mockChain([{ category: "EMI (PL)", total: "5000" }]));
    const res = await request(app).get("/api/budget-analysis?month=2025-03");
    expect(res.status).toBe(200);
  });

  it("GET /budget-analysis with no budget set", async () => {
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Shopping", type: "Expense" }]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ category: "Shopping", total: "3000" }]));
    const res = await request(app).get("/api/budget-analysis?month=2025-03");
    expect(res.status).toBe(200);
    expect(res.body.rows[0].paceStatus).toBe("over_budget");
  });

  it("GET /budget-analysis partially paid fixed", async () => {
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "SIP (Investment)", type: "Expense" }]))
      .mockReturnValueOnce(mockChain([{ id: 10, categoryId: 1, plannedAmount: "25000" }]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ category: "SIP (Investment)", total: "12500" }]));
    const res = await request(app).get("/api/budget-analysis?month=2025-03");
    expect(res.status).toBe(200);
    expect(res.body.rows[0].paceMessage).toBe("Partially paid");
  });

  it("GET /budget-analysis pending fixed", async () => {
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Father", type: "Expense" }]))
      .mockReturnValueOnce(mockChain([{ id: 10, categoryId: 1, plannedAmount: "25000" }]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([]));
    const res = await request(app).get("/api/budget-analysis?month=2025-03");
    expect(res.status).toBe(200);
    expect(res.body.rows[0].paceMessage).toBe("Pending");
  });
});
