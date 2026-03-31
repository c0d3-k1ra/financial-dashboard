import { Router, type IRouter } from "express";
import { eq, desc, ilike, and, sql } from "drizzle-orm";
import { db, transactionsTable } from "@workspace/db";
import {
  ListTransactionsQueryParams,
  CreateTransactionBody,
  UpdateTransactionParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/transactions", async (req, res) => {
  try {
    const params = ListTransactionsQueryParams.parse(req.query);
    const conditions = [];

    if (params.month) {
      conditions.push(sql`to_char(${transactionsTable.date}::date, 'YYYY-MM') = ${params.month}`);
    }
    if (params.type) {
      conditions.push(eq(transactionsTable.type, params.type));
    }
    if (params.category) {
      conditions.push(eq(transactionsTable.category, params.category));
    }
    if (params.search) {
      conditions.push(ilike(transactionsTable.description, `%${params.search}%`));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const results = await db
      .select()
      .from(transactionsTable)
      .where(where)
      .orderBy(desc(transactionsTable.date), desc(transactionsTable.id));

    res.json(results);
  } catch (e) {
    req.log.error({ err: e }, "Failed to list transactions");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.get("/transactions/recent", async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const results = await db
      .select()
      .from(transactionsTable)
      .orderBy(desc(transactionsTable.date), desc(transactionsTable.id))
      .limit(limit);
    res.json(results);
  } catch (e) {
    req.log.error({ err: e }, "Failed to get recent transactions");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/transactions", async (req, res) => {
  try {
    const data = CreateTransactionBody.parse(req.body);
    const [created] = await db.insert(transactionsTable).values(data).returning();
    res.status(201).json(created);
  } catch (e) {
    req.log.error({ err: e }, "Failed to create transaction");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.put("/transactions/:id", async (req, res) => {
  try {
    const { id } = UpdateTransactionParams.parse({ id: req.params.id });
    const data = CreateTransactionBody.parse(req.body);
    const [updated] = await db
      .update(transactionsTable)
      .set(data)
      .where(eq(transactionsTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(updated);
  } catch (e) {
    req.log.error({ err: e }, "Failed to update transaction");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/transactions/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(transactionsTable).where(eq(transactionsTable.id, id));
    res.status(204).send();
  } catch (e) {
    req.log.error({ err: e }, "Failed to delete transaction");
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
