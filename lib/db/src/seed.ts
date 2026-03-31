import { db } from "./index";
import { accountsTable, categoriesTable, transactionsTable } from "./schema";
import { sql } from "drizzle-orm";

const EXPENSE_CATEGORIES = [
  "EMI (PL)",
  "Father",
  "Credit Card (CC)",
  "Living Expenses",
  "SIP (Investment)",
  "Travel Fund",
  "Term Insurance",
  "Health Insurance",
  "Food",
  "Gifts",
  "Home",
  "Transportation",
  "Personal",
  "Utilities",
  "Medical",
  "Other (Tax)",
];

const INCOME_CATEGORIES = ["Paycheck (Salary)", "Bonus", "Interest", "Other"];

async function seed() {
  console.log("Seeding database...");

  const existingAccounts = await db.select().from(accountsTable);
  let primaryBankId: number;

  if (existingAccounts.length === 0) {
    const [primaryBank] = await db
      .insert(accountsTable)
      .values({ name: "Primary Bank", type: "bank", currentBalance: "0" })
      .returning();
    primaryBankId = primaryBank.id;
    console.log("Created default Primary Bank account");
  } else {
    primaryBankId = existingAccounts[0].id;
    console.log("Accounts already exist, skipping");
  }

  const existingCategories = await db.select().from(categoriesTable);
  if (existingCategories.length === 0) {
    const categoryValues = [
      ...EXPENSE_CATEGORIES.map((name) => ({ name, type: "Expense" })),
      ...INCOME_CATEGORIES.map((name) => ({ name, type: "Income" })),
    ];
    await db.insert(categoriesTable).values(categoryValues);
    console.log(`Seeded ${categoryValues.length} categories`);
  } else {
    console.log("Categories already exist, skipping");
  }

  const unmapped = await db
    .select({ count: sql<number>`count(*)` })
    .from(transactionsTable)
    .where(sql`${transactionsTable.accountId} IS NULL`);

  const unmappedCount = Number(unmapped[0].count);
  if (unmappedCount > 0) {
    await db
      .update(transactionsTable)
      .set({ accountId: primaryBankId })
      .where(sql`${transactionsTable.accountId} IS NULL`);
    console.log(`Mapped ${unmappedCount} existing transactions to Primary Bank`);
  }

  console.log("Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
