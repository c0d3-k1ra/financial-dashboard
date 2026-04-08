import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, budgetGoalsTable, categoriesTable } from "@workspace/db";
import { UpsertBudgetGoalBody } from "@workspace/api-zod";
import { parseIntParam } from "../lib/parse-params";
import { asyncHandler } from "../lib/async-handler";

const router: IRouter = Router();

router.get("/budget-goals", asyncHandler(async (req, res) => {
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
}));

router.post("/budget-goals", asyncHandler(async (req, res) => {
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
}));

router.delete("/budget-goals/:id", asyncHandler(async (req, res) => {
  const id = parseIntParam(req.params.id, "id");
  await db.delete(budgetGoalsTable).where(eq(budgetGoalsTable.id, id));
  res.status(204).send();
}));

export default router;
