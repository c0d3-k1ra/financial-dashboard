import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";

describe("Health API", () => {
  it("GET /healthz returns ok", async () => {
    const res = await request(app).get("/api/healthz");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
