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
    CREATE TABLE IF NOT EXISTS "app_settings" (
      "id" serial PRIMARY KEY NOT NULL,
      "billing_cycle_day" integer NOT NULL DEFAULT 25,
      "currency_code" text NOT NULL DEFAULT 'INR'
    )
  `);

  await db.execute(sql`
    INSERT INTO "app_settings" ("id", "billing_cycle_day", "currency_code")
    VALUES (1, 25, 'INR')
    ON CONFLICT ("id") DO NOTHING
  `);

  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'budget_goals' AND column_name = 'category'
      ) THEN
        ALTER TABLE "budget_goals" ADD COLUMN IF NOT EXISTS "category_id" integer;

        UPDATE "budget_goals" bg
        SET "category_id" = c."id"
        FROM "categories" c
        WHERE bg."category" = c."name"
          AND c."type" = 'Expense'
          AND bg."category_id" IS NULL;

        IF EXISTS (SELECT 1 FROM "budget_goals" WHERE "category_id" IS NULL) THEN
          RAISE WARNING 'budget_goals migration: % rows had no matching Expense category and were removed',
            (SELECT count(*) FROM "budget_goals" WHERE "category_id" IS NULL);
        END IF;
        DELETE FROM "budget_goals" WHERE "category_id" IS NULL;

        ALTER TABLE "budget_goals" ALTER COLUMN "category_id" SET NOT NULL;

        ALTER TABLE "budget_goals" DROP COLUMN "category";

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'budget_goals_category_id_categories_id_fk'
        ) THEN
          ALTER TABLE "budget_goals"
            ADD CONSTRAINT "budget_goals_category_id_categories_id_fk"
            FOREIGN KEY ("category_id") REFERENCES "categories"("id");
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'budget_goals_category_id_unique'
        ) THEN
          ALTER TABLE "budget_goals"
            ADD CONSTRAINT "budget_goals_category_id_unique" UNIQUE ("category_id");
        END IF;
      ELSE
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'budget_goals' AND column_name = 'category_id'
        ) THEN
          CREATE TABLE IF NOT EXISTS "budget_goals" (
            "id" serial PRIMARY KEY NOT NULL,
            "category_id" integer NOT NULL UNIQUE REFERENCES "categories"("id"),
            "planned_amount" numeric(12, 2) DEFAULT '0' NOT NULL
          );
        END IF;
      END IF;
    END $$
  `);

  await db.execute(sql`
    UPDATE "budget_goals" bg
    SET "planned_amount" = a."emi_amount"
    FROM "categories" c, "accounts" a
    WHERE bg."category_id" = c."id"
      AND c."name" = 'EMI (PL)'
      AND a."type" = 'loan'
      AND a."emi_amount" IS NOT NULL
      AND a."emi_amount" > 0
      AND (bg."planned_amount" = 0 OR bg."planned_amount" IS NULL)
  `);
}
