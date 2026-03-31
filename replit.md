# Workspace

## Overview

SurplusEngine — a personal finance web application that tracks bank balances, daily transactions, and automates "waterfall surplus" logic for financial goals (Emergency Fund and Loan Prepayment). Built as a pnpm workspace monorepo using TypeScript.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (API server), Vite (frontend)
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui + Recharts
- **Currency**: Indian Rupee (INR) with `en-IN` locale formatting

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── finance-app/        # React + Vite frontend (SurplusEngine)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts
├── pnpm-workspace.yaml     # pnpm workspace
├── tsconfig.base.json      # Shared TS options
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/finance-app` (`@workspace/finance-app`)

React + Vite frontend for SurplusEngine. Dark mode personal finance dashboard with 6 tabs: Dashboard, Transactions, Budget, Goal Vault, Accounts, Settings.

- Uses wouter for routing, Recharts for charts, shadcn/ui components
- Responsive design: tables transform to card views on mobile (< 768px)
- Currency formatted as INR (₹) with Indian number grouping via `formatCurrency` in `src/lib/constants.ts`
- All API calls use generated hooks from `@workspace/api-client-react`

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes:
  - `health.ts` — `GET /api/healthz`
  - `transactions.ts` — CRUD for transactions + `GET /api/transactions/recent`
  - `monthly-config.ts` — upsert monthly starting balance
  - `budget-goals.ts` — upsert budget planned amounts per category
  - `goal-vaults.ts` — upsert goal vaults + `GET /api/goal-vaults/projection` (12-month projection)
  - `dashboard.ts` — `GET /api/dashboard/summary` + `GET /api/dashboard/monthly-trend` + `GET /api/billing-cycles`
  - `budget-analysis.ts` — `GET /api/budget-analysis` (planned vs actual per category)
  - `surplus.ts` — `POST /api/surplus/consolidate` (waterfall surplus into Emergency Fund)
  - `accounts.ts` — CRUD for bank accounts and credit cards
  - `categories.ts` — CRUD for expense/income categories
  - `transfers.ts` — `POST /api/transfers` (atomic inter-account transfer)
  - `trends.ts` — `GET /api/trends/cc-spend` + `GET /api/trends/living-expenses`
- Depends on: `@workspace/db`, `@workspace/api-zod`
- Billing cycle: 25th of previous month through 24th of current month (helper in `src/lib/billing-cycle.ts`)

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Tables:

- `accounts` — id, name, type (bank/credit_card), current_balance, credit_limit
- `categories` — id, name, type (Income/Expense)
- `transactions` — date, amount, description, category, type (Income/Expense/Transfer), account_id, to_account_id
- `monthly_config` — month (YYYY-MM), starting_balance
- `budget_goals` — category (unique), planned_amount
- `goal_vaults` — name (unique), current_balance, target_amount
- `surplus_ledger` — surplus tracking

Seed script: `lib/db/src/seed.ts` — creates default Primary Bank account, seeds categories from hardcoded lists, maps unmapped transactions.

Production migrations are handled by Replit when publishing. In development, we use `pnpm --filter @workspace/db run push`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec. Used by `api-server` for request/response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec.

### `scripts` (`@workspace/scripts`)

Utility scripts package. Run scripts via `pnpm --filter @workspace/scripts run <script>`.

## Waterfall Surplus Logic

1. Total Expenses & Savings = sum of all mandatory costs (EMI + Father + CC + Living Exp + SIP + Travel Fund + Insurances)
2. Monthly Surplus = Total Actual Income - Total Expenses & Savings
3. Surplus Allocation: "Consolidate" button moves the Monthly Surplus into the Emergency Fund (IDFC) vault
4. Rolling Balance: End Balance of Month A becomes Starting Balance of Month B. End Balance = Starting Balance + Income - Expenses

## Billing Cycle

The app uses a custom billing cycle: 25th of the previous month through 24th of the current month. Dashboard summary, budget analysis, and trend charts all use this cycle instead of calendar months. Transaction history supports a "Cycle Filter" dropdown.

## Accounts & Transfers

- Multiple bank accounts and credit cards with tracked balances
- Transfers between accounts update both balances atomically (DB transaction)
- Transfer-type transactions are excluded from Income/Expense aggregations
- Creating/updating/deleting Income/Expense transactions adjusts the linked account balance atomically

## Categories

Categories are stored in the database (not hardcoded) and manageable via Settings > Category Manager. Seeded with: EMI (PL), Father, Credit Card (CC), Living Expenses, SIP (Investment), Travel Fund, Term Insurance, Health Insurance, Food, Gifts, Home, Transportation, Personal, Utilities, Medical, Other (Tax), Paycheck (Salary), Bonus, Interest, Other.
