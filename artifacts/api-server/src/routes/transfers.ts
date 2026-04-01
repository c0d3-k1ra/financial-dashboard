import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, accountsTable, transactionsTable } from "@workspace/db";
import { CreateTransferBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/transfers", async (req, res) => {
  try {
    const data = CreateTransferBody.parse(req.body);
    const amount = Number(data.amount);

    if (amount <= 0) {
      res.status(400).json({ error: "Amount must be positive" });
      return;
    }

    if (data.fromAccountId === data.toAccountId) {
      res.status(400).json({ error: "From and To accounts must be different" });
      return;
    }

    const fromAccount = await db.select().from(accountsTable).where(eq(accountsTable.id, data.fromAccountId));
    const toAccount = await db.select().from(accountsTable).where(eq(accountsTable.id, data.toAccountId));

    if (!fromAccount.length || !toAccount.length) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    const fromIsDebt = fromAccount[0].type === "credit_card" || fromAccount[0].type === "loan";
    const toIsDebt = toAccount[0].type === "credit_card" || toAccount[0].type === "loan";

    const transfer = await db.transaction(async (tx) => {
      if (fromIsDebt) {
        await tx
          .update(accountsTable)
          .set({ currentBalance: sql`${accountsTable.currentBalance}::numeric + ${data.amount}::numeric` })
          .where(eq(accountsTable.id, data.fromAccountId));
      } else {
        await tx
          .update(accountsTable)
          .set({ currentBalance: sql`${accountsTable.currentBalance}::numeric - ${data.amount}::numeric` })
          .where(eq(accountsTable.id, data.fromAccountId));
      }

      if (toIsDebt) {
        await tx
          .update(accountsTable)
          .set({ currentBalance: sql`${accountsTable.currentBalance}::numeric - ${data.amount}::numeric` })
          .where(eq(accountsTable.id, data.toAccountId));
      } else {
        await tx
          .update(accountsTable)
          .set({ currentBalance: sql`${accountsTable.currentBalance}::numeric + ${data.amount}::numeric` })
          .where(eq(accountsTable.id, data.toAccountId));
      }

      const [created] = await tx
        .insert(transactionsTable)
        .values({
          date: data.date,
          amount: data.amount,
          description: data.description || `Transfer: ${fromAccount[0].name} → ${toAccount[0].name}`,
          category: "Transfer",
          type: "Transfer",
          accountId: data.fromAccountId,
          toAccountId: data.toAccountId,
        })
        .returning();

      return created;
    });

    res.status(201).json(transfer);
  } catch (e) {
    req.log.error({ err: e }, "Failed to create transfer");
    res.status(400).json({ error: "Invalid request" });
  }
});

export default router;
