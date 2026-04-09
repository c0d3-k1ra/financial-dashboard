import { describe, it, expect } from "vitest";
import request from "supertest";
import { db, mockChain } from "../test/db-mock";
import app from "../app";

describe("Transfers API", () => {
  it("POST /transfers creates transfer", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ id: 1, name: "SBI", type: "bank", currentBalance: "50000" }]))
      .mockReturnValueOnce(mockChain([{ id: 2, name: "HDFC", type: "bank", currentBalance: "20000" }]));
    db.insert.mockReturnValueOnce(
      mockChain([{ id: 1, date: "2025-03-01", amount: "5000", description: "Transfer: SBI → HDFC", category: "Transfer", type: "Transfer", accountId: 1, toAccountId: 2 }])
    );
    const res = await request(app).post("/api/transfers").send({
      fromAccountId: 1, toAccountId: 2, amount: "5000", date: "2025-03-01",
    });
    expect(res.status).toBe(201);
  });

  it("POST /transfers rejects same account", async () => {
    const res = await request(app).post("/api/transfers").send({
      fromAccountId: 1, toAccountId: 1, amount: "5000", date: "2025-03-01",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("different");
  });

  it("POST /transfers rejects non-positive amount", async () => {
    const res = await request(app).post("/api/transfers").send({
      fromAccountId: 1, toAccountId: 2, amount: "0", date: "2025-03-01",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("positive");
  });

  it("POST /transfers rejects missing from account", async () => {
    db.select.mockReturnValueOnce(mockChain([]));
    const res = await request(app).post("/api/transfers").send({
      fromAccountId: 999, toAccountId: 2, amount: "5000", date: "2025-03-01",
    });
    expect(res.status).toBe(404);
  });

  it("POST /transfers with description", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ id: 1, name: "SBI", type: "bank" }]))
      .mockReturnValueOnce(mockChain([{ id: 2, name: "HDFC", type: "bank" }]));
    db.insert.mockReturnValueOnce(
      mockChain([{ id: 2, date: "2025-03-01", amount: "1000", description: "Custom desc", category: "Transfer", type: "Transfer", accountId: 1, toAccountId: 2 }])
    );
    const res = await request(app).post("/api/transfers").send({
      fromAccountId: 1, toAccountId: 2, amount: "1000", date: "2025-03-01", description: "Custom desc",
    });
    expect(res.status).toBe(201);
  });

  it("POST /transfers rejects empty body", async () => {
    const res = await request(app).post("/api/transfers").send({});
    expect(res.status).toBe(400);
  });
});
