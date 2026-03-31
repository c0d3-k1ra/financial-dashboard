import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, accountsTable, transactionsTable } from "@workspace/db";
import { CreateAccountBody, ReconcileAccountBody } from "@workspace/api-zod";

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
    if (data.billingDueDay != null && (data.billingDueDay < 1 || data.billingDueDay > 31)) {
      res.status(400).json({ error: "billingDueDay must be between 1 and 31" });
      return;
    }
    const [created] = await db
      .insert(accountsTable)
      .values({
        name: data.name,
        type: data.type,
        currentBalance: data.currentBalance || "0",
        creditLimit: data.creditLimit || null,
        billingDueDay: data.billingDueDay ?? null,
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
    if (data.billingDueDay != null && (data.billingDueDay < 1 || data.billingDueDay > 31)) {
      res.status(400).json({ error: "billingDueDay must be between 1 and 31" });
      return;
    }
    const [updated] = await db
      .update(accountsTable)
      .set({
        name: data.name,
        type: data.type,
        currentBalance: data.currentBalance || "0",
        creditLimit: data.creditLimit || null,
        billingDueDay: data.billingDueDay ?? null,
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

router.post("/accounts/:id/reconcile", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const data = ReconcileAccountBody.parse(req.body);
    const actualBalance = Number(data.actualBalance);

    const account = await db.select().from(accountsTable).where(eq(accountsTable.id, id));
    if (!account.length) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    const previousBalance = Number(account[0].currentBalance ?? 0);
    const adjustment = actualBalance - previousBalance;

    await db.transaction(async (tx) => {
      await tx
        .update(accountsTable)
        .set({ currentBalance: actualBalance.toFixed(2) })
        .where(eq(accountsTable.id, id));

      if (Math.abs(adjustment) > 0.001) {
        const today = new Date().toISOString().split("T")[0];
        await tx.insert(transactionsTable).values({
          date: today,
          amount: Math.abs(adjustment).toFixed(2),
          description: `Balance Adjustment (${adjustment >= 0 ? "+" : "-"}${Math.abs(adjustment).toFixed(2)})`,
          category: "Adjustment",
          type: adjustment >= 0 ? "Income" : "Expense",
          accountId: id,
        });
      }
    });

    res.json({
      success: true,
      previousBalance: previousBalance.toFixed(2),
      newBalance: actualBalance.toFixed(2),
      adjustment: adjustment.toFixed(2),
    });
  } catch (e) {
    req.log.error({ err: e }, "Failed to reconcile account");
    res.status(400).json({ error: "Invalid request" });
  }
});

export default router;
