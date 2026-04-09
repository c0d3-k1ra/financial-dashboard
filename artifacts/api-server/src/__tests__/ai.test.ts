import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { db, mockChain } from "../test/db-mock";
import app from "../app";

vi.mock("../lib/ai-client", () => ({
  getAnthropicClient: vi.fn().mockResolvedValue({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: '{"intent":"add_transaction","transactionType":"Expense","amount":"500","date":"2025-03-01","description":"Coffee","category":"Food","accountId":1}' }],
      }),
    },
  }),
}));

describe("AI Parse API", () => {
  it("POST /ai/parse parses add_transaction", async () => {
    const { getAnthropicClient } = await import("../lib/ai-client");
    (getAnthropicClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: '{"intent":"add_transaction","transactionType":"Expense","amount":"500","date":"2025-03-01","description":"Coffee","category":"Food","accountId":1}' }],
        }),
      },
    });
    db.select.mockReturnValueOnce(mockChain([]));
    const res = await request(app).post("/api/ai/parse").send({
      text: "Spent 500 at Starbucks",
      categories: [{ id: 1, name: "Food", type: "Expense" }],
      accounts: [{ id: 1, name: "SBI", type: "bank" }],
    });
    expect(res.status).toBe(200);
    expect(res.body.intent).toBe("add_transaction");
  });

  it("POST /ai/parse parses transfer intent", async () => {
    const { getAnthropicClient } = await import("../lib/ai-client");
    (getAnthropicClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: '{"intent":"transfer","amount":"5000","date":"2025-03-01","description":"Transfer","fromAccountId":1,"toAccountId":2}' }],
        }),
      },
    });
    db.select.mockReturnValueOnce(mockChain([]));
    const res = await request(app).post("/api/ai/parse").send({
      text: "Transfer 5000 from SBI to HDFC",
      categories: [], accounts: [{ id: 1, name: "SBI", type: "bank" }, { id: 2, name: "HDFC", type: "bank" }],
    });
    expect(res.status).toBe(200);
    expect(res.body.intent).toBe("transfer");
  });

  it("POST /ai/parse parses add_category intent", async () => {
    const { getAnthropicClient } = await import("../lib/ai-client");
    (getAnthropicClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: '{"intent":"add_category","categoryName":"Subscriptions","categoryType":"Expense"}' }],
        }),
      },
    });
    db.select.mockReturnValueOnce(mockChain([]));
    db.insert.mockReturnValueOnce(mockChain([{ id: 5, name: "Subscriptions", type: "Expense" }]));
    db.select.mockReturnValueOnce(mockChain([]));
    const res = await request(app).post("/api/ai/parse").send({
      text: "Add a category called Subscriptions",
      categories: [], accounts: [],
    });
    expect(res.status).toBe(200);
    expect(res.body.intent).toBe("add_category");
    expect(res.body.createdEntityName).toBe("Subscriptions");
  });

  it("POST /ai/parse parses add_account intent", async () => {
    const { getAnthropicClient } = await import("../lib/ai-client");
    (getAnthropicClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: '{"intent":"add_account","accountName":"Amex","accountType":"credit_card","billingDueDay":15}' }],
        }),
      },
    });
    db.select.mockReturnValueOnce(mockChain([]));
    db.insert.mockReturnValueOnce(mockChain([{ id: 3, name: "Amex", type: "credit_card" }]));
    const res = await request(app).post("/api/ai/parse").send({
      text: "Add a credit card called Amex with due date on 15th",
      categories: [], accounts: [],
    });
    expect(res.status).toBe(200);
    expect(res.body.intent).toBe("add_account");
    expect(res.body.createdEntityName).toBe("Amex");
  });

  it("POST /ai/parse parses set_budget intent", async () => {
    const { getAnthropicClient } = await import("../lib/ai-client");
    (getAnthropicClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: '{"intent":"set_budget","categoryName":"Food","plannedAmount":"8000"}' }],
        }),
      },
    });
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Food", type: "Expense" }]))
      .mockReturnValueOnce(mockChain([]));
    db.insert.mockReturnValueOnce(mockChain([{ id: 1, categoryId: 1, plannedAmount: "8000" }]));
    const res = await request(app).post("/api/ai/parse").send({
      text: "Set food budget to 8000",
      categories: [{ id: 1, name: "Food", type: "Expense" }], accounts: [],
    });
    expect(res.status).toBe(200);
    expect(res.body.intent).toBe("set_budget");
  });

  it("POST /ai/parse set_budget updates existing", async () => {
    const { getAnthropicClient } = await import("../lib/ai-client");
    (getAnthropicClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: '{"intent":"set_budget","categoryName":"Food","plannedAmount":"10000"}' }],
        }),
      },
    });
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Food", type: "Expense" }]))
      .mockReturnValueOnce(mockChain([{ id: 5, categoryId: 1, plannedAmount: "8000" }]));
    db.update.mockReturnValueOnce(mockChain([{ id: 5, categoryId: 1, plannedAmount: "10000" }]));
    const res = await request(app).post("/api/ai/parse").send({
      text: "Change food budget to 10000",
      categories: [{ id: 1, name: "Food", type: "Expense" }], accounts: [],
    });
    expect(res.status).toBe(200);
    expect(res.body.intent).toBe("set_budget");
  });

  it("POST /ai/parse set_budget category not found", async () => {
    const { getAnthropicClient } = await import("../lib/ai-client");
    (getAnthropicClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: '{"intent":"set_budget","categoryName":"NonExistent","plannedAmount":"5000"}' }],
        }),
      },
    });
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([]));
    const res = await request(app).post("/api/ai/parse").send({
      text: "Set budget for NonExistent to 5000",
      categories: [], accounts: [],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("not found");
  });

  it("POST /ai/parse parses add_savings_goal intent", async () => {
    const { getAnthropicClient } = await import("../lib/ai-client");
    (getAnthropicClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: '{"intent":"add_savings_goal","goalName":"Vacation","targetAmount":"50000","targetDate":"2025-12-31","categoryType":"Travel"}' }],
        }),
      },
    });
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "SBI", type: "bank", currentBalance: "500000" }]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "SBI", currentBalance: "500000" }]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([]));
    db.insert.mockReturnValueOnce(mockChain([{ id: 1, name: "Vacation", targetAmount: "50000" }]));
    const res = await request(app).post("/api/ai/parse").send({
      text: "Save 50000 for vacation by December",
      categories: [], accounts: [{ id: 1, name: "SBI", type: "bank" }],
    });
    expect(res.status).toBe(200);
    expect(res.body.intent).toBe("add_savings_goal");
  });

  it("POST /ai/parse add_savings_goal no accounts", async () => {
    const { getAnthropicClient } = await import("../lib/ai-client");
    (getAnthropicClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: '{"intent":"add_savings_goal","goalName":"Goal","targetAmount":"10000","categoryType":"General"}' }],
        }),
      },
    });
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([]));
    const res = await request(app).post("/api/ai/parse").send({
      text: "Save 10000",
      categories: [], accounts: [],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("No accounts");
  });

  it("POST /ai/parse unknown intent", async () => {
    const { getAnthropicClient } = await import("../lib/ai-client");
    (getAnthropicClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: '{"intent":"unknown_action"}' }],
        }),
      },
    });
    db.select.mockReturnValueOnce(mockChain([]));
    const res = await request(app).post("/api/ai/parse").send({
      text: "Do something weird",
      categories: [], accounts: [],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Could not determine");
  });

  it("POST /ai/parse handles non-text block", async () => {
    const { getAnthropicClient } = await import("../lib/ai-client");
    (getAnthropicClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "image", text: "" }],
        }),
      },
    });
    db.select.mockReturnValueOnce(mockChain([]));
    const res = await request(app).post("/api/ai/parse").send({
      text: "Test",
      categories: [], accounts: [],
    });
    expect(res.status).toBe(500);
  });

  it("POST /ai/parse handles invalid JSON response", async () => {
    const { getAnthropicClient } = await import("../lib/ai-client");
    (getAnthropicClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "not json" }],
        }),
      },
    });
    db.select.mockReturnValueOnce(mockChain([]));
    const res = await request(app).post("/api/ai/parse").send({
      text: "Test",
      categories: [], accounts: [],
    });
    expect(res.status).toBe(500);
  });

  it("POST /ai/parse rejects empty body", async () => {
    const res = await request(app).post("/api/ai/parse").send({});
    expect(res.status).toBe(400);
  });

  it("POST /ai/parse add_category with invalid name returns 400", async () => {
    const { getAnthropicClient } = await import("../lib/ai-client");
    (getAnthropicClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: '{"intent":"add_category","categoryName":"","categoryType":"Expense"}' }],
        }),
      },
    });
    db.select.mockReturnValueOnce(mockChain([]));
    const res = await request(app).post("/api/ai/parse").send({
      text: "Add a category", categories: [], accounts: [],
    });
    expect(res.status).toBe(400);
  });

  it("POST /ai/parse add_account with invalid name returns 400", async () => {
    const { getAnthropicClient } = await import("../lib/ai-client");
    (getAnthropicClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: '{"intent":"add_account","accountName":"","accountType":"bank"}' }],
        }),
      },
    });
    db.select.mockReturnValueOnce(mockChain([]));
    const res = await request(app).post("/api/ai/parse").send({
      text: "Add an account", categories: [], accounts: [],
    });
    expect(res.status).toBe(400);
  });

  it("POST /ai/parse set_budget with invalid amount returns 400", async () => {
    const { getAnthropicClient } = await import("../lib/ai-client");
    (getAnthropicClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: '{"intent":"set_budget","categoryName":"Food","plannedAmount":"0"}' }],
        }),
      },
    });
    db.select.mockReturnValueOnce(mockChain([]));
    const res = await request(app).post("/api/ai/parse").send({
      text: "Set budget", categories: [], accounts: [],
    });
    expect(res.status).toBe(400);
  });

  it("POST /ai/parse add_savings_goal with invalid amount returns 400", async () => {
    const { getAnthropicClient } = await import("../lib/ai-client");
    (getAnthropicClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: '{"intent":"add_savings_goal","goalName":"","targetAmount":"0"}' }],
        }),
      },
    });
    db.select.mockReturnValueOnce(mockChain([]));
    const res = await request(app).post("/api/ai/parse").send({
      text: "Save", categories: [], accounts: [],
    });
    expect(res.status).toBe(400);
  });

  it("POST /ai/parse add_category income type", async () => {
    const { getAnthropicClient } = await import("../lib/ai-client");
    (getAnthropicClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: '{"intent":"add_category","categoryName":"Freelance","categoryType":"Income"}' }],
        }),
      },
    });
    db.select.mockReturnValueOnce(mockChain([]));
    db.insert.mockReturnValueOnce(mockChain([{ id: 6, name: "Freelance", type: "Income" }]));
    const res = await request(app).post("/api/ai/parse").send({
      text: "Add income category Freelance", categories: [], accounts: [],
    });
    expect(res.status).toBe(200);
    expect(res.body.intent).toBe("add_category");
  });
});

describe("AI Chat API", () => {
  it("POST /ai/chat handles conversation", async () => {
    const { getAnthropicClient } = await import("../lib/ai-client");
    (getAnthropicClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: '{"reply":"Got it, 500 at Starbucks. Which category?","type":"question","transaction":{"transactionType":"Expense","amount":"500","description":"Starbucks","date":"2025-03-01"}}' }],
        }),
      },
    });
    const res = await request(app).post("/api/ai/chat").send({
      messages: [{ role: "user", content: "Spent 500 at Starbucks" }],
      categories: [{ name: "Food", type: "Expense" }],
      accounts: [{ id: 1, name: "SBI", type: "bank" }],
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("reply");
  });

  it("POST /ai/chat rejects empty messages", async () => {
    const res = await request(app).post("/api/ai/chat").send({
      messages: [],
      categories: [{ name: "Food", type: "Expense" }],
      accounts: [{ id: 1, name: "SBI", type: "bank" }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("empty");
  });

  it("POST /ai/chat rejects no user message", async () => {
    const res = await request(app).post("/api/ai/chat").send({
      messages: [{ role: "assistant", content: "Hello" }],
      categories: [], accounts: [],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("No user message");
  });

  it("POST /ai/chat handles __create_category__ command", async () => {
    db.insert.mockReturnValueOnce(mockChain([{ id: 5, name: "Drinks", type: "Expense" }]));
    const res = await request(app).post("/api/ai/chat").send({
      messages: [{ role: "user", content: "__create_category__:Drinks" }],
      categories: [], accounts: [],
    });
    expect(res.status).toBe(200);
    expect(res.body.reply).toContain("Created category");
  });

  it("POST /ai/chat handles __create_category__ with pending tx", async () => {
    db.insert.mockReturnValueOnce(mockChain([{ id: 5, name: "Drinks", type: "Expense" }]));
    const res = await request(app).post("/api/ai/chat").send({
      messages: [
        { role: "assistant", content: '{"transaction":{"amount":"500","description":"Starbucks"}}' },
        { role: "user", content: "__create_category__:Drinks" },
      ],
      categories: [], accounts: [],
    });
    expect(res.status).toBe(200);
    expect(res.body.type).toBe("confirmation");
  });

  it("POST /ai/chat handles __create_account__ command", async () => {
    const res = await request(app).post("/api/ai/chat").send({
      messages: [{ role: "user", content: "__create_account__" }],
      categories: [], accounts: [],
    });
    expect(res.status).toBe(200);
    expect(res.body.reply).toContain("account");
    expect(res.body.options).toHaveLength(2);
  });

  it("POST /ai/chat detects query intent", async () => {
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([
        { description: "Coffee", amount: "300", category: "Food", accountId: 1 },
      ]));
    const res = await request(app).post("/api/ai/chat").send({
      messages: [{ role: "user", content: "How much did I spend today?" }],
      categories: [{ name: "Food", type: "Expense" }],
      accounts: [{ id: 1, name: "SBI", type: "bank" }],
    });
    expect(res.status).toBe(200);
    expect(res.body.type).toBe("query_result");
  });

  it("POST /ai/chat confirm endpoint stores mapping", async () => {
    const res = await request(app).post("/api/ai/chat/confirm").send({
      description: "Starbucks",
      category: "Food",
      accountId: 1,
    });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("POST /ai/chat confirm without description", async () => {
    const res = await request(app).post("/api/ai/chat/confirm").send({});
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("POST /ai/chat handles non-text AI block", async () => {
    const { getAnthropicClient } = await import("../lib/ai-client");
    (getAnthropicClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "image", text: "" }],
        }),
      },
    });
    const res = await request(app).post("/api/ai/chat").send({
      messages: [{ role: "user", content: "Hello" }],
      categories: [], accounts: [],
    });
    expect(res.status).toBe(500);
  });

  it("POST /ai/chat handles unparseable AI response", async () => {
    const { getAnthropicClient } = await import("../lib/ai-client");
    (getAnthropicClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "not json at all" }],
        }),
      },
    });
    const res = await request(app).post("/api/ai/chat").send({
      messages: [{ role: "user", content: "Hello" }],
      categories: [], accounts: [],
    });
    expect(res.status).toBe(200);
    expect(res.body.type).toBe("error");
  });

  it("POST /ai/chat handles confirmation with category validation", async () => {
    const { getAnthropicClient } = await import("../lib/ai-client");
    (getAnthropicClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: '{"reply":"Confirm","type":"confirmation","transaction":{"transactionType":"Expense","amount":"500","date":"2025-03-01","description":"Test","category":"NonExistent","accountId":1}}' }],
        }),
      },
    });
    const res = await request(app).post("/api/ai/chat").send({
      messages: [{ role: "user", content: "Log 500 for Test" }],
      categories: [{ name: "Food", type: "Expense" }],
      accounts: [{ id: 1, name: "SBI", type: "bank" }],
    });
    expect(res.status).toBe(200);
    expect(res.body.type).toBe("question");
    expect(res.body.reply).toContain("don't see a category");
  });

  it("POST /ai/chat handles confirmation with valid category", async () => {
    const { getAnthropicClient } = await import("../lib/ai-client");
    (getAnthropicClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: '{"reply":"Confirm","type":"confirmation","transaction":{"transactionType":"Expense","amount":"500","date":"2025-03-01","description":"Starbucks","category":"Food","accountId":1}}' }],
        }),
      },
    });
    const res = await request(app).post("/api/ai/chat").send({
      messages: [{ role: "user", content: "Log 500 for Starbucks" }],
      categories: [{ name: "Food", type: "Expense" }],
      accounts: [{ id: 1, name: "SBI", type: "bank" }],
    });
    expect(res.status).toBe(200);
    expect(res.body.type).toBe("confirmation");
  });
});
