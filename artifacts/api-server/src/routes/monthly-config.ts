import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, monthlyConfigTable } from "@workspace/db";
import { UpsertMonthlyConfigBody } from "@workspace/api-zod";
import { parseIntParam, isZodError, isParamError } from "../lib/parse-params";

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
    if (isZodError(e)) {
      res.status(400).json({ error: "Invalid request body" });
    } else {
      res.status(500).json({ error: "Internal error" });
    }
  }
});

router.delete("/monthly-config/:id", async (req, res) => {
  try {
    const id = parseIntParam(req.params.id, "id");
    await db.delete(monthlyConfigTable).where(eq(monthlyConfigTable.id, id));
    res.status(204).send();
  } catch (e) {
    req.log.error({ err: e }, "Failed to delete monthly config");
    if (isParamError(e)) {
      res.status(400).json({ error: (e as Error).message });
    } else {
      res.status(500).json({ error: "Internal error" });
    }
  }
});

export default router;
