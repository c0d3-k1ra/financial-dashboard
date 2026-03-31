import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, budgetGoalsTable } from "@workspace/db";
import { UpsertBudgetGoalBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/budget-goals", async (req, res) => {
  try {
    const results = await db.select().from(budgetGoalsTable);
    res.json(results);
  } catch (e) {
    req.log.error({ err: e }, "Failed to list budget goals");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/budget-goals", async (req, res) => {
  try {
    const data = UpsertBudgetGoalBody.parse(req.body);
    const existing = await db
      .select()
      .from(budgetGoalsTable)
      .where(eq(budgetGoalsTable.category, data.category));

    let result;
    if (existing.length > 0) {
      [result] = await db
        .update(budgetGoalsTable)
        .set({ plannedAmount: data.plannedAmount })
        .where(eq(budgetGoalsTable.category, data.category))
        .returning();
    } else {
      [result] = await db.insert(budgetGoalsTable).values(data).returning();
    }
    res.json(result);
  } catch (e) {
    req.log.error({ err: e }, "Failed to upsert budget goal");
    res.status(400).json({ error: "Invalid request" });
  }
});

export default router;
