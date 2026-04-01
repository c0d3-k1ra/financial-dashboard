import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, appSettingsTable, transactionsTable, monthlyConfigTable, budgetGoalsTable, goalsTable, surplusAllocationsTable, accountsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/settings", async (req, res) => {
  try {
    const rows = await db.select().from(appSettingsTable).where(eq(appSettingsTable.id, 1));
    if (rows.length === 0) {
      res.json({ billingCycleDay: 25, currencyCode: "INR" });
      return;
    }
    res.json({
      billingCycleDay: rows[0].billingCycleDay,
      currencyCode: rows[0].currencyCode,
    });
  } catch (e) {
    req.log.error({ err: e }, "Failed to get settings");
    res.status(500).json({ error: "Internal error" });
  }
});

router.put("/settings", async (req, res) => {
  try {
    const { billingCycleDay, currencyCode } = req.body;
    const updates: Record<string, unknown> = {};

    if (billingCycleDay !== undefined) {
      const day = Number(billingCycleDay);
      if (!Number.isInteger(day) || day < 1 || day > 28) {
        res.status(400).json({ error: "billingCycleDay must be between 1 and 28" });
        return;
      }
      updates.billingCycleDay = day;
    }

    if (currencyCode !== undefined) {
      const validCurrencies = ["INR", "USD", "EUR", "GBP"];
      if (!validCurrencies.includes(currencyCode)) {
        res.status(400).json({ error: `currencyCode must be one of: ${validCurrencies.join(", ")}` });
        return;
      }
      updates.currencyCode = currencyCode;
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No valid fields to update" });
      return;
    }

    const existing = await db.select().from(appSettingsTable).where(eq(appSettingsTable.id, 1));
    if (existing.length === 0) {
      await db.insert(appSettingsTable).values({ id: 1, billingCycleDay: 25, currencyCode: "INR", ...updates });
    } else {
      await db.update(appSettingsTable).set(updates).where(eq(appSettingsTable.id, 1));
    }

    const rows = await db.select().from(appSettingsTable).where(eq(appSettingsTable.id, 1));
    res.json({
      billingCycleDay: rows[0].billingCycleDay,
      currencyCode: rows[0].currencyCode,
    });
  } catch (e) {
    req.log.error({ err: e }, "Failed to update settings");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/settings/reset-data", async (req, res) => {
  try {
    await db.transaction(async (tx) => {
      await tx.delete(surplusAllocationsTable);
      await tx.delete(goalsTable);
      await tx.delete(transactionsTable);
      await tx.delete(budgetGoalsTable);
      await tx.delete(monthlyConfigTable);
      await tx.execute(sql`UPDATE ${accountsTable} SET "current_balance" = '0'`);
    });

    res.json({ success: true, message: "All data has been reset. Categories and settings have been preserved." });
  } catch (e) {
    req.log.error({ err: e }, "Failed to reset data");
    res.status(500).json({ error: "Failed to reset data" });
  }
});

export default router;
