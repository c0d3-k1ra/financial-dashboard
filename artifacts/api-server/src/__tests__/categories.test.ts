import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";
import type { CategoryResponse } from "../test/types";

describe("Categories API", () => {
  it("C-01: create expense category", async () => {
    const res = await request(app).post("/api/categories").send({ name: "Groceries", type: "Expense" });
    expect(res.status).toBe(201);
    const body = res.body as CategoryResponse;
    expect(body.name).toBe("Groceries");
    expect(body.type).toBe("Expense");
  });

  it("C-02: create income category", async () => {
    const res = await request(app).post("/api/categories").send({ name: "Freelance", type: "Income" });
    expect(res.status).toBe(201);
    const body = res.body as CategoryResponse;
    expect(body.type).toBe("Income");
  });

  it("C-03: list categories", async () => {
    await request(app).post("/api/categories").send({ name: "Food", type: "Expense" });
    await request(app).post("/api/categories").send({ name: "Salary", type: "Income" });

    const res = await request(app).get("/api/categories");
    expect(res.status).toBe(200);
    const body = res.body as CategoryResponse[];
    expect(body.length).toBe(2);
  });

  it("C-04: filter categories by type", async () => {
    await request(app).post("/api/categories").send({ name: "Food", type: "Expense" });
    await request(app).post("/api/categories").send({ name: "Salary", type: "Income" });

    const res = await request(app).get("/api/categories?type=Expense");
    const body = res.body as CategoryResponse[];
    expect(body.length).toBe(1);
    expect(body[0].type).toBe("Expense");
  });

  it("C-05: delete unused category", async () => {
    const cat = await request(app).post("/api/categories").send({ name: "ToDelete", type: "Expense" });
    const catBody = cat.body as CategoryResponse;
    const res = await request(app).delete(`/api/categories/${catBody.id}`);
    expect(res.status).toBe(204);

    const list = await request(app).get("/api/categories");
    const body = list.body as CategoryResponse[];
    expect(body.length).toBe(0);
  });

  it("C-05b: delete category even when transactions reference it (no FK)", async () => {
    const acc = await request(app).post("/api/accounts").send({ name: "CatBank", type: "bank", currentBalance: "50000" });
    const cat = await request(app).post("/api/categories").send({ name: "InUse", type: "Expense" });
    const catBody = cat.body as CategoryResponse;

    await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "100", description: "Test", category: "InUse", type: "Expense", accountId: acc.body.id,
    });

    const res = await request(app).delete(`/api/categories/${catBody.id}`);
    expect(res.status).toBe(204);
  });
});
