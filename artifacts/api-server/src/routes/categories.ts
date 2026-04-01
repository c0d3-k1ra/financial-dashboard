import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, categoriesTable, transactionsTable, budgetGoalsTable } from "@workspace/db";
import { CreateCategoryBody, ListCategoriesQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/categories", async (req, res) => {
  try {
    const params = ListCategoriesQueryParams.parse(req.query);
    const results = params.type
      ? await db.select().from(categoriesTable).where(eq(categoriesTable.type, params.type))
      : await db.select().from(categoriesTable);
    res.json(results);
  } catch (e) {
    req.log.error({ err: e }, "Failed to list categories");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/categories", async (req, res) => {
  try {
    const data = CreateCategoryBody.parse(req.body);
    const [created] = await db
      .insert(categoriesTable)
      .values({ name: data.name, type: data.type })
      .returning();
    res.status(201).json(created);
  } catch (e) {
    req.log.error({ err: e }, "Failed to create category");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/categories/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, id));
    if (!cat) {
      res.status(404).json({ error: "Category not found" });
      return;
    }

    const [linkedTxns] = await db
      .select({ count: sql<number>`count(*)` })
      .from(transactionsTable)
      .where(eq(transactionsTable.category, cat.name));

    if (Number(linkedTxns.count) > 0) {
      res.status(409).json({
        error: `Cannot delete category: ${linkedTxns.count} transaction(s) use "${cat.name}". Reassign them first.`,
      });
      return;
    }

    const [linkedBudget] = await db
      .select({ count: sql<number>`count(*)` })
      .from(budgetGoalsTable)
      .where(sql`${budgetGoalsTable.category} = ${cat.name} AND ${budgetGoalsTable.plannedAmount}::numeric > 0`);

    if (Number(linkedBudget.count) > 0) {
      res.status(409).json({
        error: `Cannot delete category: a budget goal is set for "${cat.name}". Remove it first.`,
      });
      return;
    }

    await db.delete(budgetGoalsTable).where(eq(budgetGoalsTable.category, cat.name));
    await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
    res.status(204).send();
  } catch (e) {
    req.log.error({ err: e }, "Failed to delete category");
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
