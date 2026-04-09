import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { db, mockChain } from "../test/db-mock";
import app from "../app";

vi.mock("../lib/ai-client", () => ({
  getAnthropicClient: vi.fn().mockResolvedValue({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: '{"transactionType":"Expense","amount":"500","date":"2025-03-01","description":"Coffee","category":"Food","accountId":1}' }],
      }),
    },
  }),
}));

describe("Transactions API", () => {
  it("GET /transactions returns list", async () => {
    db.select.mockReturnValueOnce(
      mockChain([{ id: 1, date: "2025-03-01", amount: "500", description: "Test", category: "Food", type: "Expense", accountId: 1, toAccountId: null, createdAt: new Date() }])
    );
    const res = await request(app).get("/api/transactions");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("GET /transactions with month filter", async () => {
    const res = await request(app).get("/api/transactions?month=2025-03");
    expect(res.status).toBe(200);
  });

  it("GET /transactions with cycle filter", async () => {
    const res = await request(app).get("/api/transactions?cycleStart=2025-02-25&cycleEnd=2025-03-24");
    expect(res.status).toBe(200);
  });

  it("GET /transactions with type filter", async () => {
    const res = await request(app).get("/api/transactions?type=Expense");
    expect(res.status).toBe(200);
  });

  it("GET /transactions with category filter", async () => {
    const res = await request(app).get("/api/transactions?category=Food");
    expect(res.status).toBe(200);
  });

  it("GET /transactions with search filter", async () => {
    const res = await request(app).get("/api/transactions?search=coffee");
    expect(res.status).toBe(200);
  });

  it("GET /transactions with accountId filter", async () => {
    const res = await request(app).get("/api/transactions?accountId=1");
    expect(res.status).toBe(200);
  });

  it("GET /transactions with amount range", async () => {
    const res = await request(app).get("/api/transactions?amountMin=100&amountMax=500");
    expect(res.status).toBe(200);
  });

  it("GET /transactions/recent returns limited results", async () => {
    const res = await request(app).get("/api/transactions/recent?limit=5");
    expect(res.status).toBe(200);
  });

  it("GET /transactions/recent default limit", async () => {
    const res = await request(app).get("/api/transactions/recent");
    expect(res.status).toBe(200);
  });

  it("POST /transactions creates expense", async () => {
    db.select.mockReturnValueOnce(mockChain([{ id: 1 }]));
    db.insert.mockReturnValueOnce(
      mockChain([{ id: 1, date: "2025-03-01", amount: "500", description: "Coffee", category: "Food", type: "Expense", accountId: 1 }])
    );
    const res = await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "500", description: "Coffee",
      category: "Food", type: "Expense", accountId: 1,
    });
    expect(res.status).toBe(201);
  });

  it("POST /transactions creates income", async () => {
    db.select.mockReturnValueOnce(mockChain([{ id: 1 }]));
    db.insert.mockReturnValueOnce(
      mockChain([{ id: 2, date: "2025-03-01", amount: "50000", description: "Salary", category: "Salary", type: "Income", accountId: 1 }])
    );
    const res = await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "50000", description: "Salary",
      category: "Salary", type: "Income", accountId: 1,
    });
    expect(res.status).toBe(201);
  });

  it("POST /transactions rejects transfer type", async () => {
    const res = await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "500", description: "Transfer",
      category: "Transfer", type: "Transfer", accountId: 1,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("transfers");
  });

  it("POST /transactions rejects negative amount", async () => {
    const res = await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "-500", description: "Bad",
      category: "Food", type: "Expense", accountId: 1,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("non-negative");
  });

  it("POST /transactions rejects missing account", async () => {
    const res = await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "500", description: "Bad",
      category: "Food", type: "Expense", accountId: 999,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Account not found");
  });

  it("PUT /transactions/:id updates", async () => {
    db.select.mockReturnValueOnce(
      mockChain([{ id: 1, date: "2025-03-01", amount: "500", description: "Old", category: "Food", type: "Expense", accountId: 1 }])
    );
    db.update.mockReturnValueOnce(
      mockChain([{ id: 1, date: "2025-03-01", amount: "600", description: "New", category: "Food", type: "Expense", accountId: 1 }])
    );
    const res = await request(app).put("/api/transactions/1").send({
      date: "2025-03-01", amount: "600", description: "New",
      category: "Food", type: "Expense", accountId: 1,
    });
    expect(res.status).toBe(200);
  });

  it("PUT /transactions/:id updates income to expense", async () => {
    db.select.mockReturnValueOnce(
      mockChain([{ id: 1, date: "2025-03-01", amount: "500", description: "Old", category: "Salary", type: "Income", accountId: 1 }])
    );
    db.update.mockReturnValueOnce(
      mockChain([{ id: 1, date: "2025-03-01", amount: "500", description: "New", category: "Food", type: "Expense", accountId: 1 }])
    );
    const res = await request(app).put("/api/transactions/1").send({
      date: "2025-03-01", amount: "500", description: "New",
      category: "Food", type: "Expense", accountId: 1,
    });
    expect(res.status).toBe(200);
  });

  it("PUT /transactions/:id returns 404", async () => {
    const res = await request(app).put("/api/transactions/999").send({
      date: "2025-03-01", amount: "500", description: "New",
      category: "Food", type: "Expense", accountId: 1,
    });
    expect(res.status).toBe(404);
  });

  it("PUT /transactions/:id rejects editing transfer", async () => {
    db.select.mockReturnValueOnce(
      mockChain([{ id: 1, date: "2025-03-01", amount: "500", description: "Transfer", category: "Transfer", type: "Transfer", accountId: 1, toAccountId: 2 }])
    );
    const res = await request(app).put("/api/transactions/1").send({
      date: "2025-03-01", amount: "500", description: "New",
      category: "Food", type: "Expense", accountId: 1,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Transfer transactions cannot be edited");
  });

  it("PUT /transactions/:id rejects transfer type", async () => {
    const res = await request(app).put("/api/transactions/1").send({
      date: "2025-03-01", amount: "500", description: "Transfer",
      category: "Transfer", type: "Transfer", accountId: 1,
    });
    expect(res.status).toBe(400);
  });

  it("PUT /transactions/:id rejects negative amount", async () => {
    const res = await request(app).put("/api/transactions/1").send({
      date: "2025-03-01", amount: "-500", description: "Bad",
      category: "Food", type: "Expense", accountId: 1,
    });
    expect(res.status).toBe(400);
  });

  it("DELETE /transactions/:id deletes expense", async () => {
    db.select.mockReturnValueOnce(
      mockChain([{ id: 1, date: "2025-03-01", amount: "500", description: "Test", category: "Food", type: "Expense", accountId: 1 }])
    );
    const res = await request(app).delete("/api/transactions/1");
    expect(res.status).toBe(204);
  });

  it("DELETE /transactions/:id deletes income", async () => {
    db.select.mockReturnValueOnce(
      mockChain([{ id: 1, date: "2025-03-01", amount: "5000", description: "Salary", category: "Salary", type: "Income", accountId: 1 }])
    );
    const res = await request(app).delete("/api/transactions/1");
    expect(res.status).toBe(204);
  });

  it("DELETE /transactions/:id deletes transfer (reverses balances)", async () => {
    db.select.mockReturnValueOnce(
      mockChain([{ id: 1, date: "2025-03-01", amount: "1000", description: "Transfer", category: "Transfer", type: "Transfer", accountId: 1, toAccountId: 2 }])
    );
    db.select
      .mockReturnValueOnce(mockChain([{ id: 1, type: "bank" }]))
      .mockReturnValueOnce(mockChain([{ id: 2, type: "credit_card" }]));
    const res = await request(app).delete("/api/transactions/1");
    expect(res.status).toBe(204);
  });

  it("DELETE /transactions/:id for non-existent is 204", async () => {
    const res = await request(app).delete("/api/transactions/999");
    expect(res.status).toBe(204);
  });

  it("POST /transactions/parse-natural parses text", async () => {
    const { getAnthropicClient } = await import("../lib/ai-client");
    (getAnthropicClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: '{"transactionType":"Expense","amount":"500","date":"2025-03-01","description":"Starbucks","category":"Food","accountId":1}' }],
        }),
      },
    });
    const res = await request(app).post("/api/transactions/parse-natural").send({
      text: "Spent 500 at Starbucks",
      categories: [{ name: "Food", type: "Expense" }],
      accounts: [{ id: 1, name: "SBI", type: "bank" }],
    });
    expect(res.status).toBe(200);
    expect(res.body.amount).toBe("500");
  });

  it("POST /transactions/parse-natural handles non-text block", async () => {
    const { getAnthropicClient } = await import("../lib/ai-client");
    (getAnthropicClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "image", text: "" }],
        }),
      },
    });
    const res = await request(app).post("/api/transactions/parse-natural").send({
      text: "Test", categories: [], accounts: [],
    });
    expect(res.status).toBe(500);
  });

  it("POST /transactions/parse-natural handles invalid JSON", async () => {
    const { getAnthropicClient } = await import("../lib/ai-client");
    (getAnthropicClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "not json" }],
        }),
      },
    });
    const res = await request(app).post("/api/transactions/parse-natural").send({
      text: "Test", categories: [], accounts: [],
    });
    expect(res.status).toBe(500);
  });

  it("POST /transactions/parse-natural rejects empty body", async () => {
    const res = await request(app).post("/api/transactions/parse-natural").send({});
    expect(res.status).toBe(400);
  });

  it("PUT /transactions/:id updates income to income", async () => {
    db.select.mockReturnValueOnce(
      mockChain([{ id: 1, date: "2025-03-01", amount: "5000", description: "Salary", category: "Salary", type: "Income", accountId: 1 }])
    );
    db.update.mockReturnValueOnce(
      mockChain([{ id: 1, date: "2025-03-01", amount: "6000", description: "Salary Updated", category: "Salary", type: "Income", accountId: 1 }])
    );
    const res = await request(app).put("/api/transactions/1").send({
      date: "2025-03-01", amount: "6000", description: "Salary Updated",
      category: "Salary", type: "Income", accountId: 1,
    });
    expect(res.status).toBe(200);
  });

  it("PUT /transactions/:id existing with no accountId", async () => {
    db.select.mockReturnValueOnce(
      mockChain([{ id: 1, date: "2025-03-01", amount: "500", description: "Old", category: "Food", type: "Expense", accountId: null }])
    );
    db.update.mockReturnValueOnce(
      mockChain([{ id: 1, date: "2025-03-01", amount: "500", description: "New", category: "Food", type: "Expense", accountId: 1 }])
    );
    const res = await request(app).put("/api/transactions/1").send({
      date: "2025-03-01", amount: "500", description: "New",
      category: "Food", type: "Expense", accountId: 1,
    });
    expect(res.status).toBe(200);
  });

  it("DELETE /transactions/:id deletes transfer from debt to bank", async () => {
    db.select.mockReturnValueOnce(
      mockChain([{ id: 1, date: "2025-03-01", amount: "1000", description: "CC Payment", category: "Transfer", type: "Transfer", accountId: 1, toAccountId: 2 }])
    );
    db.select
      .mockReturnValueOnce(mockChain([{ id: 1, type: "credit_card" }]))
      .mockReturnValueOnce(mockChain([{ id: 2, type: "bank" }]));
    const res = await request(app).delete("/api/transactions/1");
    expect(res.status).toBe(204);
  });

  it("DELETE /transactions/:id deletes transfer with no toAccountId", async () => {
    db.select.mockReturnValueOnce(
      mockChain([{ id: 1, date: "2025-03-01", amount: "1000", description: "Transfer", category: "Transfer", type: "Transfer", accountId: 1, toAccountId: null }])
    );
    db.select.mockReturnValueOnce(mockChain([{ id: 1, type: "bank" }]));
    const res = await request(app).delete("/api/transactions/1");
    expect(res.status).toBe(204);
  });

  it("DELETE /transactions/:id deletes transfer with no fromAccountId", async () => {
    db.select.mockReturnValueOnce(
      mockChain([{ id: 1, date: "2025-03-01", amount: "1000", description: "Transfer", category: "Transfer", type: "Transfer", accountId: null, toAccountId: 2 }])
    );
    db.select.mockReturnValueOnce(mockChain([{ id: 2, type: "loan" }]));
    const res = await request(app).delete("/api/transactions/1");
    expect(res.status).toBe(204);
  });

  it("DELETE /transactions/:id with no accountId on expense", async () => {
    db.select.mockReturnValueOnce(
      mockChain([{ id: 1, date: "2025-03-01", amount: "500", description: "Test", category: "Food", type: "Expense", accountId: null }])
    );
    const res = await request(app).delete("/api/transactions/1");
    expect(res.status).toBe(204);
  });

  it("POST /transactions/parse-natural with null fields in parsed response", async () => {
    const { getAnthropicClient } = await import("../lib/ai-client");
    (getAnthropicClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: '{"transactionType":null,"amount":null}' }],
        }),
      },
    });
    const res = await request(app).post("/api/transactions/parse-natural").send({
      text: "Something vague", categories: [], accounts: [],
    });
    expect(res.status).toBe(200);
    expect(res.body.transactionType).toBeNull();
    expect(res.body.amount).toBeNull();
  });
});
