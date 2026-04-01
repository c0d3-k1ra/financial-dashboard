import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";
import type { AccountResponse, TransactionResponse } from "../test/types";

describe("Edge Cases", () => {
  it("E-04: decimal precision in amounts", async () => {
    const acc = await request(app).post("/api/accounts").send({ name: "DecimalBank", type: "bank", currentBalance: "10000.50" });
    expect(acc.status).toBe(201);
    const accBody = acc.body as AccountResponse;

    await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "1234.56", description: "Precise", category: "Food", type: "Expense", accountId: accBody.id,
    });

    const accounts = await request(app).get("/api/accounts");
    const updated = (accounts.body as AccountResponse[]).find(a => a.id === accBody.id);
    expect(Number(updated!.currentBalance)).toBeCloseTo(10000.50 - 1234.56, 2);
  });

  it("E-08: long description in transaction", async () => {
    const acc = await request(app).post("/api/accounts").send({ name: "LongDescBank", type: "bank", currentBalance: "50000" });
    const accBody = acc.body as AccountResponse;
    const longDesc = "A".repeat(500);

    const res = await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "100", description: longDesc, category: "Food", type: "Expense", accountId: accBody.id,
    });
    expect(res.status).toBe(201);
    const txn = res.body as TransactionResponse;
    expect(txn.description).toBe(longDesc);
  });

  it("E-09: special characters in account name (XSS safety)", async () => {
    const xssName = '<script>alert("xss")</script>';
    const res = await request(app).post("/api/accounts").send({ name: xssName, type: "bank" });
    expect(res.status).toBe(201);
    const body = res.body as AccountResponse;
    expect(body.name).toBe(xssName);
  });

  it("Special characters in transaction description (SQL injection safety)", async () => {
    const acc = await request(app).post("/api/accounts").send({ name: "InjBank", type: "bank", currentBalance: "50000" });
    const accBody = acc.body as AccountResponse;
    const dangerousDesc = "Robert'; DROP TABLE transactions;--";

    const res = await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "100", description: dangerousDesc, category: "Food", type: "Expense", accountId: accBody.id,
    });
    expect(res.status).toBe(201);

    const txns = await request(app).get("/api/transactions");
    const body = txns.body as TransactionResponse[];
    expect(body.length).toBeGreaterThan(0);
    expect(body[0].description).toBe(dangerousDesc);
  });

  it("Account name uniqueness constraint", async () => {
    const first = await request(app).post("/api/accounts").send({ name: "Unique Account", type: "bank" });
    expect(first.status).toBe(201);
    const res = await request(app).post("/api/accounts").send({ name: "Unique Account", type: "bank" });
    expect(res.status).toBe(400);
  });
});
