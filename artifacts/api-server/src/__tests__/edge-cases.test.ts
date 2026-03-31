import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";
import type { AccountResponse, TransactionResponse, GoalVaultResponse } from "../test/types";

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

  it("E-11: surplus ledger month uniqueness", async () => {
    const { db, surplusLedgerTable } = await import("@workspace/db");

    await db.insert(surplusLedgerTable).values({ month: "2025-03", amount: "5000", vaultName: "Emergency Fund" });

    let duplicateError = false;
    try {
      await db.insert(surplusLedgerTable).values({ month: "2025-03", amount: "3000", vaultName: "Travel" });
    } catch {
      duplicateError = true;
    }
    expect(duplicateError).toBe(true);
  });

  it("E-11b: goal vault name uniqueness (via HTTP upsert)", async () => {
    const res1 = await request(app).post("/api/goal-vaults").send({
      name: "Emergency Fund (IDFC)", currentBalance: "50000", targetAmount: "300000",
    });
    expect(res1.status).toBe(200);
    const vault1 = res1.body as GoalVaultResponse;
    expect(Number(vault1.currentBalance)).toBe(50000);

    const res2 = await request(app).post("/api/goal-vaults").send({
      name: "Emergency Fund (IDFC)", currentBalance: "75000", targetAmount: "300000",
    });
    expect(res2.status).toBe(200);
    const vault2 = res2.body as GoalVaultResponse;
    expect(Number(vault2.currentBalance)).toBe(75000);
    expect(vault1.id).toBe(vault2.id);
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
