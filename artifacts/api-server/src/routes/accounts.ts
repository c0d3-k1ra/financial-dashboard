import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, accountsTable, transactionsTable, goalsTable, surplusAllocationsTable } from "@workspace/db";
import { CreateAccountBody, ReconcileAccountBody, ProcessEmisBody } from "@workspace/api-zod";
import { getAppSettings, getCurrencySymbol } from "../lib/settings-helper";

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
    if (data.creditLimit != null && Number(data.creditLimit) < 0) {
      res.status(400).json({ error: "creditLimit must be non-negative." });
      return;
    }
    if (data.emiDay != null && (data.emiDay < 1 || data.emiDay > 31)) {
      res.status(400).json({ error: "emiDay must be between 1 and 31" });
      return;
    }
    if (data.type === "loan") {
      if (!data.originalLoanAmount || Number(data.originalLoanAmount) <= 0) {
        res.status(400).json({ error: "Original loan amount is required and must be greater than zero." });
        return;
      }
      if (data.emiAmount != null && Number(data.emiAmount) <= 0) {
        res.status(400).json({ error: "EMI amount must be greater than zero." });
        return;
      }
      if (data.interestRate != null && Number(data.interestRate) < 0) {
        res.status(400).json({ error: "Interest rate must be non-negative." });
        return;
      }
      if (data.loanTenure != null && data.loanTenure < 1) {
        res.status(400).json({ error: "Loan tenure must be at least 1 month." });
        return;
      }
      if (data.emisPaid != null && data.emisPaid < 0) {
        res.status(400).json({ error: "EMIs paid must be non-negative." });
        return;
      }
    }
    const sharedLimitGroup = data.type === "credit_card" ? (data.sharedLimitGroup || null) : null;

    let creditLimit = data.creditLimit || null;
    if (sharedLimitGroup && !creditLimit) {
      const [existing] = await db
        .select({ creditLimit: accountsTable.creditLimit })
        .from(accountsTable)
        .where(sql`${accountsTable.sharedLimitGroup} = ${sharedLimitGroup} AND ${accountsTable.creditLimit} IS NOT NULL`)
        .limit(1);
      if (existing?.creditLimit) {
        creditLimit = existing.creditLimit;
      }
    }

    const [created] = await db
      .insert(accountsTable)
      .values({
        name: data.name,
        type: data.type,
        currentBalance: data.currentBalance || "0",
        creditLimit,
        billingDueDay: data.billingDueDay ?? null,
        emiAmount: data.type === "loan" ? (data.emiAmount || null) : null,
        emiDay: data.type === "loan" ? (data.emiDay ?? null) : null,
        loanTenure: data.type === "loan" ? (data.loanTenure ?? null) : null,
        interestRate: data.type === "loan" ? (data.interestRate || null) : null,
        linkedAccountId: data.type === "loan" ? (data.linkedAccountId ?? null) : null,
        useInSurplus: data.useInSurplus ?? false,
        sharedLimitGroup,
        originalLoanAmount: data.type === "loan" ? (data.originalLoanAmount || null) : null,
        loanStartDate: data.type === "loan" ? (data.loanStartDate || null) : null,
        emisPaid: data.type === "loan" ? (data.emisPaid ?? 0) : null,
      })
      .returning();

    if (sharedLimitGroup && data.creditLimit != null) {
      await db
        .update(accountsTable)
        .set({ creditLimit: data.creditLimit || "0" })
        .where(sql`${accountsTable.sharedLimitGroup} = ${sharedLimitGroup} AND ${accountsTable.id} != ${created.id}`);
    }

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
    if (data.creditLimit != null && Number(data.creditLimit) < 0) {
      res.status(400).json({ error: "creditLimit must be non-negative." });
      return;
    }
    if (data.emiDay != null && (data.emiDay < 1 || data.emiDay > 31)) {
      res.status(400).json({ error: "emiDay must be between 1 and 31" });
      return;
    }
    if (data.type === "loan") {
      if (!data.originalLoanAmount || Number(data.originalLoanAmount) <= 0) {
        res.status(400).json({ error: "Original loan amount is required and must be greater than zero." });
        return;
      }
      if (data.emiAmount != null && Number(data.emiAmount) <= 0) {
        res.status(400).json({ error: "EMI amount must be greater than zero." });
        return;
      }
      if (data.interestRate != null && Number(data.interestRate) < 0) {
        res.status(400).json({ error: "Interest rate must be non-negative." });
        return;
      }
      if (data.loanTenure != null && data.loanTenure < 1) {
        res.status(400).json({ error: "Loan tenure must be at least 1 month." });
        return;
      }
      if (data.emisPaid != null && data.emisPaid < 0) {
        res.status(400).json({ error: "EMIs paid must be non-negative." });
        return;
      }
    }
    const sharedLimitGroup = data.type === "credit_card" ? (data.sharedLimitGroup || null) : null;

    let creditLimit = data.creditLimit || null;
    if (sharedLimitGroup && !creditLimit) {
      const [existing] = await db
        .select({ creditLimit: accountsTable.creditLimit })
        .from(accountsTable)
        .where(sql`${accountsTable.sharedLimitGroup} = ${sharedLimitGroup} AND ${accountsTable.creditLimit} IS NOT NULL AND ${accountsTable.id} != ${id}`)
        .limit(1);
      if (existing?.creditLimit) {
        creditLimit = existing.creditLimit;
      }
    }

    const [updated] = await db
      .update(accountsTable)
      .set({
        name: data.name,
        type: data.type,
        currentBalance: data.currentBalance || "0",
        creditLimit,
        billingDueDay: data.billingDueDay ?? null,
        emiAmount: data.type === "loan" ? (data.emiAmount || null) : null,
        emiDay: data.type === "loan" ? (data.emiDay ?? null) : null,
        loanTenure: data.type === "loan" ? (data.loanTenure ?? null) : null,
        interestRate: data.type === "loan" ? (data.interestRate || null) : null,
        linkedAccountId: data.type === "loan" ? (data.linkedAccountId ?? null) : null,
        useInSurplus: data.useInSurplus ?? false,
        sharedLimitGroup,
        originalLoanAmount: data.type === "loan" ? (data.originalLoanAmount || null) : null,
        loanStartDate: data.type === "loan" ? (data.loanStartDate || null) : null,
        emisPaid: data.type === "loan" ? (data.emisPaid ?? 0) : null,
      })
      .where(eq(accountsTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    if (sharedLimitGroup && data.creditLimit != null) {
      await db
        .update(accountsTable)
        .set({ creditLimit: data.creditLimit || "0" })
        .where(sql`${accountsTable.sharedLimitGroup} = ${sharedLimitGroup} AND ${accountsTable.id} != ${id}`);
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

    const [linkedGoals] = await db
      .select({ count: sql<number>`count(*)` })
      .from(goalsTable)
      .where(eq(goalsTable.accountId, id));

    if (Number(linkedGoals.count) > 0) {
      res.status(409).json({
        error: `Cannot delete account: ${linkedGoals.count} goal(s) are linked to it. Reassign or delete them first.`,
      });
      return;
    }

    const [linkedAllocations] = await db
      .select({ count: sql<number>`count(*)` })
      .from(surplusAllocationsTable)
      .where(eq(surplusAllocationsTable.sourceAccountId, id));

    if (Number(linkedAllocations.count) > 0) {
      res.status(409).json({
        error: `Cannot delete account: ${linkedAllocations.count} surplus allocation(s) reference it.`,
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

router.post("/accounts/process-emis", async (req, res) => {
  try {
    const { month } = ProcessEmisBody.parse(req.body);
    if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      res.status(400).json({ error: "Invalid month format. Expected YYYY-MM with valid month (01-12)." });
      return;
    }

    const loanAccounts = await db
      .select()
      .from(accountsTable)
      .where(eq(accountsTable.type, "loan"));

    const activeLoanAccounts = loanAccounts.filter(
      (a) => Number(a.currentBalance ?? 0) > 0 && a.emiAmount && Number(a.emiAmount) > 0 && a.emiDay != null
    );

    if (activeLoanAccounts.length === 0) {
      res.json({ processed: 0, message: "No active loans with EMI to process." });
      return;
    }

    const allAccounts = await db.select().from(accountsTable);
    const accountMap = new Map(allAccounts.map((a) => [a.id, a]));
    const { currencyCode } = await getAppSettings();
    const cs = getCurrencySymbol(currencyCode);

    let processed = 0;
    const results: Array<{ accountName: string; emiAmount: string; newBalance: string; fromAccount?: string }> = [];

    await db.transaction(async (tx) => {
      for (const loan of activeLoanAccounts) {
        const emiAmount = Number(loan.emiAmount);
        const currentBalance = Number(loan.currentBalance ?? 0);
        const annualRate = Number(loan.interestRate ?? 0);
        const monthlyRate = annualRate / 100 / 12;

        const interestPortion = Math.min(currentBalance * monthlyRate, emiAmount);
        const principalPortion = Math.max(0, emiAmount - interestPortion);
        const principalReduction = Math.min(principalPortion, currentBalance);
        const newBalance = currentBalance - principalReduction;
        const actualDebit = Math.min(interestPortion + principalReduction, emiAmount);

        const [yearStr, monthStr] = month.split("-");
        const year = Number(yearStr);
        const mon = Number(monthStr);
        const daysInMonth = new Date(year, mon, 0).getDate();
        const emiDay = Math.min(loan.emiDay || 1, daysInMonth);
        const emiDate = `${month}-${String(emiDay).padStart(2, "0")}`;

        const existing = await tx
          .select({ count: sql<number>`count(*)` })
          .from(transactionsTable)
          .where(sql`${transactionsTable.category} = 'EMI' AND ${transactionsTable.accountId} = ${loan.linkedAccountId ?? loan.id} AND ${transactionsTable.date}::text LIKE ${month + '%'} AND ${transactionsTable.description} LIKE ${'EMI Payment — ' + loan.name + '%'}`);

        if (Number(existing[0].count) > 0) continue;

        const newEmisPaid = (Number(loan.emisPaid) || 0) + 1;

        await tx
          .update(accountsTable)
          .set({
            currentBalance: newBalance.toFixed(2),
            emisPaid: newEmisPaid,
          })
          .where(eq(accountsTable.id, loan.id));

        const linkedAccount = loan.linkedAccountId ? accountMap.get(loan.linkedAccountId) : null;
        const isFinal = newBalance < 0.01;
        const txDescription = `EMI Payment — ${loan.name}${isFinal ? " (final)" : ""} [Principal: ${cs}${principalReduction.toFixed(0)}, Interest: ${cs}${interestPortion.toFixed(0)}]`;

        if (linkedAccount) {
          await tx
            .update(accountsTable)
            .set({ currentBalance: sql`${accountsTable.currentBalance}::numeric - ${actualDebit.toFixed(2)}::numeric` })
            .where(eq(accountsTable.id, linkedAccount.id));

          await tx.insert(transactionsTable).values({
            date: emiDate,
            amount: actualDebit.toFixed(2),
            description: txDescription,
            category: "EMI",
            type: "Transfer",
            accountId: linkedAccount.id,
            toAccountId: loan.id,
          });
        } else {
          await tx.insert(transactionsTable).values({
            date: emiDate,
            amount: actualDebit.toFixed(2),
            description: txDescription,
            category: "EMI",
            type: "Expense",
            accountId: loan.id,
          });
        }

        processed++;
        results.push({
          accountName: loan.name,
          emiAmount: actualDebit.toFixed(2),
          newBalance: newBalance.toFixed(2),
          fromAccount: linkedAccount?.name,
        });
      }
    });

    res.json({ processed, results });
  } catch (e: unknown) {
    req.log.error({ err: e }, "Failed to process EMIs");
    if (e && typeof e === "object" && "name" in e && (e as { name: string }).name === "ZodError") {
      res.status(400).json({ error: "Invalid request body" });
    } else {
      res.status(500).json({ error: "Internal error" });
    }
  }
});

export default router;
