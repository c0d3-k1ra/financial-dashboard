import { beforeAll, beforeEach, afterAll, vi } from "vitest";
import { sql } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import { runStartupMigrations } from "@workspace/db/migrate";

vi.mock("../middlewares/authMiddleware", () => ({
  authMiddleware: (_req: any, _res: any, next: any) => {
    _req.user = { id: "test-user", name: "Test User" };
    _req.isAuthenticated = () => true;
    next();
  },
}));

beforeAll(async () => {
  const dbUrl = process.env.DATABASE_URL ?? "";
  if (dbUrl.includes("production") || dbUrl.includes("prod")) {
    throw new Error("SAFETY: Refusing to run tests against a production database. Set DATABASE_URL to a dev/test database.");
  }

  const result = await db.execute(sql`SELECT current_database() AS name`);
  const dbName = String((result as unknown as { rows: { name: string }[] }).rows?.[0]?.name ?? "");
  if (dbName.includes("prod")) {
    throw new Error(`SAFETY: Database name "${dbName}" appears to be a production database. Aborting tests.`);
  }

  await runStartupMigrations();
});

beforeEach(async () => {
  await db.execute(sql`
    DO $$
    BEGIN
      TRUNCATE TABLE surplus_allocations, transactions, budget_goals, goals, monthly_config, categories, accounts RESTART IDENTITY CASCADE;
    EXCEPTION WHEN undefined_table THEN
      NULL;
    END $$
  `);
});

afterAll(async () => {
  await pool.end();
});
