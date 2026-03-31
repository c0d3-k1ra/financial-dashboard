import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, monthlyConfigTable } from "@workspace/db";
import { UpsertMonthlyConfigBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/monthly-config", async (req, res) => {
  try {
    const results = await db.select().from(monthlyConfigTable);
    res.json(results);
  } catch (e) {
    req.log.error({ err: e }, "Failed to list monthly configs");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/monthly-config", async (req, res) => {
  try {
    const data = UpsertMonthlyConfigBody.parse(req.body);
    const existing = await db
      .select()
      .from(monthlyConfigTable)
      .where(eq(monthlyConfigTable.month, data.month));

    let result;
    if (existing.length > 0) {
      [result] = await db
        .update(monthlyConfigTable)
        .set({ startingBalance: data.startingBalance })
        .where(eq(monthlyConfigTable.month, data.month))
        .returning();
    } else {
      [result] = await db.insert(monthlyConfigTable).values(data).returning();
    }
    res.json(result);
  } catch (e) {
    req.log.error({ err: e }, "Failed to upsert monthly config");
    res.status(400).json({ error: "Invalid request" });
  }
});

export default router;
