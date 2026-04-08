import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, budgetGoalsTable, categoriesTable } from "@workspace/db";
import { UpsertBudgetGoalBody } from "@workspace/api-zod";
import { parseIntParam, isZodError, isParamError } from "../lib/parse-params";

const router: IRouter = Router();

router.get("/budget-goals", async (req, res) => {
  try {
    const results = await db
      .select({
        id: budgetGoalsTable.id,
        categoryId: budgetGoalsTable.categoryId,
        plannedAmount: budgetGoalsTable.plannedAmount,
        category: categoriesTable.name,
      })
      .from(budgetGoalsTable)
      .innerJoin(categoriesTable, eq(budgetGoalsTable.categoryId, categoriesTable.id));
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
      .where(eq(budgetGoalsTable.categoryId, data.categoryId));

    let result;
    if (existing.length > 0) {
      [result] = await db
        .update(budgetGoalsTable)
        .set({ plannedAmount: data.plannedAmount })
        .where(eq(budgetGoalsTable.categoryId, data.categoryId))
        .returning();
    } else {
      [result] = await db.insert(budgetGoalsTable).values({
        categoryId: data.categoryId,
        plannedAmount: data.plannedAmount,
      }).returning();
    }

    const [withCategory] = await db
      .select({
        id: budgetGoalsTable.id,
        categoryId: budgetGoalsTable.categoryId,
        plannedAmount: budgetGoalsTable.plannedAmount,
        category: categoriesTable.name,
      })
      .from(budgetGoalsTable)
      .innerJoin(categoriesTable, eq(budgetGoalsTable.categoryId, categoriesTable.id))
      .where(eq(budgetGoalsTable.id, result.id));

    res.json(withCategory);
  } catch (e) {
    req.log.error({ err: e }, "Failed to upsert budget goal");
    if (isZodError(e)) {
      res.status(400).json({ error: "Invalid request body" });
    } else {
      res.status(500).json({ error: "Internal error" });
    }
  }
});

router.delete("/budget-goals/:id", async (req, res) => {
  try {
    const id = parseIntParam(req.params.id, "id");
    await db.delete(budgetGoalsTable).where(eq(budgetGoalsTable.id, id));
    res.status(204).send();
  } catch (e) {
    req.log.error({ err: e }, "Failed to delete budget goal");
    if (isParamError(e)) {
      res.status(400).json({ error: (e as Error).message });
    } else {
      res.status(500).json({ error: "Internal error" });
    }
  }
});

export default router;
