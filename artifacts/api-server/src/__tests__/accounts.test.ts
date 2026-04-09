import { describe, it, expect } from "vitest";
import request from "supertest";
import { db, mockChain } from "../test/db-mock";
import app from "../app";

describe("Accounts API", () => {
  it("GET /accounts returns list", async () => {
    db.select.mockReturnValueOnce(
      mockChain([{ id: 1, name: "Bank", type: "bank", currentBalance: "10000", creditLimit: null, billingDueDay: null, emiAmount: null, emiDay: null, loanTenure: null, interestRate: null, linkedAccountId: null, useInSurplus: false, sharedLimitGroup: null, originalLoanAmount: null, loanStartDate: null, emisPaid: 0, createdAt: new Date() }])
    );
    const res = await request(app).get("/api/accounts");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("Bank");
  });

  it("GET /accounts returns empty", async () => {
    const res = await request(app).get("/api/accounts");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("POST /accounts creates bank account", async () => {
    db.insert.mockReturnValueOnce(
      mockChain([{ id: 1, name: "SBI", type: "bank", currentBalance: "5000" }])
    );
    const res = await request(app).post("/api/accounts").send({
      name: "SBI", type: "bank", currentBalance: "5000",
    });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("SBI");
  });

  it("POST /accounts rejects negative credit limit", async () => {
    const res = await request(app).post("/api/accounts").send({
      name: "Bad CC", type: "credit_card", creditLimit: "-5000",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("non-negative");
  });

  it("POST /accounts rejects empty body", async () => {
    const res = await request(app).post("/api/accounts").send({});
    expect(res.status).toBe(400);
  });

  it("POST /accounts creates CC with shared limit group", async () => {
    db.select.mockReturnValueOnce(mockChain([{ creditLimit: "100000" }]));
    db.insert.mockReturnValueOnce(
      mockChain([{ id: 2, name: "HDFC CC", type: "credit_card", currentBalance: "0", sharedLimitGroup: "shared1", creditLimit: "100000" }])
    );
    const res = await request(app).post("/api/accounts").send({
      name: "HDFC CC", type: "credit_card", sharedLimitGroup: "shared1",
    });
    expect(res.status).toBe(201);
  });

  it("POST /accounts creates loan", async () => {
    db.insert.mockReturnValueOnce(
      mockChain([{ id: 3, name: "Home Loan", type: "loan", currentBalance: "500000", originalLoanAmount: "500000" }])
    );
    const res = await request(app).post("/api/accounts").send({
      name: "Home Loan", type: "loan", originalLoanAmount: "500000",
      emiAmount: "5000", emiDay: 5, loanTenure: 120, interestRate: "8.5",
    });
    expect(res.status).toBe(201);
  });

  it("POST /accounts rejects loan without originalLoanAmount", async () => {
    const res = await request(app).post("/api/accounts").send({
      name: "Bad Loan", type: "loan",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Original loan amount");
  });

  it("POST /accounts creates CC with sharedLimitGroup and creditLimit syncs group", async () => {
    db.select.mockReturnValueOnce(mockChain([]));
    db.insert.mockReturnValueOnce(
      mockChain([{ id: 5, name: "CC2", type: "credit_card", sharedLimitGroup: "grp", creditLimit: "50000" }])
    );
    const res = await request(app).post("/api/accounts").send({
      name: "CC2", type: "credit_card", sharedLimitGroup: "grp", creditLimit: "50000",
    });
    expect(res.status).toBe(201);
  });

  it("POST /accounts rejects billingDueDay out of range", async () => {
    const res = await request(app).post("/api/accounts").send({
      name: "Bad", type: "credit_card", billingDueDay: 35,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("billingDueDay");
  });

  it("POST /accounts rejects negative emi for loan", async () => {
    const res = await request(app).post("/api/accounts").send({
      name: "Bad Loan", type: "loan", originalLoanAmount: "10000", emiAmount: "-100",
    });
    expect(res.status).toBe(400);
  });

  it("PUT /accounts/:id rejects loan validation", async () => {
    const res = await request(app).put("/api/accounts/1").send({
      name: "Home Loan", type: "loan",
    });
    expect(res.status).toBe(400);
  });

  it("PUT /accounts/:id with shared limit group and credit limit", async () => {
    db.update.mockReturnValueOnce(
      mockChain([{ id: 1, name: "CC1", type: "credit_card", sharedLimitGroup: "shared" }])
    );
    const res = await request(app).put("/api/accounts/1").send({
      name: "CC1", type: "credit_card", sharedLimitGroup: "shared", creditLimit: "100000",
    });
    expect(res.status).toBe(200);
    expect(db.update).toHaveBeenCalledTimes(2);
  });

  it("PUT /accounts/:id updates account", async () => {
    db.update.mockReturnValueOnce(
      mockChain([{ id: 1, name: "Updated", type: "bank", currentBalance: "9999" }])
    );
    const res = await request(app).put("/api/accounts/1").send({
      name: "Updated", type: "bank", currentBalance: "9999",
    });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Updated");
  });

  it("PUT /accounts/:id returns 404 when not found", async () => {
    db.update.mockReturnValueOnce(mockChain([]));
    const res = await request(app).put("/api/accounts/999").send({
      name: "Ghost", type: "bank",
    });
    expect(res.status).toBe(404);
  });

  it("PUT /accounts/:id rejects invalid id", async () => {
    const res = await request(app).put("/api/accounts/abc").send({
      name: "Bad", type: "bank",
    });
    expect(res.status).toBe(400);
  });

  it("PUT /accounts with shared limit group", async () => {
    db.select.mockReturnValueOnce(mockChain([{ creditLimit: "80000" }]));
    db.update.mockReturnValueOnce(
      mockChain([{ id: 1, name: "CC", type: "credit_card", sharedLimitGroup: "g1" }])
    );
    const res = await request(app).put("/api/accounts/1").send({
      name: "CC", type: "credit_card", sharedLimitGroup: "g1",
    });
    expect(res.status).toBe(200);
  });

  it("DELETE /accounts/:id succeeds when no links", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ count: 0 }]))
      .mockReturnValueOnce(mockChain([{ count: 0 }]))
      .mockReturnValueOnce(mockChain([{ count: 0 }]));
    const res = await request(app).delete("/api/accounts/1");
    expect(res.status).toBe(204);
  });

  it("DELETE /accounts/:id fails when transactions linked", async () => {
    db.select.mockReturnValueOnce(mockChain([{ count: 3 }]));
    const res = await request(app).delete("/api/accounts/1");
    expect(res.status).toBe(409);
    expect(res.body.error).toContain("transaction");
  });

  it("DELETE /accounts/:id fails when goals linked", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ count: 0 }]))
      .mockReturnValueOnce(mockChain([{ count: 2 }]));
    const res = await request(app).delete("/api/accounts/1");
    expect(res.status).toBe(409);
    expect(res.body.error).toContain("goal");
  });

  it("DELETE /accounts/:id fails when allocations linked", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ count: 0 }]))
      .mockReturnValueOnce(mockChain([{ count: 0 }]))
      .mockReturnValueOnce(mockChain([{ count: 1 }]));
    const res = await request(app).delete("/api/accounts/1");
    expect(res.status).toBe(409);
    expect(res.body.error).toContain("surplus allocation");
  });

  it("POST /accounts/:id/reconcile adjusts balance", async () => {
    db.select.mockReturnValueOnce(
      mockChain([{ id: 1, name: "Bank", currentBalance: "10000" }])
    );
    const res = await request(app).post("/api/accounts/1/reconcile").send({
      actualBalance: "12000",
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.adjustment).toBe("2000.00");
  });

  it("POST /accounts/:id/reconcile returns 404", async () => {
    const res = await request(app).post("/api/accounts/999/reconcile").send({
      actualBalance: "100",
    });
    expect(res.status).toBe(404);
  });

  it("POST /accounts/:id/reconcile no adjustment when same balance", async () => {
    db.select.mockReturnValueOnce(
      mockChain([{ id: 1, name: "Bank", currentBalance: "5000" }])
    );
    const res = await request(app).post("/api/accounts/1/reconcile").send({
      actualBalance: "5000",
    });
    expect(res.status).toBe(200);
    expect(res.body.adjustment).toBe("0.00");
  });

  it("POST /accounts/process-emis with no active loans", async () => {
    const res = await request(app).post("/api/accounts/process-emis").send({
      month: "2025-03",
    });
    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(0);
  });

  it("POST /accounts/process-emis with invalid month format", async () => {
    const res = await request(app).post("/api/accounts/process-emis").send({
      month: "2025-13",
    });
    expect(res.status).toBe(400);
  });

  it("POST /accounts/process-emis with active loan", async () => {
    const loan = {
      id: 1, name: "PL", type: "loan", currentBalance: "100000",
      emiAmount: "5000", emiDay: 5, interestRate: "12", loanTenure: 24,
      linkedAccountId: null, emisPaid: 0, createdAt: new Date("2024-01-01"),
      creditLimit: null, billingDueDay: null, useInSurplus: false,
      sharedLimitGroup: null, originalLoanAmount: "100000", loanStartDate: null,
    };
    db.select
      .mockReturnValueOnce(mockChain([loan]))
      .mockReturnValueOnce(mockChain([loan]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ count: 0 }]));
    const res = await request(app).post("/api/accounts/process-emis").send({
      month: "2025-03",
    });
    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(1);
  });

  it("POST /accounts/process-emis with linked account", async () => {
    const bank = {
      id: 2, name: "SBI", type: "bank", currentBalance: "500000",
      emiAmount: null, emiDay: null, interestRate: null, loanTenure: null,
      linkedAccountId: null, emisPaid: null, createdAt: new Date("2023-01-01"),
      creditLimit: null, billingDueDay: null, useInSurplus: false,
      sharedLimitGroup: null, originalLoanAmount: null, loanStartDate: null,
    };
    const loan = {
      id: 1, name: "PL", type: "loan", currentBalance: "100000",
      emiAmount: "5000", emiDay: 5, interestRate: "12", loanTenure: 24,
      linkedAccountId: 2, emisPaid: 0, createdAt: new Date("2024-01-01"),
      creditLimit: null, billingDueDay: null, useInSurplus: false,
      sharedLimitGroup: null, originalLoanAmount: "100000", loanStartDate: null,
    };
    db.select
      .mockReturnValueOnce(mockChain([loan]))
      .mockReturnValueOnce(mockChain([loan, bank]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ count: 0 }]));
    const res = await request(app).post("/api/accounts/process-emis").send({
      month: "2025-03",
    });
    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(1);
  });

  it("POST /accounts/process-emis skips already processed", async () => {
    const loan = {
      id: 1, name: "PL", type: "loan", currentBalance: "100000",
      emiAmount: "5000", emiDay: 5, interestRate: "12", loanTenure: 24,
      linkedAccountId: null, emisPaid: 3, createdAt: new Date("2024-01-01"),
      creditLimit: null, billingDueDay: null, useInSurplus: false,
      sharedLimitGroup: null, originalLoanAmount: "100000", loanStartDate: null,
    };
    db.select
      .mockReturnValueOnce(mockChain([loan]))
      .mockReturnValueOnce(mockChain([loan]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ count: 1 }]));
    const res = await request(app).post("/api/accounts/process-emis").send({
      month: "2025-03",
    });
    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(0);
  });

  it("PUT /accounts/:id updates loan with all loan fields", async () => {
    db.update.mockReturnValueOnce(
      mockChain([{ id: 1, name: "Home Loan", type: "loan", currentBalance: "450000",
        emiAmount: "5000", emiDay: 5, loanTenure: 120, interestRate: "8.5",
        linkedAccountId: 2, originalLoanAmount: "500000", loanStartDate: "2024-01-01", emisPaid: 6 }])
    );
    const res = await request(app).put("/api/accounts/1").send({
      name: "Home Loan", type: "loan", currentBalance: "450000",
      emiAmount: "5000", emiDay: 5, loanTenure: 120, interestRate: "8.5",
      linkedAccountId: 2, originalLoanAmount: "500000", loanStartDate: "2024-01-01", emisPaid: 6,
    });
    expect(res.status).toBe(200);
  });

  it("PUT /accounts/:id updates non-loan clears loan fields", async () => {
    db.update.mockReturnValueOnce(
      mockChain([{ id: 1, name: "SBI", type: "bank", currentBalance: "100000" }])
    );
    const res = await request(app).put("/api/accounts/1").send({
      name: "SBI", type: "bank", currentBalance: "100000",
    });
    expect(res.status).toBe(200);
  });

  it("POST /accounts/process-emis with linked account and interest", async () => {
    const loan = {
      id: 3, name: "Car Loan", type: "loan", currentBalance: "100000",
      emiAmount: "5000", emiDay: 15, loanTenure: 24, interestRate: "12",
      linkedAccountId: 1, emisPaid: 5, useInSurplus: false,
      creditLimit: null, billingDueDay: null, sharedLimitGroup: null,
      originalLoanAmount: "150000", loanStartDate: "2024-01-01",
    };
    const bankAcct = { id: 1, name: "SBI", type: "bank", currentBalance: "500000" };
    db.select
      .mockReturnValueOnce(mockChain([loan]))
      .mockReturnValueOnce(mockChain([bankAcct, loan]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ count: 0 }]))
      .mockReturnValueOnce(mockChain([{ id: 3, name: "Car Loan", type: "loan", currentBalance: "96000" }]));
    const res = await request(app).post("/api/accounts/process-emis").send({ month: "2025-03" });
    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(1);
  });

  it("POST /accounts/process-emis with null currentBalance and interestRate", async () => {
    const loan = {
      id: 3, name: "Simple Loan", type: "loan", currentBalance: null,
      emiAmount: "5000", emiDay: null, loanTenure: null, interestRate: null,
      linkedAccountId: null, emisPaid: null, useInSurplus: false,
      creditLimit: null, billingDueDay: null, sharedLimitGroup: null,
      originalLoanAmount: "50000", loanStartDate: null,
    };
    db.select
      .mockReturnValueOnce(mockChain([loan]))
      .mockReturnValueOnce(mockChain([loan]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ count: 0 }]))
      .mockReturnValueOnce(mockChain([{ id: 3, name: "Simple Loan", type: "loan", currentBalance: "0" }]));
    const res = await request(app).post("/api/accounts/process-emis").send({ month: "2025-03" });
    expect(res.status).toBe(200);
  });

  it("POST /accounts/process-emis final payment", async () => {
    const loan = {
      id: 3, name: "Finish Loan", type: "loan", currentBalance: "100",
      emiAmount: "5000", emiDay: 28, loanTenure: 12, interestRate: "10",
      linkedAccountId: null, emisPaid: 11, useInSurplus: false,
      creditLimit: null, billingDueDay: null, sharedLimitGroup: null,
      originalLoanAmount: "50000", loanStartDate: null,
    };
    db.select
      .mockReturnValueOnce(mockChain([loan]))
      .mockReturnValueOnce(mockChain([loan]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ count: 0 }]))
      .mockReturnValueOnce(mockChain([]));
    const res = await request(app).post("/api/accounts/process-emis").send({ month: "2025-02" });
    expect(res.status).toBe(200);
  });
});
