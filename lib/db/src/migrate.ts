import { sql } from "drizzle-orm";
import { db } from "./index";

export async function runStartupMigrations() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "accounts" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "type" text NOT NULL,
      "current_balance" numeric(12, 2) DEFAULT '0' NOT NULL,
      "credit_limit" numeric(12, 2)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "categories" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "type" text NOT NULL
    )
  `);

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "account_id" integer;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$
  `);

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "to_account_id" integer;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$
  `);

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "transactions"
        ADD CONSTRAINT "transactions_account_id_accounts_id_fk"
        FOREIGN KEY ("account_id") REFERENCES "accounts"("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `);

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "transactions"
        ADD CONSTRAINT "transactions_to_account_id_accounts_id_fk"
        FOREIGN KEY ("to_account_id") REFERENCES "accounts"("id")
        ON DELETE NO ACTION ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `);
}
