import { describe, it, expect } from "vitest";
import request from "supertest";
import { db, mockChain } from "../test/db-mock";
import app from "../app";

describe("Surplus API", () => {
  it("GET /surplus/monthly returns surplus", async () => {
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ id: 1, currentBalance: "200000", useInSurplus: true }]))
      .mockReturnValueOnce(mockChain([
        { id: 1, type: "bank", currentBalance: "200000", useInSurplus: true, emiAmount: null, emiDay: null, interestRate: null, loanTenure: null },
      ]));
    const res = await request(app).get("/api/surplus/monthly?month=2025-03");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("surplus");
    expect(res.body.month).toBe("2025-03");
  });

  it("GET /surplus/monthly rejects invalid month", async () => {
    const res = await request(app).get("/api/surplus/monthly?month=invalid");
    expect(res.status).toBe(400);
  });

  it("GET /surplus/monthly rejects missing month", async () => {
    const res = await request(app).get("/api/surplus/monthly");
    expect(res.status).toBe(400);
  });

  it("POST /surplus/distribute rejects empty allocations", async () => {
    const res = await request(app).post("/api/surplus/distribute").send({
      month: "2025-03", sourceAccountId: 1, allocations: [],
    });
    expect(res.status).toBe(400);
  });

  it("POST /surplus/distribute rejects missing source account", async () => {
    db.select.mockReturnValueOnce(mockChain([]));
    const res = await request(app).post("/api/surplus/distribute").send({
      month: "2025-03", sourceAccountId: 999, allocations: [{ goalId: 1, amount: "5000" }],
    });
    expect(res.status).toBe(404);
  });

  it("POST /surplus/distribute rejects insufficient balance", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ id: 1, currentBalance: "1000", useInSurplus: true }]))
      .mockReturnValueOnce(mockChain([]));
    const res = await request(app).post("/api/surplus/distribute").send({
      month: "2025-03", sourceAccountId: 1, allocations: [{ goalId: 1, amount: "50000" }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Insufficient balance");
  });

  it("POST /surplus/distribute rejects when no surplus", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ id: 1, currentBalance: "100000", useInSurplus: true }]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([
        { id: 1, type: "bank", currentBalance: "0", useInSurplus: true, emiAmount: null },
        { id: 2, type: "credit_card", currentBalance: "-200000", useInSurplus: false, emiAmount: null },
      ]));
    const res = await request(app).post("/api/surplus/distribute").send({
      month: "2025-03", sourceAccountId: 1, allocations: [{ goalId: 1, amount: "5000" }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("No surplus");
  });

  it("POST /surplus/distribute rejects invalid goal", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ id: 1, currentBalance: "500000", useInSurplus: true }]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([
        { id: 1, type: "bank", currentBalance: "500000", useInSurplus: true, emiAmount: null },
      ]))
      .mockReturnValueOnce(mockChain([]));
    const res = await request(app).post("/api/surplus/distribute").send({
      month: "2025-03", sourceAccountId: 1, allocations: [{ goalId: 999, amount: "5000" }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Goal ID");
  });

  it("POST /surplus/distribute rejects non-positive amount", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ id: 1, currentBalance: "500000", useInSurplus: true }]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([
        { id: 1, type: "bank", currentBalance: "500000", useInSurplus: true, emiAmount: null },
      ]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Goal1" }]));
    const res = await request(app).post("/api/surplus/distribute").send({
      month: "2025-03", sourceAccountId: 1, allocations: [{ goalId: 1, amount: "0" }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("positive");
  });

  it("POST /surplus/distribute succeeds with valid data", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ id: 1, currentBalance: "500000", useInSurplus: true }]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([
        { id: 1, type: "bank", currentBalance: "500000", useInSurplus: true, emiAmount: null },
      ]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Emergency", accountId: 1, status: "Active", currentAmount: "0", targetAmount: "100000" }]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Emergency", accountId: 1, status: "Active", currentAmount: "0", targetAmount: "100000" }]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Bank", currentBalance: "500000" }]))
      .mockReturnValueOnce(mockChain([{ currentAmount: "0" }]))
      .mockReturnValueOnce(mockChain([{ id: 1, currentBalance: "500000" }]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Emergency", accountId: 1, status: "Active", currentAmount: "0", targetAmount: "100000" }]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Emergency", accountId: 1, status: "Active", currentAmount: "5000", targetAmount: "100000" }]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ total: "0" }]))
      .mockReturnValueOnce(mockChain([{ total: "0" }]))
      .mockReturnValueOnce(mockChain([{ total: "0" }]))
      .mockReturnValueOnce(mockChain([]));
    const res = await request(app).post("/api/surplus/distribute").send({
      month: "2025-03", sourceAccountId: 1, allocations: [{ goalId: 1, amount: "5000" }],
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("GET /surplus/allocations returns list", async () => {
    db.select
      .mockReturnValueOnce(mockChain([
        { id: 1, month: "2025-03", goalId: 1, amount: "5000", sourceAccountId: 1, allocatedAt: new Date("2025-03-15") },
      ]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Emergency" }]));
    const res = await request(app).get("/api/surplus/allocations");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].goalName).toBe("Emergency");
  });

  it("GET /surplus/can-undo returns false when no allocations", async () => {
    db.select.mockReturnValueOnce(mockChain([]));
    const res = await request(app).get("/api/surplus/can-undo?month=2025-03");
    expect(res.status).toBe(200);
    expect(res.body.canUndo).toBe(false);
  });

  it("GET /surplus/can-undo returns false when newer allocations exist", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ id: 1, month: "2025-03", goalId: 1, amount: "5000" }]))
      .mockReturnValueOnce(mockChain([{ id: 2, month: "2025-04", goalId: 1, amount: "3000" }]));
    const res = await request(app).get("/api/surplus/can-undo?month=2025-03");
    expect(res.status).toBe(200);
    expect(res.body.canUndo).toBe(false);
  });

  it("GET /surplus/can-undo returns true when undoable", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ id: 1, month: "2025-03", goalId: 1, amount: "5000", sourceAccountId: 1, allocatedAt: new Date() }]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ count: 0 }]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Emergency", accountId: 1 }]));
    const res = await request(app).get("/api/surplus/can-undo?month=2025-03");
    expect(res.status).toBe(200);
    expect(res.body.canUndo).toBe(true);
  });

  it("GET /surplus/can-undo rejects invalid month", async () => {
    const res = await request(app).get("/api/surplus/can-undo?month=bad");
    expect(res.status).toBe(400);
  });

  it("POST /surplus/undo rejects when no allocations", async () => {
    db.select.mockReturnValueOnce(mockChain([]));
    const res = await request(app).post("/api/surplus/undo").send({ month: "2025-03" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("No distribution");
  });

  it("POST /surplus/undo rejects when newer allocations", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ id: 1, month: "2025-03" }]))
      .mockReturnValueOnce(mockChain([{ id: 2, month: "2025-04" }]));
    const res = await request(app).post("/api/surplus/undo").send({ month: "2025-03" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("most recent");
  });

  it("POST /surplus/undo rejects when next month has transactions", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ id: 1, month: "2025-03" }]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ count: 5 }]));
    const res = await request(app).post("/api/surplus/undo").send({ month: "2025-03" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Cannot undo");
  });

  it("POST /surplus/undo succeeds", async () => {
    db.select
      .mockReturnValueOnce(mockChain([
        { id: 1, month: "2025-03", goalId: 1, amount: "5000", sourceAccountId: 1, allocatedAt: new Date("2025-03-15") },
      ]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ count: 0 }]));
    db.execute.mockResolvedValueOnce({ rows: [] });
    db.select
      .mockReturnValueOnce(mockChain([
        { id: 1, name: "Emergency", accountId: 1, currentAmount: "5000", targetAmount: "100000", status: "Active" },
      ]))
      .mockReturnValueOnce(mockChain([
        { id: 1, name: "Emergency", accountId: 1, currentAmount: "0", targetAmount: "100000", status: "Active" },
      ]));
    const res = await request(app).post("/api/surplus/undo").send({ month: "2025-03" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("POST /surplus/undo rejects invalid month format", async () => {
    const res = await request(app).post("/api/surplus/undo").send({ month: "bad" });
    expect(res.status).toBe(400);
  });

  it("POST /surplus/undo reverts achieved goal with cross-account transfer", async () => {
    db.select
      .mockReturnValueOnce(mockChain([
        { id: 1, month: "2025-03", goalId: 1, amount: "5000", sourceAccountId: 2, allocatedAt: new Date("2025-03-15") },
      ]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ count: 0 }]));
    db.execute.mockResolvedValueOnce({ rows: [] });
    db.select
      .mockReturnValueOnce(mockChain([
        { id: 1, name: "Emergency", accountId: 1, currentAmount: "5000", targetAmount: "5000", status: "Active" },
      ]))
      .mockReturnValueOnce(mockChain([
        { id: 1, name: "Emergency", accountId: 1, currentAmount: "0", targetAmount: "5000", status: "Achieved" },
      ]))
      .mockReturnValueOnce(mockChain([{ id: 10 }]));
    const res = await request(app).post("/api/surplus/undo").send({ month: "2025-03" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("POST /surplus/undo handles goal not found during revert", async () => {
    db.select
      .mockReturnValueOnce(mockChain([
        { id: 1, month: "2025-03", goalId: 999, amount: "5000", sourceAccountId: 1, allocatedAt: new Date("2025-03-15") },
      ]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ count: 0 }]));
    db.execute.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post("/api/surplus/undo").send({ month: "2025-03" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.revertedGoals).toBe(0);
  });

  it("POST /surplus/undo with other months having next config", async () => {
    db.select
      .mockReturnValueOnce(mockChain([
        { id: 1, month: "2025-03", goalId: 1, amount: "5000", sourceAccountId: 1, allocatedAt: new Date("2025-03-15") },
      ]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ count: 0 }]));
    db.execute.mockResolvedValueOnce({ rows: [{ month: "2025-03" }] });
    db.select
      .mockReturnValueOnce(mockChain([
        { id: 1, name: "Goal", accountId: 1, currentAmount: "5000", targetAmount: "100000", status: "Active" },
      ]))
      .mockReturnValueOnce(mockChain([
        { id: 1, name: "Goal", accountId: 1, currentAmount: "0", targetAmount: "100000", status: "Active" },
      ]));
    const res = await request(app).post("/api/surplus/undo").send({ month: "2025-03" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("POST /surplus/distribute allocation exceeds surplus", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ id: 1, currentBalance: "500000", useInSurplus: true }]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([
        { id: 1, type: "bank", currentBalance: "500000", useInSurplus: true, emiAmount: null },
        { id: 2, type: "credit_card", currentBalance: "-400000", useInSurplus: false, emiAmount: null },
      ]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Goal1" }]));
    const res = await request(app).post("/api/surplus/distribute").send({
      month: "2025-03", sourceAccountId: 1, allocations: [{ goalId: 1, amount: "150000" }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("exceeds available surplus");
  });

  it("POST /surplus/distribute with goal achieving target", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ id: 1, currentBalance: "500000", useInSurplus: true }]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([
        { id: 1, type: "bank", currentBalance: "500000", useInSurplus: true, emiAmount: null },
      ]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Goal", accountId: 1, status: "Active", currentAmount: "9000", targetAmount: "10000" }]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Goal", accountId: 1, status: "Active", currentAmount: "9000", targetAmount: "10000" }]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Bank", currentBalance: "500000" }]))
      .mockReturnValueOnce(mockChain([{ currentAmount: "9000" }]))
      .mockReturnValueOnce(mockChain([{ id: 1, currentBalance: "500000" }]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Goal", accountId: 1, status: "Active", currentAmount: "9000", targetAmount: "10000" }]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Goal", accountId: 1, status: "Active", currentAmount: "10000", targetAmount: "10000" }]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ total: "0" }]))
      .mockReturnValueOnce(mockChain([{ total: "0" }]))
      .mockReturnValueOnce(mockChain([{ total: "0" }]))
      .mockReturnValueOnce(mockChain([]));
    const res = await request(app).post("/api/surplus/distribute").send({
      month: "2025-03", sourceAccountId: 1, allocations: [{ goalId: 1, amount: "1000" }],
    });
    expect(res.status).toBe(200);
  });

  it("POST /surplus/distribute with goal having no accountId", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ id: 1, currentBalance: "500000", useInSurplus: true }]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([
        { id: 1, type: "bank", currentBalance: "500000", useInSurplus: true, emiAmount: null },
      ]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Goal", accountId: null, status: "Active", currentAmount: "0", targetAmount: "100000" }]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Goal", accountId: null, status: "Active", currentAmount: "0", targetAmount: "100000" }]))
      .mockReturnValueOnce(mockChain([{ id: 1, currentBalance: "500000" }]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Goal", accountId: null, status: "Active", currentAmount: "0", targetAmount: "100000" }]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Goal", accountId: null, status: "Active", currentAmount: "5000", targetAmount: "100000" }]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ total: "0" }]))
      .mockReturnValueOnce(mockChain([{ total: "0" }]))
      .mockReturnValueOnce(mockChain([{ total: "0" }]))
      .mockReturnValueOnce(mockChain([]));
    const res = await request(app).post("/api/surplus/distribute").send({
      month: "2025-03", sourceAccountId: 1, allocations: [{ goalId: 1, amount: "5000" }],
    });
    expect(res.status).toBe(200);
  });

  it("POST /surplus/distribute with existing next month config", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ id: 1, currentBalance: "500000", useInSurplus: true }]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([
        { id: 1, type: "bank", currentBalance: "500000", useInSurplus: true, emiAmount: null },
      ]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Goal", accountId: 1, status: "Active", currentAmount: "0", targetAmount: "100000" }]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Goal", accountId: 1, status: "Active", currentAmount: "0", targetAmount: "100000" }]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Bank", currentBalance: "500000" }]))
      .mockReturnValueOnce(mockChain([{ currentAmount: "0" }]))
      .mockReturnValueOnce(mockChain([{ id: 1, currentBalance: "500000" }]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Goal", accountId: 1, status: "Active", currentAmount: "0", targetAmount: "100000" }]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Goal", accountId: 1, status: "Active", currentAmount: "5000", targetAmount: "100000" }]))
      .mockReturnValueOnce(mockChain([{ month: "2025-03", startingBalance: "100000" }]))
      .mockReturnValueOnce(mockChain([{ total: "50000" }]))
      .mockReturnValueOnce(mockChain([{ total: "20000" }]))
      .mockReturnValueOnce(mockChain([{ total: "5000" }]))
      .mockReturnValueOnce(mockChain([{ month: "2025-04", startingBalance: "80000" }]));
    const res = await request(app).post("/api/surplus/distribute").send({
      month: "2025-03", sourceAccountId: 1, allocations: [{ goalId: 1, amount: "5000" }],
    });
    expect(res.status).toBe(200);
  });

  it("GET /surplus/can-undo with next month having txs", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ id: 1, month: "2025-03", goalId: 1, amount: "5000", sourceAccountId: 1, allocatedAt: new Date() }]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ count: 3 }]));
    const res = await request(app).get("/api/surplus/can-undo?month=2025-03");
    expect(res.status).toBe(200);
    expect(res.body.canUndo).toBe(false);
  });

  it("GET /surplus/can-undo with cross-account transfer", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ id: 1, month: "2025-03", goalId: 1, amount: "5000", sourceAccountId: 2, allocatedAt: new Date() }]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ count: 0 }]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Goal", accountId: 1 }]));
    const res = await request(app).get("/api/surplus/can-undo?month=2025-03");
    expect(res.status).toBe(200);
    expect(res.body.canUndo).toBe(true);
    expect(res.body.transferCount).toBe(1);
  });

  it("GET /surplus/allocations with unknown goal", async () => {
    db.select
      .mockReturnValueOnce(mockChain([
        { id: 1, month: "2025-03", goalId: 999, amount: "5000", sourceAccountId: 1, allocatedAt: new Date("2025-03-15") },
      ]))
      .mockReturnValueOnce(mockChain([]));
    const res = await request(app).get("/api/surplus/allocations");
    expect(res.status).toBe(200);
    expect(res.body[0].goalName).toBe("Unknown");
  });

  it("POST /surplus/undo with no matching transfer tx", async () => {
    db.select
      .mockReturnValueOnce(mockChain([
        { id: 1, month: "2025-03", goalId: 1, amount: "5000", sourceAccountId: 2, allocatedAt: new Date("2025-03-15") },
      ]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ count: 0 }]));
    db.execute.mockResolvedValueOnce({ rows: [] });
    db.select
      .mockReturnValueOnce(mockChain([
        { id: 1, name: "Goal", accountId: 1, currentAmount: "5000", targetAmount: "100000", status: "Active" },
      ]))
      .mockReturnValueOnce(mockChain([
        { id: 1, name: "Goal", accountId: 1, currentAmount: "0", targetAmount: "100000", status: "Active" },
      ]))
      .mockReturnValueOnce(mockChain([]));
    const res = await request(app).post("/api/surplus/undo").send({ month: "2025-03" });
    expect(res.status).toBe(200);
    expect(res.body.deletedTransfers).toBe(0);
  });

  it("POST /surplus/distribute with cross-account transfer", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ id: 2, currentBalance: "500000", useInSurplus: true }]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([
        { id: 2, type: "bank", currentBalance: "500000", useInSurplus: true, emiAmount: null },
      ]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Emergency", accountId: 1, status: "Active", currentAmount: "0", targetAmount: "100000" }]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Emergency", accountId: 1, status: "Active", currentAmount: "0", targetAmount: "100000" }]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "SBI", currentBalance: "100000" }]))
      .mockReturnValueOnce(mockChain([{ currentAmount: "0" }]))
      .mockReturnValueOnce(mockChain([{ id: 2, currentBalance: "500000" }]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Emergency", accountId: 1, status: "Active", currentAmount: "0", targetAmount: "100000" }]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Emergency", accountId: 1, status: "Active", currentAmount: "5000", targetAmount: "100000" }]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ total: "0" }]))
      .mockReturnValueOnce(mockChain([{ total: "0" }]))
      .mockReturnValueOnce(mockChain([{ total: "0" }]))
      .mockReturnValueOnce(mockChain([]));
    const res = await request(app).post("/api/surplus/distribute").send({
      month: "2025-03", sourceAccountId: 2, allocations: [{ goalId: 1, amount: "5000" }],
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
