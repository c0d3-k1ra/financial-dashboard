import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";
import type { AccountResponse, TransactionResponse } from "../test/types";

describe("Accounts API", () => {
  it("A-01: create a Bank account with valid data", async () => {
    const res = await request(app)
      .post("/api/accounts")
      .send({ name: "HDFC Savings", type: "bank", currentBalance: "50000" });
    expect(res.status).toBe(201);
    const body = res.body as AccountResponse;
    expect(body.name).toBe("HDFC Savings");
    expect(body.type).toBe("bank");
    expect(Number(body.currentBalance)).toBe(50000);
  });

  it("A-02: create a Credit Card account with creditLimit and billingDueDay", async () => {
    const res = await request(app)
      .post("/api/accounts")
      .send({ name: "ICICI Amazon", type: "credit_card", currentBalance: "0", creditLimit: "200000", billingDueDay: 15 });
    expect(res.status).toBe(201);
    const body = res.body as AccountResponse;
    expect(body.type).toBe("credit_card");
    expect(body.billingDueDay).toBe(15);
    expect(Number(body.creditLimit)).toBe(200000);
  });

  it("A-03: reject duplicate account names (unique constraint)", async () => {
    const first = await request(app).post("/api/accounts").send({ name: "HDFC Savings", type: "bank" });
    expect(first.status).toBe(201);
    const res = await request(app).post("/api/accounts").send({ name: "HDFC Savings", type: "bank" });
    expect(res.status).toBe(400);
  });

  it("A-04: reject invalid billingDueDay (0)", async () => {
    const res = await request(app)
      .post("/api/accounts")
      .send({ name: "Bad Account", type: "bank", billingDueDay: 0 });
    expect(res.status).toBe(400);
  });

  it("A-05: reject invalid billingDueDay (32)", async () => {
    const res = await request(app)
      .post("/api/accounts")
      .send({ name: "Bad Account", type: "bank", billingDueDay: 32 });
    expect(res.status).toBe(400);
  });

  it("A-06: creditLimit stored even for Bank type (no type-based filtering)", async () => {
    const res = await request(app)
      .post("/api/accounts")
      .send({ name: "SBI Savings", type: "bank", creditLimit: "100000" });
    expect(res.status).toBe(201);
    const body = res.body as AccountResponse;
    expect(Number(body.creditLimit)).toBe(100000);
  });

  it("A-07: zero balance default", async () => {
    const res = await request(app)
      .post("/api/accounts")
      .send({ name: "Empty Account", type: "bank" });
    expect(res.status).toBe(201);
    const body = res.body as AccountResponse;
    expect(Number(body.currentBalance)).toBe(0);
  });

  it("A-08: list all accounts", async () => {
    await request(app).post("/api/accounts").send({ name: "Acc1", type: "bank" });
    await request(app).post("/api/accounts").send({ name: "Acc2", type: "credit_card" });
    const res = await request(app).get("/api/accounts");
    expect(res.status).toBe(200);
    const body = res.body as AccountResponse[];
    expect(body.length).toBe(2);
  });

  it("A-09: update account name", async () => {
    const created = await request(app).post("/api/accounts").send({ name: "Old Name", type: "bank" });
    const createdBody = created.body as AccountResponse;
    const res = await request(app)
      .put(`/api/accounts/${createdBody.id}`)
      .send({ name: "New Name", type: "bank" });
    expect(res.status).toBe(200);
    const body = res.body as AccountResponse;
    expect(body.name).toBe("New Name");
  });

  it("A-10: update creditLimit on credit card", async () => {
    const created = await request(app)
      .post("/api/accounts")
      .send({ name: "CC", type: "credit_card", creditLimit: "100000", billingDueDay: 10 });
    const createdBody = created.body as AccountResponse;
    const res = await request(app)
      .put(`/api/accounts/${createdBody.id}`)
      .send({ name: "CC", type: "credit_card", creditLimit: "200000", billingDueDay: 10 });
    expect(res.status).toBe(200);
    const body = res.body as AccountResponse;
    expect(Number(body.creditLimit)).toBe(200000);
  });

  it("A-11: update billingDueDay", async () => {
    const created = await request(app)
      .post("/api/accounts")
      .send({ name: "CC", type: "credit_card", billingDueDay: 10 });
    const createdBody = created.body as AccountResponse;
    const res = await request(app)
      .put(`/api/accounts/${createdBody.id}`)
      .send({ name: "CC", type: "credit_card", billingDueDay: 20 });
    expect(res.status).toBe(200);
    const body = res.body as AccountResponse;
    expect(body.billingDueDay).toBe(20);
  });

  it("A-12: delete account with no linked transactions", async () => {
    const created = await request(app).post("/api/accounts").send({ name: "ToDelete", type: "bank" });
    const createdBody = created.body as AccountResponse;
    const res = await request(app).delete(`/api/accounts/${createdBody.id}`);
    expect(res.status).toBe(204);
  });

  it("A-13: delete account with linked transactions returns 409", async () => {
    const acc = await request(app).post("/api/accounts").send({ name: "HasTxns", type: "bank", currentBalance: "10000" });
    const accBody = acc.body as AccountResponse;
    await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "100", description: "Test", category: "Food", type: "Expense", accountId: accBody.id,
    });
    const res = await request(app).delete(`/api/accounts/${accBody.id}`);
    expect(res.status).toBe(409);
  });

  it("A-14: reconcile with higher balance creates adjustment transaction", async () => {
    const acc = await request(app).post("/api/accounts").send({ name: "Recon", type: "bank", currentBalance: "10000" });
    const accBody = acc.body as AccountResponse;
    const res = await request(app)
      .post(`/api/accounts/${accBody.id}/reconcile`)
      .send({ actualBalance: "12000" });
    expect(res.status).toBe(200);
    expect(res.body.previousBalance).toBe("10000.00");
    expect(res.body.newBalance).toBe("12000.00");
    expect(res.body.adjustment).toBe("2000.00");

    const txns = await request(app).get("/api/transactions");
    const body = txns.body as TransactionResponse[];
    const adj = body.find(t => t.description.includes("Balance Adjustment"));
    expect(adj).toBeDefined();
    expect(adj!.type).toBe("Income");
    expect(Number(adj!.amount)).toBe(2000);
  });

  it("A-14b: reconcile with lower balance creates expense adjustment transaction", async () => {
    const acc = await request(app).post("/api/accounts").send({ name: "ReconLow", type: "bank", currentBalance: "10000" });
    const accBody = acc.body as AccountResponse;
    const res = await request(app)
      .post(`/api/accounts/${accBody.id}/reconcile`)
      .send({ actualBalance: "8000" });
    expect(res.status).toBe(200);
    expect(res.body.previousBalance).toBe("10000.00");
    expect(res.body.newBalance).toBe("8000.00");
    expect(res.body.adjustment).toBe("-2000.00");

    const txns = await request(app).get("/api/transactions");
    const body = txns.body as TransactionResponse[];
    const adj = body.find(t => t.description.includes("Balance Adjustment"));
    expect(adj).toBeDefined();
    expect(adj!.type).toBe("Expense");
    expect(Number(adj!.amount)).toBe(2000);
  });

  it("A-15: reconcile with equal balance creates no adjustment transaction", async () => {
    const acc = await request(app).post("/api/accounts").send({ name: "Recon2", type: "bank", currentBalance: "10000" });
    const accBody = acc.body as AccountResponse;
    const res = await request(app)
      .post(`/api/accounts/${accBody.id}/reconcile`)
      .send({ actualBalance: "10000" });
    expect(res.status).toBe(200);
    expect(res.body.adjustment).toBe("0.00");

    const txns = await request(app).get("/api/transactions");
    const body = txns.body as TransactionResponse[];
    const adj = body.find(t => t.description.includes("Balance Adjustment"));
    expect(adj).toBeUndefined();
  });
});
