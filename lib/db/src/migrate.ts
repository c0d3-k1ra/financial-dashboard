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

  await db.execute(sql`
    ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "billing_due_day" integer
  `);

  await db.execute(sql`
    ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "emi_amount" numeric(12, 2)
  `);
  await db.execute(sql`
    ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "emi_day" integer
  `);
  await db.execute(sql`
    ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "loan_tenure" integer
  `);
  await db.execute(sql`
    ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "interest_rate" numeric(5, 2)
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "goals" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" text NOT NULL,
      "target_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
      "current_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
      "account_id" integer NOT NULL REFERENCES "accounts"("id"),
      "status" text DEFAULT 'Active' NOT NULL,
      "target_date" date,
      "category_type" text DEFAULT 'General' NOT NULL,
      "icon" text
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "surplus_allocations" (
      "id" serial PRIMARY KEY NOT NULL,
      "month" text NOT NULL,
      "goal_id" integer NOT NULL REFERENCES "goals"("id"),
      "amount" numeric(12, 2) NOT NULL,
      "source_account_id" integer REFERENCES "accounts"("id"),
      "allocated_at" timestamp DEFAULT now() NOT NULL
    )
  `);

  await db.execute(sql`
    DO $$
    DECLARE
      default_account_id integer;
    BEGIN
      SELECT id INTO default_account_id FROM "accounts" WHERE LOWER("type") = 'bank' ORDER BY id LIMIT 1;

      IF EXISTS (
        SELECT FROM information_schema.tables WHERE table_name = 'goal_vaults'
      ) AND default_account_id IS NOT NULL THEN
        INSERT INTO "goals" ("name", "target_amount", "current_amount", "account_id", "status", "category_type")
        SELECT
          gv."name",
          COALESCE(gv."target_amount"::numeric(12,2), 0),
          COALESCE(gv."current_balance"::numeric(12,2), 0),
          default_account_id,
          CASE WHEN COALESCE(gv."current_balance"::numeric, 0) >= COALESCE(gv."target_amount"::numeric, 0) AND COALESCE(gv."target_amount"::numeric, 0) > 0 THEN 'Achieved' ELSE 'Active' END,
          'Emergency'
        FROM "goal_vaults" gv
        WHERE NOT EXISTS (
          SELECT 1 FROM "goals" g WHERE g."name" = gv."name"
        );
      END IF;

      IF default_account_id IS NOT NULL THEN
        UPDATE "goals" SET "account_id" = default_account_id WHERE "account_id" IS NULL;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'goals_account_id_not_null_check'
      ) THEN
        BEGIN
          ALTER TABLE "goals" ALTER COLUMN "account_id" SET NOT NULL;
        EXCEPTION WHEN others THEN NULL;
        END;
      END IF;
    END $$
  `);
}
