import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, goalVaultsTable } from "@workspace/db";
import { ConsolidateSurplusBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/surplus/consolidate", async (req, res) => {
  try {
    const data = ConsolidateSurplusBody.parse(req.body);
    const amount = Number(data.amount);

    if (amount <= 0) {
      res.json({ success: false, newBalance: "0.00", amountAdded: "0.00" });
      return;
    }

    const existing = await db
      .select()
      .from(goalVaultsTable)
      .where(eq(goalVaultsTable.name, "Emergency Fund (IDFC)"));

    let result;
    if (existing.length > 0) {
      [result] = await db
        .update(goalVaultsTable)
        .set({
          currentBalance: sql`(${goalVaultsTable.currentBalance}::numeric + ${amount})::text`,
        })
        .where(eq(goalVaultsTable.name, "Emergency Fund (IDFC)"))
        .returning();
    } else {
      [result] = await db
        .insert(goalVaultsTable)
        .values({
          name: "Emergency Fund (IDFC)",
          currentBalance: amount.toFixed(2),
          targetAmount: "300000.00",
        })
        .returning();
    }

    res.json({
      success: true,
      newBalance: Number(result.currentBalance).toFixed(2),
      amountAdded: amount.toFixed(2),
    });
  } catch (e) {
    req.log.error({ err: e }, "Failed to consolidate surplus");
    res.status(400).json({ error: "Invalid request" });
  }
});

export default router;
