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
- **Currency**: Configurable (INR/USD/EUR/GBP) via app_settings table, with locale-aware formatting

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   │   └── src/__tests__/  # Vitest + Supertest integration & unit tests
│   └── finance-app/        # React + Vite frontend (SurplusEngine)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   │   └── src/test-seed.ts # Comprehensive test seed data script
│   └── integrations-anthropic-ai/ # Anthropic AI SDK client (Replit AI Integrations)
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts
├── pnpm-workspace.yaml     # pnpm workspace
├── tsconfig.base.json      # Shared TS options
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## Testing

- **Test runner**: Vitest (configured in `artifacts/api-server/vitest.config.ts`)
- **Integration tests**: Supertest against Express app with real PostgreSQL
- **Run tests**: `pnpm --filter @workspace/api-server test`
- **Run seed data**: `pnpm --filter @workspace/db test-seed`
- **Test coverage**: 117 tests across 12 files (accounts, transactions, transfers, categories, budgets, goals, surplus, dashboard, analytics, health, billing cycle, edge cases)
- Tests use `beforeEach` truncation for isolation, running sequentially in a single fork

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

React + Vite frontend for SurplusEngine. Dark mode personal finance dashboard with 6 tabs: Dashboard, Transactions, Budget, Goals, Accounts, Settings.

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
  - `budget-goals.ts` — upsert budget planned amounts per category (uses category_id FK to categories)
  - `goals.ts` — Dynamic goal CRUD, `GET /api/goals/waterfall` (Net Worth Waterfall), `GET /api/goals/:id/projection` (per-goal 12-month projection)
  - `dashboard.ts` — `GET /api/dashboard/summary` + `GET /api/dashboard/monthly-trend` + `GET /api/billing-cycles`
  - `budget-analysis.ts` — `GET /api/budget-analysis` returns `BudgetAnalysisResponse` with `{ daysElapsed, totalCycleDays, rows }`. Each row includes pace status (on_pace/ahead/over_budget), category type (fixed/discretionary), percentSpent, and paceMessage. Fixed categories: EMI, SIP, Insurance, Father, Credit Card. Pacing compares spending rate vs time elapsed in cycle.
  - `surplus.ts` — `POST /api/surplus/consolidate` (legacy) + `POST /api/surplus/distribute` (distribute surplus across goals) + `GET /api/surplus/allocations`
  - `accounts.ts` — CRUD for bank accounts, credit cards, and loans + `POST /api/accounts/:id/reconcile` (balance reconciliation) + `POST /api/accounts/process-emis` (process monthly EMI payments for loan accounts)
  - `categories.ts` — CRUD for expense/income categories + `PATCH /api/categories/:id` (rename with cascade to transactions). Creating expense categories auto-creates budget_goals with sensible defaults via category_id FK.
  - `ai.ts` — `POST /api/ai/parse` — AI-powered intent router for natural language commands. Supports intents: `add_transaction`, `transfer`, `add_category`, `add_account`, `set_budget`, `add_savings_goal`. Transaction/transfer intents return parsed fields for frontend review; creation intents execute server-side and return confirmation.
  - `transfers.ts` — `POST /api/transfers` (atomic inter-account transfer)
  - `trends.ts` — `GET /api/trends/cc-spend` + `GET /api/trends/living-expenses`
  - `analytics.ts` — `GET /api/analytics/spend-by-category` + `GET /api/analytics/category-trend` + `GET /api/analytics/cc-dues` (returns remainingLimit, sharedLimitGroup, and smart due dates that shift to next month when payment detected in current billing cycle)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- Billing cycle: 25th of previous month through 24th of current month (helper in `src/lib/billing-cycle.ts`)

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Tables:

- `accounts` — id, name, type (bank/credit_card), current_balance, credit_limit, billing_due_day (nullable integer 1-31 for CC payment due date), shared_limit_group (nullable text — groups credit cards that share a single credit limit)
- `categories` — id, name, type (Income/Expense)
- `transactions` — date, amount, description, category, type (Income/Expense/Transfer), account_id, to_account_id
- `monthly_config` — month (YYYY-MM), starting_balance
- `budget_goals` — id, category_id (FK → categories, unique), planned_amount
- `goals` — id, name, target_amount, current_amount, account_id (FK → accounts), status (Active/Paused/Achieved), target_date, category_type, icon
- `surplus_allocations` — id, month, goal_id (FK → goals), amount, source_account_id (FK → accounts), allocated_at

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

### Category Icon Mapping

Every category has a matching Lucide icon via `src/lib/category-icons.ts`. The `getCategoryIcon(name)` function returns the icon component; unknown categories fall back to `Tag`. The `CategoryBadge` component (`src/components/category-badge.tsx`) renders icon + name with emerald tint for income or rose tint for expenses. Used in transactions table, budget breakdown, dashboard recent ledger, and settings category list.

## UI Theme — iOS-Style Glass System

- **Design language**: Apple iOS/macOS Control Center aesthetic — layered frosted glass on dark mesh gradient
- **Glass tiers** (defined in `index.css`):
  - `.glass-1` — Primary cards: `rgba(255,255,255,0.04)` bg + `blur(16px) saturate(180%)` + white/6 border
  - `.glass-2` — Nested/inputs: `rgba(255,255,255,0.06)` bg + `blur(12px) saturate(150%)` + white/8 border
  - `.glass-3` — Elevated/modals/dropdowns: `rgba(255,255,255,0.08)` bg + `blur(24px) saturate(150%)` + white/10 border
  - `.glass-card` — Alias for glass-1 with rounded-xl and transitions
  - `.glass-nav` — Nav bar: `rgba(10,14,28,0.6)` bg + `blur(40px) saturate(150%)`
- **Background**: Mesh gradient (`mesh-gradient-bg`) with animated ambient orbs (`ambient-orbs`)
- **Navigation**: Frosted glass-nav header, active tab highlighted with `bg-white/10` pill
- **Heading font**: Inter with -0.02em letter-spacing; JetBrains Mono for monetary values
- **Dashboard hero**: Net Worth spans 2/3 of top row; Goal Progress radial ring in remaining 1/3
- **Monthly Flow**: Full-width waterfall bar chart (Income → Expenses → Surplus → Goals)
- **Charts**: monotone curves with linearGradient fills; glass-3 tooltips; `rgba(255,255,255,0.04)` gridlines
- **Action buttons**: Solid emerald (bg-emerald-600) for primary actions (Log Transaction, etc.)
- **Tables**: Zebra striping via `zebra-row` CSS class
- **Accessibility**: `@supports not (backdrop-filter)` fallback to solid backgrounds; `prefers-reduced-motion` disables glass animations
- **Mobile**: 44px minimum touch targets; bottom-sheet drawer (Sheet) for adding transactions on mobile viewports
- **Performance**: Max 2 nested backdrop-filter layers; no persistent `will-change` on always-visible elements

## AI Transaction Assistant

The app includes a conversational AI transaction parser accessible via a floating action button (FAB) at the bottom-right. Key features:

- **Multi-turn chat**: Slide-up panel (~50vh) with message bubbles, pill button options, and rich confirmation cards
- **Smart slot-filling**: AI extracts fields from natural language, applies smart defaults (date=today, type from language, account/category from merchant history), and only asks about truly missing fields
- **Confirmation cards**: Shows transaction summary with amount, category icon, description, date, account + "Log It" / "Edit" buttons
- **Edit mode**: Inline-editable fields on the confirmation card
- **Undo**: 10-second undo link after logging a transaction
- **Session-scoped**: Chat history clears on panel close; conversation context resets after each logged transaction
- **Backend**: `POST /api/ai/chat` endpoint with Anthropic Claude integration, transaction history helpers for merchant-based defaults
- **Files**: `artifacts/api-server/src/routes/ai-chat.ts`, `artifacts/finance-app/src/components/ai-parse-bubble.tsx`
