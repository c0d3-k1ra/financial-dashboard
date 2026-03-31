import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, accountsTable, transactionsTable } from "@workspace/db";
import { CreateAccountBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/accounts", async (req, res) => {
  try {
    const accounts = await db.select().from(accountsTable);
    res.json(accounts);
  } catch (e) {
    req.log.error({ err: e }, "Failed to list accounts");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/accounts", async (req, res) => {
  try {
    const data = CreateAccountBody.parse(req.body);
    const [created] = await db
      .insert(accountsTable)
      .values({
        name: data.name,
        type: data.type,
        currentBalance: data.currentBalance || "0",
        creditLimit: data.creditLimit || null,
      })
      .returning();
    res.status(201).json(created);
  } catch (e) {
    req.log.error({ err: e }, "Failed to create account");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.put("/accounts/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const data = CreateAccountBody.parse(req.body);
    const [updated] = await db
      .update(accountsTable)
      .set({
        name: data.name,
        type: data.type,
        currentBalance: data.currentBalance || "0",
        creditLimit: data.creditLimit || null,
      })
      .where(eq(accountsTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(updated);
  } catch (e) {
    req.log.error({ err: e }, "Failed to update account");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/accounts/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const [linked] = await db
      .select({ count: sql<number>`count(*)` })
      .from(transactionsTable)
      .where(sql`${transactionsTable.accountId} = ${id} OR ${transactionsTable.toAccountId} = ${id}`);

    if (Number(linked.count) > 0) {
      res.status(409).json({
        error: `Cannot delete account: ${linked.count} transaction(s) are linked to it. Reassign or delete them first.`,
      });
      return;
    }

    await db.delete(accountsTable).where(eq(accountsTable.id, id));
    res.status(204).send();
  } catch (e) {
    req.log.error({ err: e }, "Failed to delete account");
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
