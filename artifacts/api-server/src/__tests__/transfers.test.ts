import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";
import type { AccountResponse, TransactionResponse } from "../test/types";

async function createAccount(name: string, type = "bank", balance = "50000"): Promise<AccountResponse> {
  const res = await request(app).post("/api/accounts").send({ name, type, currentBalance: balance });
  return res.body as AccountResponse;
}

describe("Transfers API", () => {
  it("TR-01: valid inter-account transfer updates both balances", async () => {
    const from = await createAccount("From Bank", "bank", "10000");
    const to = await createAccount("To Bank", "bank", "5000");

    const res = await request(app).post("/api/transfers").send({
      date: "2025-03-01", amount: "3000", fromAccountId: from.id, toAccountId: to.id,
    });
    expect(res.status).toBe(201);
    const txn = res.body as TransactionResponse;
    expect(txn.type).toBe("Transfer");
    expect(txn.accountId).toBe(from.id);
    expect(txn.toAccountId).toBe(to.id);

    const accounts = await request(app).get("/api/accounts");
    const fromAcc = (accounts.body as AccountResponse[]).find(a => a.id === from.id);
    const toAcc = (accounts.body as AccountResponse[]).find(a => a.id === to.id);
    expect(Number(fromAcc!.currentBalance)).toBe(7000);
    expect(Number(toAcc!.currentBalance)).toBe(8000);
  });

  it("TR-02: reject same-account transfer", async () => {
    const acc = await createAccount("Self Transfer");
    const res = await request(app).post("/api/transfers").send({
      date: "2025-03-01", amount: "1000", fromAccountId: acc.id, toAccountId: acc.id,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("different");
  });

  it("TR-03: transfer between Bank and Credit Card", async () => {
    const bank = await createAccount("Bank TR3", "bank", "50000");
    const cc = await createAccount("CC TR3", "credit_card", "-15000");

    const res = await request(app).post("/api/transfers").send({
      date: "2025-03-01", amount: "15000", fromAccountId: bank.id, toAccountId: cc.id, description: "CC Payment",
    });
    expect(res.status).toBe(201);

    const accounts = await request(app).get("/api/accounts");
    const bankAcc = (accounts.body as AccountResponse[]).find(a => a.id === bank.id);
    const ccAcc = (accounts.body as AccountResponse[]).find(a => a.id === cc.id);
    expect(Number(bankAcc!.currentBalance)).toBe(35000);
    expect(Number(ccAcc!.currentBalance)).toBe(0);
  });

  it("TR-04: reject transfer with non-existent account", async () => {
    const acc = await createAccount("Real Account");
    const res = await request(app).post("/api/transfers").send({
      date: "2025-03-01", amount: "1000", fromAccountId: acc.id, toAccountId: 99999,
    });
    expect(res.status).toBe(404);
  });
});
