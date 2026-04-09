import { describe, it, expect } from "vitest";
import request from "supertest";
import { db, mockChain } from "../test/db-mock";
import app from "../app";

describe("Categories API", () => {
  it("GET /categories returns list", async () => {
    db.select.mockReturnValueOnce(
      mockChain([{ id: 1, name: "Food", type: "Expense" }])
    );
    const res = await request(app).get("/api/categories");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("GET /categories with type filter", async () => {
    db.select.mockReturnValueOnce(
      mockChain([{ id: 2, name: "Salary", type: "Income" }])
    );
    const res = await request(app).get("/api/categories?type=Income");
    expect(res.status).toBe(200);
  });

  it("GET /categories returns empty", async () => {
    const res = await request(app).get("/api/categories");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("POST /categories creates expense category with budget", async () => {
    db.insert.mockReturnValueOnce(mockChain([{ id: 1, name: "Food", type: "Expense" }]));
    db.select.mockReturnValueOnce(mockChain([]));
    const res = await request(app).post("/api/categories").send({
      name: "Food", type: "Expense",
    });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Food");
  });

  it("POST /categories creates income category without budget", async () => {
    db.insert.mockReturnValueOnce(mockChain([{ id: 2, name: "Salary", type: "Income" }]));
    const res = await request(app).post("/api/categories").send({
      name: "Salary", type: "Income",
    });
    expect(res.status).toBe(201);
  });

  it("POST /categories rejects empty body", async () => {
    const res = await request(app).post("/api/categories").send({});
    expect(res.status).toBe(400);
  });

  it("PATCH /categories/:id renames category", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Food", type: "Expense" }]))
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Groceries", type: "Expense" }]));
    const res = await request(app).patch("/api/categories/1").send({ name: "Groceries" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Groceries");
  });

  it("PATCH /categories/:id returns 404 when not found", async () => {
    const res = await request(app).patch("/api/categories/999").send({ name: "Test" });
    expect(res.status).toBe(404);
  });

  it("PATCH /categories/:id rejects empty name", async () => {
    const res = await request(app).patch("/api/categories/1").send({ name: "  " });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("non-empty");
  });

  it("PATCH /categories/:id rejects duplicate name", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Food", type: "Expense" }]))
      .mockReturnValueOnce(mockChain([{ id: 2, name: "Travel", type: "Expense" }]));
    const res = await request(app).patch("/api/categories/1").send({ name: "Travel" });
    expect(res.status).toBe(409);
  });

  it("PATCH /categories/:id allows same name", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Food", type: "Expense" }]))
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Food", type: "Expense" }]));
    const res = await request(app).patch("/api/categories/1").send({ name: "Food" });
    expect(res.status).toBe(200);
  });

  it("PATCH /categories/:id rejects invalid id", async () => {
    const res = await request(app).patch("/api/categories/abc").send({ name: "Test" });
    expect(res.status).toBe(400);
  });

  it("DELETE /categories/:id succeeds when no links", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Food", type: "Expense" }]))
      .mockReturnValueOnce(mockChain([{ count: 0 }]));
    const res = await request(app).delete("/api/categories/1");
    expect(res.status).toBe(204);
  });

  it("DELETE /categories/:id fails when transactions linked", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ id: 1, name: "Food", type: "Expense" }]))
      .mockReturnValueOnce(mockChain([{ count: 5 }]));
    const res = await request(app).delete("/api/categories/1");
    expect(res.status).toBe(409);
  });

  it("DELETE /categories/:id returns 404", async () => {
    const res = await request(app).delete("/api/categories/999");
    expect(res.status).toBe(404);
  });

  it("POST /categories with existing budget goal skips creation", async () => {
    db.insert.mockReturnValueOnce(mockChain([{ id: 3, name: "Custom", type: "Expense" }]));
    db.select.mockReturnValueOnce(mockChain([{ id: 10, categoryId: 3, plannedAmount: "2000" }]));
    const res = await request(app).post("/api/categories").send({
      name: "Custom", type: "Expense",
    });
    expect(res.status).toBe(201);
  });
});
