import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, monthlyConfigTable } from "@workspace/db";
import { UpsertMonthlyConfigBody } from "@workspace/api-zod";
import { parseIntParam } from "../lib/parse-params";
import { asyncHandler } from "../lib/async-handler";

const router: IRouter = Router();

router.get("/monthly-config", asyncHandler(async (req, res) => {
  const results = await db.select().from(monthlyConfigTable);
  res.json(results);
}));

router.post("/monthly-config", asyncHandler(async (req, res) => {
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
}));

router.delete("/monthly-config/:id", asyncHandler(async (req, res) => {
  const id = parseIntParam(req.params.id, "id");
  await db.delete(monthlyConfigTable).where(eq(monthlyConfigTable.id, id));
  res.status(204).send();
}));

export default router;
