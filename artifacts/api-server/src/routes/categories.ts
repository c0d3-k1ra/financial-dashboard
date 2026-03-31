import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, categoriesTable } from "@workspace/db";
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
    await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
    res.status(204).send();
  } catch (e) {
    req.log.error({ err: e }, "Failed to delete category");
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
