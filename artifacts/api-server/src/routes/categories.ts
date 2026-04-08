import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, categoriesTable, transactionsTable, budgetGoalsTable } from "@workspace/db";
import { CreateCategoryBody, ListCategoriesQueryParams, RenameCategoryBody } from "@workspace/api-zod";
import { ZodError } from "zod";
import { BUDGET_DEFAULTS, DEFAULT_PLANNED } from "../lib/budget-defaults";
import { parseIntParam, isZodError, isParamError } from "../lib/parse-params";

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
    if (isZodError(e)) {
      res.status(400).json({ error: "Invalid request body" });
    } else {
      res.status(500).json({ error: "Internal error" });
    }
  }
});

router.post("/categories", async (req, res) => {
  try {
    const data = CreateCategoryBody.parse(req.body);
    const [created] = await db
      .insert(categoriesTable)
      .values({ name: data.name, type: data.type })
      .returning();

    if (data.type === "Expense") {
      const plannedAmount = BUDGET_DEFAULTS[data.name] ?? DEFAULT_PLANNED;
      const existing = await db
        .select()
        .from(budgetGoalsTable)
        .where(eq(budgetGoalsTable.categoryId, created.id));
      if (existing.length === 0) {
        await db.insert(budgetGoalsTable).values({
          categoryId: created.id,
          plannedAmount: plannedAmount.toFixed(2),
        });
      }
    }

    res.status(201).json(created);
  } catch (e) {
    req.log.error({ err: e }, "Failed to create category");
    if (isZodError(e)) {
      res.status(400).json({ error: "Invalid request body" });
    } else {
      res.status(500).json({ error: "Internal error" });
    }
  }
});

router.patch("/categories/:id", async (req, res) => {
  try {
    const id = parseIntParam(req.params.id, "id");

    const { name } = RenameCategoryBody.parse(req.body);
    const trimmedName = name.trim();

    if (!trimmedName) {
      res.status(400).json({ error: "A non-empty name is required." });
      return;
    }

    const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, id));
    if (!cat) {
      res.status(404).json({ error: "Category not found" });
      return;
    }

    if (trimmedName !== cat.name) {
      const [duplicate] = await db
        .select()
        .from(categoriesTable)
        .where(eq(categoriesTable.name, trimmedName));
      if (duplicate) {
        res.status(409).json({ error: `A category named "${trimmedName}" already exists.` });
        return;
      }
    }

    const oldName = cat.name;

    await db.transaction(async (tx) => {
      await tx
        .update(categoriesTable)
        .set({ name: trimmedName })
        .where(eq(categoriesTable.id, id));

      await tx
        .update(transactionsTable)
        .set({ category: trimmedName })
        .where(eq(transactionsTable.category, oldName));
    });

    const [updated] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, id));
    res.json(updated);
  } catch (e: unknown) {
    req.log.error({ err: e }, "Failed to rename category");
    if (isZodError(e) || isParamError(e)) {
      res.status(400).json({ error: isParamError(e) ? (e as Error).message : "Invalid request body" });
    } else {
      res.status(500).json({ error: "Internal error" });
    }
  }
});

router.delete("/categories/:id", async (req, res) => {
  try {
    const id = parseIntParam(req.params.id, "id");

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

    await db.delete(budgetGoalsTable).where(eq(budgetGoalsTable.categoryId, id));
    await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
    res.status(204).send();
  } catch (e) {
    req.log.error({ err: e }, "Failed to delete category");
    if (isParamError(e)) {
      res.status(400).json({ error: (e as Error).message });
    } else {
      res.status(500).json({ error: "Internal error" });
    }
  }
});

export default router;
