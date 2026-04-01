import { eq } from "drizzle-orm";
import { db, appSettingsTable } from "@workspace/db";

export async function getAppSettings(): Promise<{ billingCycleDay: number; currencyCode: string }> {
  const rows = await db.select().from(appSettingsTable).where(eq(appSettingsTable.id, 1));
  if (rows.length === 0) {
    return { billingCycleDay: 25, currencyCode: "INR" };
  }
  return {
    billingCycleDay: rows[0].billingCycleDay,
    currencyCode: rows[0].currencyCode,
  };
}
