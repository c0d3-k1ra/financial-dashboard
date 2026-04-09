import { describe, it, expect } from "vitest";
import request from "supertest";
import { db, mockChain } from "../test/db-mock";
import app from "../app";

describe("Goals API", () => {
  it("GET /goals returns list with intelligence", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{
        id: 1, name: "Emergency", targetAmount: "100000", currentAmount: "20000",
        accountId: 1, status: "Active", targetDate: null, categoryType: "Emergency",
        icon: "🛡️",
      }]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "SBI" }]))
      .mockReturnValueOnce(mockChain([]));
    const res = await request(app).get("/api/goals");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].accountName).toBe("SBI");
  });

  it("GET /goals returns empty", async () => {
    const res = await request(app).get("/api/goals");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("POST /goals creates goal with account", async () => {
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "SBI", currentBalance: "100000" }]))
      .mockReturnValueOnce(mockChain([]));
    db.insert.mockReturnValueOnce(
      mockChain([{
        id: 1, name: "Vacation", targetAmount: "50000", currentAmount: "0",
        accountId: 1, status: "Active", targetDate: "2025-12-31",
        categoryType: "Travel", icon: "✈️",
      }])
    );
    const res = await request(app).post("/api/goals").send({
      name: "Vacation", targetAmount: "50000", accountId: 1,
      targetDate: "2025-12-31", categoryType: "Travel",
    });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Vacation");
  });

  it("POST /goals creates goal without account", async () => {
    db.insert.mockReturnValueOnce(
      mockChain([{
        id: 2, name: "Emergency", targetAmount: "100000", currentAmount: "0",
        accountId: null, status: "Active", targetDate: null,
        categoryType: "Emergency", icon: "🛡️",
      }])
    );
    const res = await request(app).post("/api/goals").send({
      name: "Emergency", targetAmount: "100000", categoryType: "Emergency", accountId: 0,
    });
    expect(res.status).toBe(201);
  });

  it("POST /goals rejects bad account", async () => {
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([]));
    const res = await request(app).post("/api/goals").send({
      name: "Bad", targetAmount: "50000", accountId: 999, categoryType: "General",
    });
    expect(res.status).toBe(400);
  });

  it("PUT /goals/:id updates goal", async () => {
    db.select.mockReturnValueOnce(
      mockChain([{
        id: 1, name: "Old", targetAmount: "50000", currentAmount: "10000",
        accountId: 1, status: "Active", targetDate: null, categoryType: "General",
      }])
    );
    db.update.mockReturnValueOnce(
      mockChain([{
        id: 1, name: "Updated", targetAmount: "60000", currentAmount: "10000",
        accountId: 1, status: "Active", targetDate: null, categoryType: "General",
      }])
    );
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "SBI" }]));
    const res = await request(app).put("/api/goals/1").send({
      name: "Updated", targetAmount: "60000", categoryType: "General", accountId: 1,
    });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Updated");
  });

  it("PUT /goals/:id returns 404", async () => {
    const res = await request(app).put("/api/goals/999").send({
      name: "Ghost", targetAmount: "10000", categoryType: "General", accountId: 0,
    });
    expect(res.status).toBe(404);
  });

  it("PUT /goals/:id achieves goal", async () => {
    db.select.mockReturnValueOnce(
      mockChain([{
        id: 1, name: "Goal", targetAmount: "10000", currentAmount: "5000",
        accountId: null, status: "Active", targetDate: null, categoryType: "General",
      }])
    );
    db.update.mockReturnValueOnce(
      mockChain([{
        id: 1, name: "Goal", targetAmount: "10000", currentAmount: "10000",
        accountId: null, status: "Achieved", targetDate: null, categoryType: "General",
      }])
    );
    db.select.mockReturnValueOnce(mockChain([]));
    const res = await request(app).put("/api/goals/1").send({
      name: "Goal", targetAmount: "10000", currentAmount: "10000", categoryType: "General", accountId: 0,
    });
    expect(res.status).toBe(200);
  });

  it("PUT /goals/:id validates balance when account changes", async () => {
    db.select.mockReturnValueOnce(
      mockChain([{
        id: 1, name: "Goal", targetAmount: "50000", currentAmount: "10000",
        accountId: 1, status: "Active", targetDate: null, categoryType: "General",
      }])
    );
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ id: 2, name: "HDFC", currentBalance: "1000" }]))
      .mockReturnValueOnce(mockChain([]));
    const res = await request(app).put("/api/goals/1").send({
      name: "Goal", targetAmount: "50000", currentAmount: "20000",
      accountId: 2, categoryType: "General",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Insufficient");
  });

  it("DELETE /goals/:id succeeds when no allocations", async () => {
    db.select.mockReturnValueOnce(mockChain([{ count: 0 }]));
    const res = await request(app).delete("/api/goals/1");
    expect(res.status).toBe(204);
  });

  it("DELETE /goals/:id fails when allocations linked", async () => {
    db.select.mockReturnValueOnce(mockChain([{ count: 3 }]));
    const res = await request(app).delete("/api/goals/1");
    expect(res.status).toBe(409);
    expect(res.body.error).toContain("surplus allocation");
  });

  it("GET /goals/waterfall returns breakdown", async () => {
    db.select
      .mockReturnValueOnce(mockChain([
        { id: 1, name: "SBI", type: "bank", currentBalance: "200000" },
      ]))
      .mockReturnValueOnce(mockChain([
        { id: 1, name: "Emergency", currentAmount: "50000", status: "Active" },
      ]))
      .mockReturnValueOnce(mockChain([{ total: "100000" }]))
      .mockReturnValueOnce(mockChain([{ cnt: "3" }]));
    const res = await request(app).get("/api/goals/waterfall");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("totalBankBalance");
    expect(res.body).toHaveProperty("remainingLiquidCash");
    expect(res.body).toHaveProperty("stressTest");
  });

  it("GET /goals/:id/projection returns data", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{
        id: 1, name: "Emergency", targetAmount: "100000", currentAmount: "20000",
        targetDate: "2026-12-31", categoryType: "Emergency", status: "Active",
      }]))
      .mockReturnValueOnce(mockChain([]));
    const res = await request(app).get("/api/goals/1/projection");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /goals/:id/projection returns 404", async () => {
    const res = await request(app).get("/api/goals/999/projection");
    expect(res.status).toBe(404);
  });

  it("GET /goals with null fields", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{
        id: 1, name: "Test", targetAmount: null, currentAmount: null,
        accountId: null, status: "Active", targetDate: null, categoryType: "Other",
        icon: null,
      }]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([]));
    const res = await request(app).get("/api/goals");
    expect(res.status).toBe(200);
    expect(res.body[0].targetAmount).toBe("0.00");
    expect(res.body[0].accountName).toBeNull();
  });

  it("POST /goals creates goal without targetDate", async () => {
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "SBI", currentBalance: "100000" }]))
      .mockReturnValueOnce(mockChain([]));
    db.insert.mockReturnValueOnce(
      mockChain([{
        id: 2, name: "Quick Save", targetAmount: "10000", currentAmount: "0",
        accountId: 1, status: "Active", targetDate: null,
        categoryType: "Other", icon: "🎯",
      }])
    );
    const res = await request(app).post("/api/goals").send({
      name: "Quick Save", targetAmount: "10000", categoryType: "Other", accountId: 1,
    });
    expect(res.status).toBe(201);
    expect(res.body.statusIndicator).toBe("Not Started");
  });

  it("POST /goals creates goal with matching category icon", async () => {
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "SBI", currentBalance: "100000" }]))
      .mockReturnValueOnce(mockChain([]));
    db.insert.mockReturnValueOnce(
      mockChain([{
        id: 2, name: "Trip", targetAmount: "50000", currentAmount: "0",
        accountId: 1, status: "Active", targetDate: "2025-12-31",
        categoryType: "Travel", icon: "✈️",
      }])
    );
    const res = await request(app).post("/api/goals").send({
      name: "Trip", targetAmount: "50000", categoryType: "Travel", targetDate: "2025-12-31", accountId: 1,
    });
    expect(res.status).toBe(201);
  });

  it("PUT /goals/:id with currentAmount set", async () => {
    db.select.mockReturnValueOnce(mockChain([{
      id: 1, name: "Emergency", targetAmount: "100000", currentAmount: "0",
      accountId: 1, status: "Active",
    }]));
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "SBI", currentBalance: "200000" }]))
      .mockReturnValueOnce(mockChain([]));
    db.update.mockReturnValueOnce(mockChain([{
      id: 1, name: "Emergency", targetAmount: "100000", currentAmount: "50000",
      accountId: 1, status: "Active", targetDate: null, categoryType: "Emergency", icon: "🛡️",
    }]));
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "SBI" }]));
    const res = await request(app).put("/api/goals/1").send({
      name: "Emergency", targetAmount: "100000", currentAmount: "50000",
      categoryType: "Emergency", accountId: 1,
    });
    expect(res.status).toBe(200);
  });

  it("PUT /goals/:id not found after update", async () => {
    db.select.mockReturnValueOnce(mockChain([{
      id: 1, name: "Goal", targetAmount: "10000", currentAmount: "0",
      accountId: 1, status: "Active",
    }]));
    db.update.mockReturnValueOnce(mockChain([]));
    const res = await request(app).put("/api/goals/1").send({
      name: "Goal", targetAmount: "10000", categoryType: "Other", accountId: 1,
    });
    expect(res.status).toBe(404);
  });

  it("PUT /goals/:id achieves status when currentAmount >= targetAmount", async () => {
    db.select.mockReturnValueOnce(mockChain([{
      id: 1, name: "Small Goal", targetAmount: "1000", currentAmount: "500",
      accountId: 1, status: "Active",
    }]));
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "SBI", currentBalance: "5000" }]))
      .mockReturnValueOnce(mockChain([]));
    db.update.mockReturnValueOnce(mockChain([{
      id: 1, name: "Small Goal", targetAmount: "1000", currentAmount: "1000",
      accountId: 1, status: "Achieved", targetDate: null, categoryType: "Other", icon: "🎯",
    }]));
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "SBI" }]));
    const res = await request(app).put("/api/goals/1").send({
      name: "Small Goal", targetAmount: "1000", currentAmount: "1000", categoryType: "Other", accountId: 1,
    });
    expect(res.status).toBe(200);
  });

  it("GET /goals/waterfall with null balances", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ id: 1, type: "bank", currentBalance: null }]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Goal", currentAmount: null, status: "Active" }]))
      .mockReturnValueOnce(mockChain([{ total: null }]))
      .mockReturnValueOnce(mockChain([{ cnt: null }]));
    const res = await request(app).get("/api/goals/waterfall");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("totalBankBalance");
  });

  it("DELETE /goals/:id rejected with linked allocations", async () => {
    db.select.mockReturnValueOnce(mockChain([{ count: 3 }]));
    const res = await request(app).delete("/api/goals/1");
    expect(res.status).toBe(409);
    expect(res.body.error).toContain("Cannot delete");
  });

  it("GET /goals/:id/projection with allocations", async () => {
    const now = new Date();
    const monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    db.select
      .mockReturnValueOnce(mockChain([{
        id: 1, name: "Emergency", targetAmount: "100000", currentAmount: "20000",
        targetDate: null, categoryType: "Emergency", status: "Active",
      }]))
      .mockReturnValueOnce(mockChain([
        { id: 1, month: `${monthAgo.getFullYear()}-${String(monthAgo.getMonth() + 1).padStart(2, "0")}`, goalId: 1, amount: "10000", allocatedAt: monthAgo, sourceAccountId: 1 },
        { id: 2, month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`, goalId: 1, amount: "10000", allocatedAt: now, sourceAccountId: 1 },
      ]));
    const res = await request(app).get("/api/goals/1/projection");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });
});
