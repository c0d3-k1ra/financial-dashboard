import { db, pool } from "./index";
import {
  accountsTable,
  categoriesTable,
  transactionsTable,
  budgetGoalsTable,
  goalsTable,
  surplusAllocationsTable,
  monthlyConfigTable,
} from "./schema";
import { sql } from "drizzle-orm";

async function testSeed() {
  console.log("Truncating all tables...");
  await db.execute(sql`
    TRUNCATE TABLE surplus_allocations, transactions, budget_goals, goals, monthly_config, categories, accounts RESTART IDENTITY CASCADE
  `);

  console.log("Creating accounts...");
  const [hdfc] = await db.insert(accountsTable).values({
    name: "HDFC Savings", type: "bank", currentBalance: "245000.00",
  }).returning();

  const [sbi] = await db.insert(accountsTable).values({
    name: "SBI Salary", type: "bank", currentBalance: "180000.00",
  }).returning();

  const [idfc] = await db.insert(accountsTable).values({
    name: "IDFC First", type: "bank", currentBalance: "75000.00",
  }).returning();

  const [iciciCC] = await db.insert(accountsTable).values({
    name: "ICICI Amazon Pay CC", type: "credit_card", currentBalance: "-32500.00",
    creditLimit: "200000", billingDueDay: 15,
  }).returning();

  const [hdfcCC] = await db.insert(accountsTable).values({
    name: "HDFC Regalia CC", type: "credit_card", currentBalance: "-18750.00",
    creditLimit: "500000", billingDueDay: 5,
  }).returning();

  console.log("Creating categories...");
  const expenseCategories = [
    "EMI (PL)", "Father", "Credit Card (CC)", "Living Expenses",
    "SIP (Investment)", "Travel Fund", "Term Insurance", "Health Insurance",
    "Food", "Gifts", "Home", "Transportation", "Personal", "Utilities",
    "Medical", "Other (Tax)", "Entertainment", "Shopping",
  ];
  const incomeCategories = ["Paycheck (Salary)", "Bonus", "Interest", "Other", "Freelance"];

  await db.insert(categoriesTable).values([
    ...expenseCategories.map(name => ({ name, type: "Expense" })),
    ...incomeCategories.map(name => ({ name, type: "Income" })),
  ]);

  const allCategories = await db.select().from(categoriesTable);
  const catByName = new Map(allCategories.map(c => [c.name, c.id]));

  console.log("Creating budget goals...");
  const budgetGoals = [
    { categoryId: catByName.get("Living Expenses")!, plannedAmount: "25000" },
    { categoryId: catByName.get("Food")!, plannedAmount: "12000" },
    { categoryId: catByName.get("Transportation")!, plannedAmount: "5000" },
    { categoryId: catByName.get("EMI (PL)")!, plannedAmount: "15000" },
    { categoryId: catByName.get("SIP (Investment)")!, plannedAmount: "10000" },
    { categoryId: catByName.get("Term Insurance")!, plannedAmount: "1500" },
    { categoryId: catByName.get("Health Insurance")!, plannedAmount: "2000" },
    { categoryId: catByName.get("Utilities")!, plannedAmount: "3000" },
    { categoryId: catByName.get("Personal")!, plannedAmount: "5000" },
    { categoryId: catByName.get("Entertainment")!, plannedAmount: "3000" },
    { categoryId: catByName.get("Credit Card (CC)")!, plannedAmount: "20000" },
    { categoryId: catByName.get("Father")!, plannedAmount: "10000" },
  ];
  await db.insert(budgetGoalsTable).values(budgetGoals);

  console.log("Creating savings goals...");
  const [emergencyGoal] = await db.insert(goalsTable).values({
    name: "Emergency Fund", targetAmount: "300000", currentAmount: "125000",
    accountId: idfc.id, status: "Active", targetDate: "2026-12-31",
    categoryType: "Emergency", icon: "🛡️",
  }).returning();

  const [travelGoal] = await db.insert(goalsTable).values({
    name: "Goa Trip 2026", targetAmount: "50000", currentAmount: "35000",
    accountId: hdfc.id, status: "Active", targetDate: "2026-06-30",
    categoryType: "Travel", icon: "✈️",
  }).returning();

  const [homeGoal] = await db.insert(goalsTable).values({
    name: "Home Down Payment", targetAmount: "1500000", currentAmount: "220000",
    accountId: sbi.id, status: "Active", targetDate: "2028-12-31",
    categoryType: "Purchase", icon: "🏠",
  }).returning();

  const [_achievedGoal] = await db.insert(goalsTable).values({
    name: "New Laptop", targetAmount: "80000", currentAmount: "80000",
    accountId: hdfc.id, status: "Achieved", targetDate: "2025-06-30",
    categoryType: "Purchase", icon: "💻",
  }).returning();

  const [_newGoal] = await db.insert(goalsTable).values({
    name: "Debt Payoff", targetAmount: "200000", currentAmount: "0",
    accountId: sbi.id, status: "Active", targetDate: "2027-03-31",
    categoryType: "Debt", icon: "💳",
  }).returning();

  console.log("Creating monthly config entries...");
  const monthlyConfigs = [
    { month: "2024-10", startingBalance: "180000" },
    { month: "2024-11", startingBalance: "195000" },
    { month: "2024-12", startingBalance: "210000" },
    { month: "2025-01", startingBalance: "225000" },
    { month: "2025-02", startingBalance: "240000" },
    { month: "2025-03", startingBalance: "255000" },
    { month: "2025-04", startingBalance: "270000" },
  ];
  await db.insert(monthlyConfigTable).values(monthlyConfigs);

  console.log("Creating transactions across 6+ months...");
  const months = ["2024-10", "2024-11", "2024-12", "2025-01", "2025-02", "2025-03"];

  for (const month of months) {
    const [_year, mo] = month.split("-");

    await db.insert(transactionsTable).values({
      date: `${month}-01`, amount: "85000.00", description: "Monthly Salary - TCS",
      category: "Paycheck (Salary)", type: "Income", accountId: sbi.id,
    });

    if (mo === "12") {
      await db.insert(transactionsTable).values({
        date: `${month}-15`, amount: "42500.00", description: "Performance Bonus Q3",
        category: "Bonus", type: "Income", accountId: sbi.id,
      });
    }

    await db.insert(transactionsTable).values({
      date: `${month}-05`, amount: "15000.00", description: "Personal Loan EMI - HDFC",
      category: "EMI (PL)", type: "Expense", accountId: hdfc.id,
    });

    await db.insert(transactionsTable).values({
      date: `${month}-01`, amount: "22000.00", description: "Rent + Maintenance",
      category: "Living Expenses", type: "Expense", accountId: hdfc.id,
    });

    await db.insert(transactionsTable).values({
      date: `${month}-08`, amount: "3500.00", description: "Electricity + Water + Gas",
      category: "Utilities", type: "Expense", accountId: hdfc.id,
    });

    const foodExpenses = [
      { day: "03", amount: "2800.00", desc: "Swiggy/Zomato orders" },
      { day: "10", amount: "3200.00", desc: "BigBasket groceries" },
      { day: "18", amount: "1500.00", desc: "Dining out" },
      { day: "25", amount: "2000.00", desc: "Monthly provisions - DMart" },
    ];
    for (const food of foodExpenses) {
      const dayStr = food.day;
      const dateStr = `${month}-${dayStr}`;
      await db.insert(transactionsTable).values({
        date: dateStr, amount: food.amount, description: food.desc,
        category: "Food", type: "Expense", accountId: hdfc.id,
      });
    }

    await db.insert(transactionsTable).values({
      date: `${month}-05`, amount: "10000.00", description: "SIP - Axis Bluechip Fund",
      category: "SIP (Investment)", type: "Expense", accountId: sbi.id,
    });

    await db.insert(transactionsTable).values({
      date: `${month}-10`, amount: "1250.00", description: "Term Insurance Premium - ICICI Pru",
      category: "Term Insurance", type: "Expense", accountId: hdfc.id,
    });

    await db.insert(transactionsTable).values({
      date: `${month}-10`, amount: "1800.00", description: "Health Insurance - Star Health",
      category: "Health Insurance", type: "Expense", accountId: hdfc.id,
    });

    await db.insert(transactionsTable).values({
      date: `${month}-01`, amount: "10000.00", description: "Monthly support - Father",
      category: "Father", type: "Expense", accountId: sbi.id,
    });

    await db.insert(transactionsTable).values({
      date: `${month}-12`, amount: "2500.00", description: "Metro card + Uber rides",
      category: "Transportation", type: "Expense", accountId: iciciCC.id,
    });

    await db.insert(transactionsTable).values({
      date: `${month}-15`, amount: "3000.00", description: "Amazon + Flipkart purchases",
      category: "Shopping", type: "Expense", accountId: iciciCC.id,
    });

    if (mo === "01" || mo === "04" || mo === "07" || mo === "10") {
      await db.insert(transactionsTable).values({
        date: `${month}-15`, amount: "8500.00", description: "Advance Tax Payment",
        category: "Other (Tax)", type: "Expense", accountId: sbi.id,
      });
    }

    if (Number(mo) % 2 === 0) {
      await db.insert(transactionsTable).values({
        date: `${month}-20`, amount: "5000.00", description: "Weekend trip expenses",
        category: "Travel Fund", type: "Expense", accountId: hdfc.id,
      });
    }

    await db.insert(transactionsTable).values({
      date: `${month}-14`, amount: "15000.00", description: "CC Payment - ICICI Amazon",
      category: "Credit Card (CC)", type: "Expense", accountId: hdfc.id,
    });

    await db.insert(transactionsTable).values({
      date: `${month}-15`, amount: "15000.00",
      description: `Transfer: HDFC Savings → ICICI Amazon Pay CC`,
      category: "Transfer", type: "Transfer",
      accountId: hdfc.id, toAccountId: iciciCC.id,
    });

    await db.insert(transactionsTable).values({
      date: `${month}-20`, amount: "350.00", description: "Savings account interest",
      category: "Interest", type: "Income", accountId: idfc.id,
    });
  }

  await db.insert(transactionsTable).values({
    date: "2025-02-14", amount: "5000.00", description: "Valentine's Day gift",
    category: "Gifts", type: "Expense", accountId: iciciCC.id,
  });

  await db.insert(transactionsTable).values({
    date: "2025-01-15", amount: "8000.00", description: "Doctor consultation + medicines",
    category: "Medical", type: "Expense", accountId: hdfc.id,
  });

  await db.insert(transactionsTable).values({
    date: "2024-12-25", amount: "12000.00", description: "Christmas shopping",
    category: "Shopping", type: "Expense", accountId: hdfcCC.id,
  });

  console.log("Creating surplus allocations...");
  const allocationMonths = ["2024-11", "2024-12", "2025-01", "2025-02", "2025-03"];
  for (const allocMonth of allocationMonths) {
    const allocDate = new Date(`${allocMonth}-28T10:00:00Z`);

    await db.insert(surplusAllocationsTable).values({
      month: allocMonth, goalId: emergencyGoal.id, amount: "15000.00",
      sourceAccountId: sbi.id, allocatedAt: allocDate,
    });

    await db.insert(surplusAllocationsTable).values({
      month: allocMonth, goalId: travelGoal.id, amount: "5000.00",
      sourceAccountId: hdfc.id, allocatedAt: allocDate,
    });

    if (allocMonth >= "2025-01") {
      await db.insert(surplusAllocationsTable).values({
        month: allocMonth, goalId: homeGoal.id, amount: "20000.00",
        sourceAccountId: sbi.id, allocatedAt: allocDate,
      });
    }
  }

  console.log("\n=== Test Seed Complete ===");
  console.log("Accounts: 5 (3 bank, 2 credit card)");
  console.log("Categories: 23 (18 expense, 5 income)");
  console.log("Budget Goals: 12");
  console.log("Savings Goals: 5 (4 active, 1 achieved)");
  console.log("Transactions: 6+ months of realistic data");
  console.log("Surplus Allocations: spanning 5 months");
  console.log("Monthly Config: 7 months");

  await pool.end();
  process.exit(0);
}

testSeed().catch((err) => {
  console.error("Test seed failed:", err);
  process.exit(1);
});
