# SurplusEngine - Comprehensive Requirements Document

**Version:** 1.0
**Date:** March 31, 2026
**Status:** Implemented

---

## 1. Executive Summary

SurplusEngine is a full-stack personal finance web application designed to help users track income, expenses, savings goals, and surplus allocation using a **waterfall surplus logic** model. The app uses **INR (Indian Rupees)** with Indian number formatting (en-IN locale) throughout. It features a dark-mode "Sophisticated Midnight" UI built with React + Vite on the frontend and a PostgreSQL database with Drizzle ORM on the backend.

The core philosophy: every rupee of income flows through a structured waterfall — Income minus Expenses equals Surplus, and Surplus is distributed into savings Goals.

---

## 2. Technology Stack

| Layer | Technology |
|:------|:-----------|
| Frontend | React 19 + Vite + TypeScript |
| UI Components | shadcn/ui + Tailwind CSS v4 |
| Charts | Recharts (Area, Bar, Pie, Line charts) |
| Routing | Wouter (lightweight client-side routing) |
| State/Data | TanStack React Query + Orval-generated API client |
| Backend | Express.js + TypeScript |
| Database | PostgreSQL (Drizzle ORM) |
| API Spec | OpenAPI 3.0 (YAML) with auto-generated types |
| Monorepo | pnpm workspaces |
| Icons | Lucide React |
| Fonts | Inter (headings), JetBrains Mono (monetary values) |

---

## 3. Architecture Overview

### 3.1 Monorepo Structure

```
workspace/
  artifacts/
    finance-app/     # React + Vite frontend
    api-server/      # Express API server
    mockup-sandbox/  # Design preview server
  lib/
    db/              # Drizzle ORM schema + migrations
    api-spec/        # OpenAPI specification (openapi.yaml)
    api-client/      # Auto-generated API client (Orval)
    api-client-react/ # Auto-generated React Query hooks
  scripts/           # Build & post-merge scripts
```

### 3.2 Data Flow

```
Frontend (React) --> API Client (generated) --> Express API --> Drizzle ORM --> PostgreSQL
```

---

## 4. Database Schema

### 4.1 accounts
Stores bank accounts and credit cards.

| Column | Type | Constraints |
|:-------|:-----|:------------|
| id | serial | Primary Key |
| name | text | Not Null, Unique |
| type | text | Not Null, Default: "Bank" |
| currentBalance | numeric(12,2) | Not Null, Default: "0" |
| creditLimit | numeric(12,2) | Optional (Credit Cards only) |
| billingDueDay | integer | Optional, 1-31 (Credit Cards only) |

### 4.2 transactions
Records all financial transactions and inter-account transfers.

| Column | Type | Constraints |
|:-------|:-----|:------------|
| id | serial | Primary Key |
| date | date | Not Null |
| amount | numeric(12,2) | Not Null |
| description | text | Not Null |
| category | text | Not Null |
| type | text | Not Null (Income/Expense/Transfer) |
| accountId | integer | FK -> accounts.id |
| toAccountId | integer | FK -> accounts.id (transfers only) |
| createdAt | timestamp | Not Null, Default: now() |

### 4.3 categories
User-managed transaction categories.

| Column | Type | Constraints |
|:-------|:-----|:------------|
| id | serial | Primary Key |
| name | text | Not Null |
| type | text | Not Null (Income/Expense) |

### 4.4 budget_goals
Planned monthly spending targets per category.

| Column | Type | Constraints |
|:-------|:-----|:------------|
| id | serial | Primary Key |
| category | text | Not Null, Unique |
| plannedAmount | numeric(12,2) | Not Null, Default: "0" |

### 4.5 goals
Long-term savings goals linked to funding accounts.

| Column | Type | Constraints |
|:-------|:-----|:------------|
| id | serial | Primary Key |
| name | text | Not Null |
| targetAmount | numeric(12,2) | Not Null, Default: "0" |
| currentAmount | numeric(12,2) | Not Null, Default: "0" |
| accountId | integer | Not Null, FK -> accounts.id |
| status | text | Not Null, Default: "Active" |
| targetDate | date | Optional |
| categoryType | text | Not Null, Default: "General" |
| icon | text | Optional |

### 4.6 goal_vaults
Accumulation vaults for goal funding.

| Column | Type | Constraints |
|:-------|:-----|:------------|
| id | serial | Primary Key |
| name | text | Not Null, Unique |
| currentBalance | numeric(12,2) | Not Null, Default: "0" |
| targetAmount | numeric(12,2) | Not Null, Default: "0" |

### 4.7 surplus_ledger
Historical records of surplus consolidation.

| Column | Type | Constraints |
|:-------|:-----|:------------|
| id | serial | Primary Key |
| month | text | Not Null, Unique (YYYY-MM) |
| amount | numeric(12,2) | Not Null, Default: "0" |
| vaultName | text | Not Null |
| consolidatedAt | timestamp | Not Null, Default: now() |

### 4.8 surplus_allocations
Tracks surplus distribution to specific goals.

| Column | Type | Constraints |
|:-------|:-----|:------------|
| id | serial | Primary Key |
| month | text | Not Null |
| goalId | integer | Not Null, FK -> goals.id |
| amount | numeric(12,2) | Not Null |
| sourceAccountId | integer | FK -> accounts.id (Optional) |
| allocatedAt | timestamp | Not Null, Default: now() |

### 4.9 monthly_config
Per-month configuration (e.g., starting balances).

| Column | Type | Constraints |
|:-------|:-----|:------------|
| id | serial | Primary Key |
| month | text | Not Null, Unique (YYYY-MM) |
| startingBalance | numeric(12,2) | Not Null, Default: "0" |

---

## 5. API Endpoints

### 5.1 Health

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| GET | /api/healthz | Health check, returns `{ status: "ok" }` |

### 5.2 Accounts

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| GET | /api/accounts | List all accounts |
| POST | /api/accounts | Create a new account (Bank or Credit Card) |
| PUT | /api/accounts/:id | Update account details (name, credit limit, billing due day) |
| DELETE | /api/accounts/:id | Delete account (only if no transactions linked) |
| POST | /api/accounts/:id/reconcile | Reconcile balance to actual amount, creates adjustment transaction |

### 5.3 Transactions

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| GET | /api/transactions | List transactions with filters (cycle, month, type, category, search) |
| GET | /api/transactions/recent | Fetch most recent transactions (excludes transfers), supports limit param |
| POST | /api/transactions | Create transaction (Income/Expense), auto-updates account balance |
| PUT | /api/transactions/:id | Update transaction, adjusts account balances accordingly |
| DELETE | /api/transactions/:id | Delete transaction, reverts account balance impact |

### 5.4 Transfers

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| POST | /api/transfers | Record inter-account transfer, updates both account balances |

### 5.5 Categories

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| GET | /api/categories | List categories, optional filter by type |
| POST | /api/categories | Create a new category |
| DELETE | /api/categories/:id | Delete a category |

### 5.6 Budget

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| GET | /api/budget-goals | List all planned budget amounts per category |
| POST | /api/budget-goals | Upsert (create/update) a planned amount for a category |
| DELETE | /api/budget-goals/:id | Delete a budget goal |
| GET | /api/budget-analysis | Compare planned vs. actual spending for a given month |

### 5.7 Dashboard & Billing Cycles

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| GET | /api/dashboard/summary | Financial summary for a month (balances, income, expenses, surplus, burn rate) |
| GET | /api/dashboard/monthly-trend | Income vs. Expenses trend for last 6 months |
| GET | /api/billing-cycles | Available billing cycle date ranges |

### 5.8 Goals

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| GET | /api/goals | List goals with intelligence metrics (velocity, projected finish) |
| POST | /api/goals | Create a new savings goal |
| PUT | /api/goals/:id | Update goal details or progress |
| DELETE | /api/goals/:id | Delete a goal |
| GET | /api/goals/waterfall | Waterfall data: Bank balances minus goal allocations = liquid cash |
| GET | /api/goals/:id/projection | 12-month savings projection for a specific goal |

### 5.9 Surplus Management

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| GET | /api/surplus/monthly | Calculate available surplus (Income - Expenses) for a month |
| POST | /api/surplus/distribute | Distribute surplus into savings goals, performs account transfers |
| GET | /api/surplus/allocations | List all historical surplus distributions |

### 5.10 Trends & Analytics

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| GET | /api/trends/cc-spend | Credit card spending trends (last 6 cycles) |
| GET | /api/trends/living-expenses | Living expense trends (last 6 cycles) |
| GET | /api/analytics/spend-by-category | Spending breakdown by category for a month |
| GET | /api/analytics/category-trend | Per-category spending trends over last 6 months |
| GET | /api/analytics/cc-dues | Outstanding CC balances with days until next due date |

---

## 6. Frontend Pages & Features

### 6.1 Dashboard ("/")
The financial cockpit providing a high-level overview.

**Hero Section (Top Row):**
- **Net Liquidity Card** (2/3 width): Displays total available cash (Bank Balance minus Unpaid CC Dues). Shows individual bank and CC totals with Wallet/CreditCard icons.
- **Goal Progress Card** (1/3 width): Radial SVG progress ring showing percentage completion across all savings goals.

**KPI Cards:**
- **Monthly Burn Rate**: Progress bar comparing actual vs. planned living expenses. Turns red when over 100%.
- **Monthly Overview**: Total Income (emerald) and Estimated Surplus (primary) with icons.

**Liquidity Status Badge:**
- Green "Liquid" badge when bank balance covers monthly expenses.
- Amber "Low Cash" badge when cash is insufficient.

**CC Payment Dues Card:**
- Lists upcoming credit card payments with urgency indicators:
  - Red "Urgent" (7 days or less)
  - Amber "Warning" (7-14 days)
  - Green "OK" (14+ days)
- Shows outstanding amount and days remaining for each card.

**Charts & Visualizations:**
- **Monthly Flow (Waterfall Bar Chart)**: Full-width visualization showing Income -> Expenses -> Surplus -> Goals flow.
- **Income vs. Expenses Trend (Area Chart)**: 6-month trend with gradient fills, monotone curves.
- **CC Spend Trend (Area Chart)**: Credit card spending over 6 billing cycles.
- **Living Expenses Trend (Area Chart)**: Living expense tracking over 6 cycles.
- **Spend by Category (Pie Chart)**: Expense breakdown with custom legend displaying Lucide category icons.
- **Category Trend (Area Chart)**: Per-category spending over 6 cycles with dropdown selector for filtering (All Categories or individual).

**Recent Ledger:**
- Last 5 transactions with category icons, amounts, and "View All" link.

### 6.2 Transactions / Ledger ("/transactions")
Full transaction management.

**Transaction Entry:**
- Desktop: Dialog modal for logging transactions.
- Mobile: Bottom-sheet drawer for logging transactions.
- Fields: Date, Amount, Type (Income/Expense), Account, Category, Description.
- **Inline Category Creation**: "+ Add Category" option inside the category dropdown. Selecting it reveals an inline input to create a new category without leaving the form.

**Transaction Table:**
- Responsive: Full table on desktop, card layout on mobile.
- **Zebra Striping**: Subtle alternating row backgrounds.
- **Category Badges**: Each category displayed with its matching Lucide icon and low-opacity colored background (emerald tint for income, rose for expenses).
- **Sorting**: By Date, Amount, Category, Description (ascending/descending toggle).
- **Filtering**: Text search by description + billing cycle dropdown filter.
- **Transfer Display**: Transfer transactions shown with blue ArrowLeftRight icon.
- **Delete**: Per-row delete with confirmation.

**Mobile-Specific:**
- Dedicated sort dropdown and direction toggle.
- 44px minimum touch targets on all interactive elements.

### 6.3 Budget ("/budget")
Budget planning and analysis.

**KPI Summary Cards:**
- Total Planned (sum of all budget goals)
- Total Actual (real-time spending total)
- Net Difference (emerald if under budget, red if over)

**Category Breakdown Table:**
- **Category**: Badge with Lucide icon and name.
- **Planned**: Editable input field per category. Save icon appears when modified.
- **Actual**: Current cycle spending from transactions.
- **Difference**: Variance display with alert icon if over budget.

### 6.4 Goals / Goal Vault ("/goals")
Long-term savings goal management.

**Goal Creation:**
- Fields: Name, Target Amount, Target Date, Category Type (Emergency, Debt, Travel, Purchase, General), Funding Account.
- Category types display emoji icons.

**Goal Cards:**
- Status indicators: On Track, At Risk, Behind, Not Started, Achieved.
- Progress bar with percentage and current vs. target amounts.
- Savings velocity (e.g., "5,000/mo").
- Edit (Pencil icon) and Delete (Trash icon) actions.

**Key Features:**
- **End Cycle / Distribute Surplus**: Trigger button to allocate current month's surplus across active goals proportionally.
- **Goal Projection Chart**: 12-month line chart projecting when a selected goal will be reached.
- **Stress Test Alert**: Warning banner when user is "Goal Rich but Cash Poor" (unallocated cash below monthly living expenses).

### 6.5 Accounts ("/accounts")
Account management and net worth tracking.

**Net Worth Card:**
- Displays calculated Net Worth (Total Bank Balances - Total CC Outstanding).
- TrendingUp icon.

**Account Management:**
- **Account Types**: Bank Account, Credit Card.
- **Create Account**: Form with Name, Type, Initial Balance, Credit Limit (CC only), Billing Due Day (CC only, 1-31 validated).
- **Edit Account**: Dialog with editable Name, Credit Limit, Billing Due Day. Pencil icon trigger on all views.
- **Delete Account**: Only allowed if no transactions are linked.
- **Reconcile**: Adjusts tracked balance to match actual bank statement. Automatically creates an "Adjustment" transaction for the difference.

**Account Display:**
- Desktop: Full table with columns for Name, Type, Balance, Credit Limit, Due Day, Actions (Reconcile/Edit/Delete).
- Mobile: Separate card sections for Bank Accounts (emerald theme) and Credit Cards (rose theme) with all action buttons.

**Transfer Modal:**
- Source Account, Destination Account, Amount, Date, Description.
- Validation: Source and destination must differ.

### 6.6 Settings ("/settings")
Application configuration.

**Category Manager:**
- Add new categories with Name and Type (Expense/Income).
- Category list with Lucide icons, type labels, and delete action.
- Desktop: Table view.
- Mobile: Grouped list by type (Expense vs. Income).

---

## 7. Default Categories

### 7.1 Expense Categories
| Category | Lucide Icon |
|:---------|:------------|
| EMI (PL) | Banknote |
| Father | Heart |
| Credit Card (CC) | CreditCard |
| Living Expenses | Home |
| SIP (Investment) | TrendingUp |
| Travel Fund | Plane |
| Term Insurance | Shield |
| Health Insurance | ShieldPlus |
| Food | Utensils |
| Gifts | Gift |
| Home | Home |
| Transportation | Car |
| Personal | User |
| Utilities | Zap |
| Medical | Stethoscope |
| Other (Tax) | Receipt |

### 7.2 Income Categories
| Category | Lucide Icon |
|:---------|:------------|
| Paycheck (Salary) | Wallet |
| Bonus | Star |
| Interest | Percent |
| Other | Tag (fallback) |

User-created categories automatically receive a **Tag** icon as fallback.

---

## 8. UI/UX Design Specifications

### 8.1 Theme: "Sophisticated Midnight"

**Color Palette:**
- Background: Deep Slate (#0f172a / HSL 222 47% 7%)
- Cards: Zinc-900 (#18181b / HSL 222 47% 10%)
- Primary (Positive flows): Emerald-500 (HSL 160 84% 39%)
- Destructive (Expenses/Debt): Rose-500 (HSL 354 70% 54%)

**Glassmorphism:**
- Dashboard cards: 1px solid white/10% border + backdrop-blur effect.
- Header: backdrop-blur with semi-transparent background.

**Typography:**
- Headings: Inter, Semi-bold, letter-spacing -0.02em.
- Body: Inter, Regular.
- Monetary Values: JetBrains Mono (monospace "ticker" feel).

**Background:**
- Subtle mesh gradient (deep blues/purples via CSS radial gradients) to prevent flat appearance.

### 8.2 Chart Styling
- All area/line charts: monotone curves with gradient fills underneath.
- Custom tooltips: dark theme background, monospace font, rounded corners.
- Pie chart: custom legend with Lucide category icons.

### 8.3 Responsive Design
- Desktop: Full tables, dialog modals, horizontal navigation.
- Mobile: Card layouts, bottom-sheet drawers, scrollable horizontal nav pills.
- Minimum touch target: 44px on all interactive elements.
- Navigation: Horizontal tab bar (desktop), scrollable pill bar (mobile).

### 8.4 Action Buttons
- Primary CTAs (Add Transaction, Consolidate Surplus): Solid Emerald background with white text for high contrast.

---

## 9. Business Logic

### 9.1 Waterfall Surplus Model
```
Income - Expenses = Surplus
Surplus --> Distributed to Goals (proportional allocation)
```

### 9.2 Billing Cycle Logic
- Billing cycles run from the 25th of one month to the 24th of the next.
- All trend data and monthly summaries align to billing cycles.
- CC due dates are clamped to actual month length (e.g., due day 31 in February becomes 28/29).

### 9.3 Net Liquidity Calculation
```
Net Liquidity = Total Bank Balances - Total CC Outstanding
```

### 9.4 Burn Rate
```
Burn Rate % = (Actual Living Expenses / Planned Living Expenses) * 100
```

### 9.5 Liquidity Health Check
- **Healthy ("Liquid")**: Bank balance >= Monthly expenses.
- **Warning ("Low Cash")**: Bank balance < Monthly expenses.

### 9.6 Goal Intelligence
- **Savings Velocity**: Average monthly contribution based on current amount and months elapsed.
- **Projected Finish Date**: Extrapolation based on current velocity.
- **Status Classification**: On Track, At Risk, Behind, Not Started, Achieved.

### 9.7 CC Due Date Urgency
- **Urgent** (Red): 7 days or less until due.
- **Warning** (Amber): 7-14 days until due.
- **OK** (Green): 14+ days until due.

### 9.8 Account Reconciliation
When reconciling, the system:
1. Calculates the difference between tracked and actual balance.
2. Creates an "Adjustment" transaction for the delta.
3. Updates the account balance to match the actual value.

### 9.9 Transfer Handling
Transfers between accounts:
1. Deduct from source account.
2. Credit to destination account.
3. Create a single "Transfer" type transaction linking both accounts.

---

## 10. Currency & Localization

- **Currency**: Indian Rupee (INR, symbol: Rs.)
- **Number Format**: en-IN locale (e.g., 1,00,000.00)
- **Date Format**: en-US (e.g., "Mar 31, 2026")
- **Formatting Function**: `formatCurrency()` using `Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" })`

---

## 11. Non-Functional Requirements

### 11.1 Performance
- React Query caching with automatic query invalidation on mutations.
- Lightweight client-side routing (Wouter, ~1.5KB).
- Efficient SQL queries via Drizzle ORM with proper indexing.

### 11.2 Security
- Server-side validation on all inputs (billing due day 1-31, amount formats, required fields).
- Account deletion prevented when linked transactions exist.
- No authentication currently implemented (single-user app).

### 11.3 Accessibility
- Semantic HTML structure.
- ARIA labels on interactive elements.
- Minimum 44px touch targets on mobile.
- High contrast action buttons.

### 11.4 Deployment
- Frontend: Vite dev server (development), static build (production).
- Backend: Express server reading PORT from environment variable.
- Database: PostgreSQL via DATABASE_URL environment variable.
- Hosting: Replit with automatic TLS and domain management.
