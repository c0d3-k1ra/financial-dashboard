import { beforeAll, beforeEach, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { db, pool } from "@workspace/db";

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
});

beforeEach(async () => {
  await db.execute(sql`
    TRUNCATE TABLE surplus_allocations, transactions, budget_goals, goals, goal_vaults, surplus_ledger, monthly_config, categories, accounts RESTART IDENTITY CASCADE
  `);
});

afterAll(async () => {
  await pool.end();
});
