import { describe, it, expect } from "vitest";
import { db, mockChain } from "../test/db-mock";
import { calculateTotalEmiDue } from "../lib/emi-due";
import type { Account } from "@workspace/db";

function makeLoan(overrides: Partial<Account> = {}): Account {
  return {
    id: 1,
    name: "Home Loan",
    type: "loan",
    currentBalance: "500000",
    emiAmount: "10000",
    emiDay: 5,
    createdAt: new Date("2024-01-01"),
    creditLimit: null,
    billingDueDay: null,
    sharedLimitGroup: null,
    interestRate: null,
    loanTermMonths: null,
    ...overrides,
  } as Account;
}

describe("calculateTotalEmiDue", () => {
  it("returns zero for no loan accounts", async () => {
    const accounts = [
      { id: 1, name: "SBI", type: "bank", currentBalance: "100000" } as Account,
    ];
    const result = await calculateTotalEmiDue(accounts, "2025-03-01", "2025-03-31");
    expect(result.totalEmiDue).toBe(0);
    expect(result.activeLoanAccounts).toHaveLength(0);
  });

  it("returns zero for loan with zero balance", async () => {
    const accounts = [makeLoan({ currentBalance: "0" })];
    const result = await calculateTotalEmiDue(accounts, "2025-03-01", "2025-03-31");
    expect(result.totalEmiDue).toBe(0);
  });

  it("returns zero for loan with no emi amount", async () => {
    const accounts = [makeLoan({ emiAmount: null })];
    const result = await calculateTotalEmiDue(accounts, "2025-03-01", "2025-03-31");
    expect(result.totalEmiDue).toBe(0);
  });

  it("returns emi due when no payments made", async () => {
    const accounts = [makeLoan()];
    db.select.mockReturnValueOnce(mockChain([]));
    const result = await calculateTotalEmiDue(accounts, "2025-03-01", "2025-03-31");
    expect(result.totalEmiDue).toBe(10000);
    expect(result.activeLoanAccounts).toHaveLength(1);
  });

  it("returns zero when emi already paid", async () => {
    const accounts = [makeLoan()];
    db.select.mockReturnValueOnce(mockChain([{ toAccountId: 1, accountId: null }]));
    const result = await calculateTotalEmiDue(accounts, "2025-03-01", "2025-03-31");
    expect(result.totalEmiDue).toBe(0);
    expect(result.emiPaidLoanIds.has(1)).toBe(true);
  });

  it("recognizes payment via accountId", async () => {
    const accounts = [makeLoan()];
    db.select.mockReturnValueOnce(mockChain([{ toAccountId: null, accountId: 1 }]));
    const result = await calculateTotalEmiDue(accounts, "2025-03-01", "2025-03-31");
    expect(result.totalEmiDue).toBe(0);
  });

  it("skips newly created loan when emi day already passed", async () => {
    const accounts = [makeLoan({
      emiDay: 3,
      createdAt: new Date("2025-03-10"),
    })];
    db.select.mockReturnValueOnce(mockChain([]));
    const result = await calculateTotalEmiDue(accounts, "2025-03-01", "2025-03-31");
    expect(result.totalEmiDue).toBe(0);
  });

  it("includes newly created loan when emi day not yet passed", async () => {
    const accounts = [makeLoan({
      emiDay: 20,
      createdAt: new Date("2025-03-10"),
    })];
    db.select.mockReturnValueOnce(mockChain([]));
    const result = await calculateTotalEmiDue(accounts, "2025-03-01", "2025-03-31");
    expect(result.totalEmiDue).toBe(10000);
  });

  it("handles multiple loans", async () => {
    const accounts = [
      makeLoan({ id: 1, emiAmount: "10000" }),
      makeLoan({ id: 2, name: "Car Loan", emiAmount: "5000" }),
    ];
    db.select.mockReturnValueOnce(mockChain([{ toAccountId: 1, accountId: null }]));
    const result = await calculateTotalEmiDue(accounts, "2025-03-01", "2025-03-31");
    expect(result.totalEmiDue).toBe(5000);
  });

  it("handles loan without emiDay", async () => {
    const accounts = [makeLoan({ emiDay: null })];
    db.select.mockReturnValueOnce(mockChain([]));
    const result = await calculateTotalEmiDue(accounts, "2025-03-01", "2025-03-31");
    expect(result.totalEmiDue).toBe(10000);
  });

  it("handles loan created before cycle", async () => {
    const accounts = [makeLoan({
      emiDay: 15,
      createdAt: new Date("2024-01-01"),
    })];
    db.select.mockReturnValueOnce(mockChain([]));
    const result = await calculateTotalEmiDue(accounts, "2025-03-01", "2025-03-31");
    expect(result.totalEmiDue).toBe(10000);
  });
});
