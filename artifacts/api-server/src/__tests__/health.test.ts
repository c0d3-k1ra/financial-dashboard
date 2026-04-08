import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";

describe("Health & Validation API", () => {
  it("V-01: health check endpoint", async () => {
    const res = await request(app).get("/api/healthz");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("V-02: invalid JSON body", async () => {
    const res = await request(app)
      .post("/api/accounts")
      .set("Content-Type", "application/json")
      .send("not json{{{");
    expect(res.status).toBe(400);
  });

  it("V-03: unknown endpoint returns 404", async () => {
    const res = await request(app).get("/api/nonexistent");
    expect(res.status).toBe(404);
  });

  it("V-04: string where number expected in accountId", async () => {
    const res = await request(app).post("/api/transactions").send({
      date: "2025-03-01", amount: "100", description: "Test", category: "Food", type: "Expense", accountId: "not_a_number",
    });
    expect(res.status).toBe(400);
  });

  it("V-05: negative creditLimit is rejected", async () => {
    const res = await request(app).post("/api/accounts").send({
      name: "Negative CL", type: "credit_card", creditLimit: "-5000",
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("non-negative");
  });

  it("V-06: empty body on POST accounts", async () => {
    const res = await request(app).post("/api/accounts").send({});
    expect(res.status).toBe(400);
  });
});
