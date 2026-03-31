import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";
import type { AccountResponse, TransactionResponse } from "../test/types";

async function createAccount(name: string, balance = "50000"): Promise<AccountResponse> {
  const res = await request(app).post("/api/accounts").send({ name, type: "bank", currentBalance: balance });
  return res.body as AccountResponse;
}

describe("Transactions API", () => {
  it("T-01: create Income transaction updates balance positively", async () => {
    const acc = await createAccount("Bank1", "10000");
    const res = await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "5000", description: "Salary", category: "Paycheck (Salary)", type: "Income", accountId: acc.id,
    });
    expect(res.status).toBe(201);
    const txn = res.body as TransactionResponse;
    expect(txn.type).toBe("Income");

    const accounts = await request(app).get("/api/accounts");
    const updated = (accounts.body as AccountResponse[]).find(a => a.id === acc.id);
    expect(Number(updated!.currentBalance)).toBe(15000);
  });

  it("T-02: create Expense transaction updates balance negatively", async () => {
    const acc = await createAccount("Bank2", "10000");
    await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "3000", description: "Rent", category: "Living Expenses", type: "Expense", accountId: acc.id,
    });

    const accounts = await request(app).get("/api/accounts");
    const updated = (accounts.body as AccountResponse[]).find(a => a.id === acc.id);
    expect(Number(updated!.currentBalance)).toBe(7000);
  });

  it("T-03: reject missing required fields", async () => {
    const res = await request(app).post("/api/transactions").send({ date: "2025-03-01" });
    expect(res.status).toBe(400);
  });

  it("T-03b: reject negative amount", async () => {
    const acc = await createAccount("BankNeg");
    const res = await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "-500", description: "Negative", category: "Food", type: "Expense", accountId: acc.id,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("non-negative");
  });

  it("T-04: reject Transfer type via transactions endpoint", async () => {
    const acc = await createAccount("Bank3");
    const res = await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "1000", description: "Transfer", category: "Transfer", type: "Transfer", accountId: acc.id,
    });
    expect(res.status).toBe(400);
  });

  it("T-05: reject non-existent accountId", async () => {
    const res = await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "1000", description: "Test", category: "Food", type: "Expense", accountId: 99999,
    });
    expect(res.status).toBe(400);
  });

  it("T-06: update transaction amount with proper balance reversal", async () => {
    const acc = await createAccount("Bank4", "10000");
    const txn = await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "2000", description: "Groceries", category: "Food", type: "Expense", accountId: acc.id,
    });
    const txnBody = txn.body as TransactionResponse;

    const updated = await request(app).put(`/api/transactions/${txnBody.id}`).send({
      date: "2025-03-01", amount: "3000", description: "Groceries Updated", category: "Food", type: "Expense", accountId: acc.id,
    });
    expect(updated.status).toBe(200);

    const accounts = await request(app).get("/api/accounts");
    const accNow = (accounts.body as AccountResponse[]).find(a => a.id === acc.id);
    expect(Number(accNow!.currentBalance)).toBe(7000);
  });

  it("T-07: update transaction type from Income to Expense", async () => {
    const acc = await createAccount("Bank5", "10000");
    const txn = await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "1000", description: "Misc", category: "Other", type: "Income", accountId: acc.id,
    });
    const txnBody = txn.body as TransactionResponse;

    await request(app).put(`/api/transactions/${txnBody.id}`).send({
      date: "2025-03-01", amount: "1000", description: "Misc", category: "Other", type: "Expense", accountId: acc.id,
    });

    const accounts = await request(app).get("/api/accounts");
    const accNow = (accounts.body as AccountResponse[]).find(a => a.id === acc.id);
    expect(Number(accNow!.currentBalance)).toBe(9000);
  });

  it("T-08: update transaction account with balance reversal on old account", async () => {
    const acc1 = await createAccount("Bank6A", "10000");
    const acc2 = await createAccount("Bank6B", "10000");
    const txn = await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "2000", description: "Test", category: "Food", type: "Expense", accountId: acc1.id,
    });
    const txnBody = txn.body as TransactionResponse;

    await request(app).put(`/api/transactions/${txnBody.id}`).send({
      date: "2025-03-01", amount: "2000", description: "Test", category: "Food", type: "Expense", accountId: acc2.id,
    });

    const accounts = await request(app).get("/api/accounts");
    const a1 = (accounts.body as AccountResponse[]).find(a => a.id === acc1.id);
    const a2 = (accounts.body as AccountResponse[]).find(a => a.id === acc2.id);
    expect(Number(a1!.currentBalance)).toBe(10000);
    expect(Number(a2!.currentBalance)).toBe(8000);
  });

  it("T-09: delete Income restores balance", async () => {
    const acc = await createAccount("Bank7", "10000");
    const txn = await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "5000", description: "Salary", category: "Paycheck (Salary)", type: "Income", accountId: acc.id,
    });
    const txnBody = txn.body as TransactionResponse;

    await request(app).delete(`/api/transactions/${txnBody.id}`);

    const accounts = await request(app).get("/api/accounts");
    const accNow = (accounts.body as AccountResponse[]).find(a => a.id === acc.id);
    expect(Number(accNow!.currentBalance)).toBe(10000);
  });

  it("T-10: delete Expense restores balance", async () => {
    const acc = await createAccount("Bank8", "10000");
    const txn = await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "3000", description: "Rent", category: "Living Expenses", type: "Expense", accountId: acc.id,
    });
    const txnBody = txn.body as TransactionResponse;

    await request(app).delete(`/api/transactions/${txnBody.id}`);

    const accounts = await request(app).get("/api/accounts");
    const accNow = (accounts.body as AccountResponse[]).find(a => a.id === acc.id);
    expect(Number(accNow!.currentBalance)).toBe(10000);
  });

  it("T-11: delete Transfer restores both account balances", async () => {
    const acc1 = await createAccount("Bank9A", "10000");
    const acc2 = await createAccount("Bank9B", "5000");

    const transfer = await request(app).post("/api/transfers").send({
      date: "2025-03-01", amount: "2000", fromAccountId: acc1.id, toAccountId: acc2.id,
    });
    const transferBody = transfer.body as TransactionResponse;

    await request(app).delete(`/api/transactions/${transferBody.id}`);

    const accounts = await request(app).get("/api/accounts");
    const a1 = (accounts.body as AccountResponse[]).find(a => a.id === acc1.id);
    const a2 = (accounts.body as AccountResponse[]).find(a => a.id === acc2.id);
    expect(Number(a1!.currentBalance)).toBe(10000);
    expect(Number(a2!.currentBalance)).toBe(5000);
  });

  it("T-12: filter transactions by billing cycle dates", async () => {
    const acc = await createAccount("BankFilter", "50000");
    await request(app).post("/api/transactions").send({
      date: "2025-02-26", amount: "100", description: "In cycle", category: "Food", type: "Expense", accountId: acc.id,
    });
    await request(app).post("/api/transactions").send({
      date: "2025-01-20", amount: "200", description: "Out of cycle", category: "Food", type: "Expense", accountId: acc.id,
    });

    const res = await request(app).get("/api/transactions?cycleStart=2025-02-25&cycleEnd=2025-03-24");
    const body = res.body as TransactionResponse[];
    expect(body.length).toBe(1);
    expect(body[0].description).toBe("In cycle");
  });

  it("T-13: filter by type", async () => {
    const acc = await createAccount("BankFilter2", "50000");
    await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "100", description: "Income", category: "Paycheck (Salary)", type: "Income", accountId: acc.id,
    });
    await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "50", description: "Expense", category: "Food", type: "Expense", accountId: acc.id,
    });

    const res = await request(app).get("/api/transactions?type=Income");
    const body = res.body as TransactionResponse[];
    expect(body.length).toBe(1);
    expect(body[0].type).toBe("Income");
  });

  it("T-14: filter by search keyword", async () => {
    const acc = await createAccount("BankSearch", "50000");
    await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "100", description: "Monthly Rent Payment", category: "Living Expenses", type: "Expense", accountId: acc.id,
    });
    await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "50", description: "Groceries", category: "Food", type: "Expense", accountId: acc.id,
    });

    const res = await request(app).get("/api/transactions?search=Rent");
    const body = res.body as TransactionResponse[];
    expect(body.length).toBe(1);
    expect(body[0].description).toContain("Rent");
  });

  it("T-15: filter by category", async () => {
    const acc = await createAccount("BankCat", "50000");
    await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "100", description: "Lunch", category: "Food", type: "Expense", accountId: acc.id,
    });
    await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "200", description: "Bus", category: "Transportation", type: "Expense", accountId: acc.id,
    });

    const res = await request(app).get("/api/transactions?category=Food");
    const body = res.body as TransactionResponse[];
    expect(body.length).toBe(1);
    expect(body[0].category).toBe("Food");
  });

  it("T-16: combined filters", async () => {
    const acc = await createAccount("BankCombo", "50000");
    await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "100", description: "Lunch out", category: "Food", type: "Expense", accountId: acc.id,
    });
    await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "500", description: "Salary", category: "Paycheck (Salary)", type: "Income", accountId: acc.id,
    });

    const res = await request(app).get("/api/transactions?type=Expense&category=Food");
    const body = res.body as TransactionResponse[];
    expect(body.length).toBe(1);
    expect(body[0].category).toBe("Food");
    expect(body[0].type).toBe("Expense");
  });

  it("T-17: recent transactions excludes transfers", async () => {
    const acc1 = await createAccount("BankRecent1", "50000");
    const acc2 = await createAccount("BankRecent2", "10000");

    await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "100", description: "Food", category: "Food", type: "Expense", accountId: acc1.id,
    });
    await request(app).post("/api/transfers").send({
      date: "2025-03-01", amount: "500", fromAccountId: acc1.id, toAccountId: acc2.id,
    });

    const res = await request(app).get("/api/transactions/recent?limit=10");
    const body = res.body as TransactionResponse[];
    expect(body.every(t => t.type !== "Transfer")).toBe(true);
  });

  it("T-18: transactions ordered by date desc", async () => {
    const acc = await createAccount("BankOrder", "50000");
    await request(app).post("/api/transactions").send({
      date: "2025-01-01", amount: "100", description: "Old", category: "Food", type: "Expense", accountId: acc.id,
    });
    await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "200", description: "New", category: "Food", type: "Expense", accountId: acc.id,
    });

    const res = await request(app).get("/api/transactions");
    const body = res.body as TransactionResponse[];
    expect(body.length).toBe(2);
    expect(body[0].description).toBe("New");
    expect(body[1].description).toBe("Old");
  });

  it("T-18b: sort by amount (verify ordering in response)", async () => {
    const acc = await createAccount("BankSort", "50000");
    await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "500", description: "Small", category: "Food", type: "Expense", accountId: acc.id,
    });
    await request(app).post("/api/transactions").send({
      date: "2025-03-02", amount: "5000", description: "Large", category: "Food", type: "Expense", accountId: acc.id,
    });
    await request(app).post("/api/transactions").send({
      date: "2025-03-03", amount: "1500", description: "Medium", category: "Food", type: "Expense", accountId: acc.id,
    });

    const res = await request(app).get("/api/transactions");
    const body = res.body as TransactionResponse[];
    expect(body.length).toBe(3);
    const amounts = body.map(t => Number(t.amount));
    expect(amounts).toEqual(expect.arrayContaining([500, 5000, 1500]));
  });

  it("T-19: update non-existent transaction returns 404", async () => {
    const acc = await createAccount("BankMissing");
    const res = await request(app).put("/api/transactions/99999").send({
      date: "2025-03-01", amount: "100", description: "Test", category: "Food", type: "Expense", accountId: acc.id,
    });
    expect(res.status).toBe(404);
  });
});
