import { Router, type IRouter } from "express";
import { eq, desc, ilike, and, sql } from "drizzle-orm";
import { db, transactionsTable, accountsTable } from "@workspace/db";
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

    if (params.cycleStart && params.cycleEnd) {
      conditions.push(sql`${transactionsTable.date}::date >= ${params.cycleStart}::date`);
      conditions.push(sql`${transactionsTable.date}::date <= ${params.cycleEnd}::date`);
    } else if (params.month) {
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
      .where(sql`${transactionsTable.type} != 'Transfer'`)
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

    if (data.type === "Transfer") {
      res.status(400).json({ error: "Use the /transfers endpoint to create transfers." });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(transactionsTable)
        .values({
          date: data.date,
          amount: data.amount,
          description: data.description,
          category: data.category,
          type: data.type,
          accountId: data.accountId,
        })
        .returning();

      if (data.type === "Income") {
        await tx
          .update(accountsTable)
          .set({ currentBalance: sql`${accountsTable.currentBalance}::numeric + ${data.amount}::numeric` })
          .where(eq(accountsTable.id, data.accountId));
      } else if (data.type === "Expense") {
        await tx
          .update(accountsTable)
          .set({ currentBalance: sql`${accountsTable.currentBalance}::numeric - ${data.amount}::numeric` })
          .where(eq(accountsTable.id, data.accountId));
      }

      return created;
    });

    res.status(201).json(result);
  } catch (e) {
    req.log.error({ err: e }, "Failed to create transaction");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.put("/transactions/:id", async (req, res) => {
  try {
    const { id } = UpdateTransactionParams.parse({ id: req.params.id });
    const data = CreateTransactionBody.parse(req.body);

    if (data.type === "Transfer") {
      res.status(400).json({ error: "Use the /transfers endpoint to create transfers." });
      return;
    }

    const [existing] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    if (existing.type === "Transfer") {
      res.status(400).json({ error: "Transfer transactions cannot be edited. Delete and recreate instead." });
      return;
    }

    const updated = await db.transaction(async (tx) => {
      if (existing.accountId) {
        if (existing.type === "Income") {
          await tx
            .update(accountsTable)
            .set({ currentBalance: sql`${accountsTable.currentBalance}::numeric - ${existing.amount}::numeric` })
            .where(eq(accountsTable.id, existing.accountId));
        } else if (existing.type === "Expense") {
          await tx
            .update(accountsTable)
            .set({ currentBalance: sql`${accountsTable.currentBalance}::numeric + ${existing.amount}::numeric` })
            .where(eq(accountsTable.id, existing.accountId));
        }
      }

      const [result] = await tx
        .update(transactionsTable)
        .set({
          date: data.date,
          amount: data.amount,
          description: data.description,
          category: data.category,
          type: data.type,
          accountId: data.accountId,
        })
        .where(eq(transactionsTable.id, id))
        .returning();

      if (data.type === "Income") {
        await tx
          .update(accountsTable)
          .set({ currentBalance: sql`${accountsTable.currentBalance}::numeric + ${data.amount}::numeric` })
          .where(eq(accountsTable.id, data.accountId));
      } else if (data.type === "Expense") {
        await tx
          .update(accountsTable)
          .set({ currentBalance: sql`${accountsTable.currentBalance}::numeric - ${data.amount}::numeric` })
          .where(eq(accountsTable.id, data.accountId));
      }

      return result;
    });

    res.json(updated);
  } catch (e) {
    req.log.error({ err: e }, "Failed to update transaction");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/transactions/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const [existing] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id));

    if (existing) {
      await db.transaction(async (tx) => {
        if (existing.type === "Transfer") {
          if (existing.accountId) {
            await tx
              .update(accountsTable)
              .set({ currentBalance: sql`${accountsTable.currentBalance}::numeric + ${existing.amount}::numeric` })
              .where(eq(accountsTable.id, existing.accountId));
          }
          if (existing.toAccountId) {
            await tx
              .update(accountsTable)
              .set({ currentBalance: sql`${accountsTable.currentBalance}::numeric - ${existing.amount}::numeric` })
              .where(eq(accountsTable.id, existing.toAccountId));
          }
        } else if (existing.accountId) {
          if (existing.type === "Income") {
            await tx
              .update(accountsTable)
              .set({ currentBalance: sql`${accountsTable.currentBalance}::numeric - ${existing.amount}::numeric` })
              .where(eq(accountsTable.id, existing.accountId));
          } else if (existing.type === "Expense") {
            await tx
              .update(accountsTable)
              .set({ currentBalance: sql`${accountsTable.currentBalance}::numeric + ${existing.amount}::numeric` })
              .where(eq(accountsTable.id, existing.accountId));
          }
        }

        await tx.delete(transactionsTable).where(eq(transactionsTable.id, id));
      });
    }

    res.status(204).send();
  } catch (e) {
    req.log.error({ err: e }, "Failed to delete transaction");
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
