import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";

export const appSettingsTable = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  billingCycleDay: integer("billing_cycle_day").notNull().default(25),
  currencyCode: text("currency_code").notNull().default("INR"),
});
