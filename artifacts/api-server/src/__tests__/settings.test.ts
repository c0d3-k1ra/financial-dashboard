import { describe, it, expect } from "vitest";
import request from "supertest";
import { db, mockChain } from "../test/db-mock";
import app from "../app";

describe("Settings API", () => {
  it("GET /settings returns defaults when empty", async () => {
    const res = await request(app).get("/api/settings");
    expect(res.status).toBe(200);
    expect(res.body.billingCycleDay).toBe(25);
    expect(res.body.currencyCode).toBe("INR");
  });

  it("GET /settings returns existing settings", async () => {
    db.select.mockReturnValueOnce(
      mockChain([{ id: 1, billingCycleDay: 15, currencyCode: "USD" }])
    );
    const res = await request(app).get("/api/settings");
    expect(res.status).toBe(200);
    expect(res.body.billingCycleDay).toBe(15);
    expect(res.body.currencyCode).toBe("USD");
  });

  it("PUT /settings updates billing day", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ id: 1, billingCycleDay: 25, currencyCode: "INR" }]))
      .mockReturnValueOnce(mockChain([{ id: 1, billingCycleDay: 15, currencyCode: "INR" }]));
    const res = await request(app).put("/api/settings").send({ billingCycleDay: 15 });
    expect(res.status).toBe(200);
    expect(res.body.billingCycleDay).toBe(15);
  });

  it("PUT /settings creates when not exists", async () => {
    db.select
      .mockReturnValueOnce(mockChain([]))
      .mockReturnValueOnce(mockChain([{ id: 1, billingCycleDay: 10, currencyCode: "INR" }]));
    const res = await request(app).put("/api/settings").send({ billingCycleDay: 10 });
    expect(res.status).toBe(200);
  });

  it("PUT /settings rejects invalid billing day", async () => {
    const res = await request(app).put("/api/settings").send({ billingCycleDay: 30 });
    expect(res.status).toBe(400);
  });

  it("PUT /settings rejects billing day < 1", async () => {
    const res = await request(app).put("/api/settings").send({ billingCycleDay: 0 });
    expect(res.status).toBe(400);
  });

  it("PUT /settings rejects invalid currency", async () => {
    const res = await request(app).put("/api/settings").send({ currencyCode: "XYZ" });
    expect(res.status).toBe(400);
  });

  it("PUT /settings rejects empty body", async () => {
    const res = await request(app).put("/api/settings").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("No valid fields");
  });

  it("PUT /settings updates currency", async () => {
    db.select
      .mockReturnValueOnce(mockChain([{ id: 1, billingCycleDay: 25, currencyCode: "INR" }]))
      .mockReturnValueOnce(mockChain([{ id: 1, billingCycleDay: 25, currencyCode: "USD" }]));
    const res = await request(app).put("/api/settings").send({ currencyCode: "USD" });
    expect(res.status).toBe(200);
    expect(res.body.currencyCode).toBe("USD");
  });

  it("POST /settings/reset-data resets all data", async () => {
    const res = await request(app).post("/api/settings/reset-data");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe("Monthly Config API", () => {
  it("GET /monthly-config returns list", async () => {
    db.select.mockReturnValueOnce(
      mockChain([{ id: 1, month: "2025-03", startingBalance: "100000" }])
    );
    const res = await request(app).get("/api/monthly-config");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("POST /monthly-config creates new", async () => {
    db.insert.mockReturnValueOnce(
      mockChain([{ id: 1, month: "2025-03", startingBalance: "50000" }])
    );
    const res = await request(app).post("/api/monthly-config").send({
      month: "2025-03", startingBalance: "50000",
    });
    expect(res.status).toBe(200);
  });

  it("POST /monthly-config upserts existing", async () => {
    db.select.mockReturnValueOnce(
      mockChain([{ id: 1, month: "2025-03", startingBalance: "50000" }])
    );
    db.update.mockReturnValueOnce(
      mockChain([{ id: 1, month: "2025-03", startingBalance: "60000" }])
    );
    const res = await request(app).post("/api/monthly-config").send({
      month: "2025-03", startingBalance: "60000",
    });
    expect(res.status).toBe(200);
  });

  it("DELETE /monthly-config/:id deletes", async () => {
    const res = await request(app).delete("/api/monthly-config/1");
    expect(res.status).toBe(204);
  });

  it("DELETE /monthly-config/:id rejects invalid id", async () => {
    const res = await request(app).delete("/api/monthly-config/abc");
    expect(res.status).toBe(400);
  });

  it("POST /monthly-config rejects empty body", async () => {
    const res = await request(app).post("/api/monthly-config").send({});
    expect(res.status).toBe(400);
  });
});
