# SurplusEngine

A personal finance web application that tracks bank balances, manages daily transactions, and automates financial goal achievement through a **waterfall surplus logic** model.

**Core philosophy:** every unit of income flows through a structured waterfall — Income minus Expenses equals Surplus, and Surplus is distributed into savings Goals.

## Features

### Dashboard
High-level financial cockpit with net liquidity, goal progress, monthly burn rate, credit card payment dues with urgency indicators, and a suite of charts (waterfall bar, income vs. expenses trend, CC spend trend, spend by category pie, category trend).

### Transactions
Full CRUD transaction management with filtering by billing cycle, text search, sorting, inline category creation, and responsive table/card layouts. Supports Income, Expense, and Transfer types.

### Budget
Plan monthly spending targets per category. Compare planned vs. actual spending in real time with variance indicators.

### Goals
Long-term savings goal tracking with status indicators (On Track, At Risk, Behind, Achieved), savings velocity, 12-month projection charts, and surplus distribution across active goals.

### Accounts
Manage bank accounts and credit cards. Net worth tracking, account reconciliation (auto-creates adjustment transactions), and inter-account transfers.

### Settings
Category management with icon associations. Configurable currency formatting (INR, USD, EUR, GBP) and billing cycle settings.

### AI Transaction Assistant
Natural language transaction input via a multi-turn chat panel. Features smart slot-filling, merchant mappings, anomaly detection, duplicate detection, recurring pattern recognition, and a financial copilot for spending queries.

### Privacy Shield
Global toggle to hide/reveal all sensitive monetary values with frosted glass blur, persisted across sessions.

## Tech Stack

| Layer | Technology |
|:------|:-----------|
| Frontend | React 19, Vite, TypeScript |
| UI | shadcn/ui, Tailwind CSS v4 |
| Charts | Recharts |
| Routing | Wouter |
| State & Data | TanStack React Query, Orval-generated API client |
| Backend | Express 5, TypeScript |
| Database | PostgreSQL, Drizzle ORM |
| Validation | Zod (shared via OpenAPI codegen) |
| AI | Anthropic Claude |
| Monorepo | pnpm workspaces |
| Testing | Vitest, React Testing Library, MSW, Supertest |
| Linting | ESLint 9 (flat config), Prettier |

## Prerequisites

- Node.js 24+
- pnpm 9+
- PostgreSQL database

## Setup

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Configure environment variables**

   Set the following environment variables:

   | Variable | Description |
   |:---------|:------------|
   | `DATABASE_URL` | PostgreSQL connection string |
   | `PORT` | Port for the API server (assigned automatically on Replit) |
   | `CORS_ORIGIN` | Allowed CORS origin (open in development) |

3. **Set up the database**

   Push the Drizzle schema and seed initial data:

   ```bash
   pnpm --filter @workspace/db run push
   pnpm --filter @workspace/db run seed
   ```

4. **Generate API client code**

   ```bash
   pnpm --filter @workspace/api-spec run codegen
   ```

5. **Start the dev servers**

   ```bash
   pnpm --filter @workspace/api-server run dev
   pnpm --filter @workspace/finance-app run dev
   ```

## Project Structure

```
workspace/
├── artifacts/
│   ├── api-server/          # Express API server
│   ├── finance-app/         # React + Vite frontend (PWA)
│   └── mockup-sandbox/      # Design preview server
├── lib/
│   ├── api-spec/            # OpenAPI 3.1 specification + Orval config
│   ├── api-client-react/    # Generated React Query hooks
│   ├── api-zod/             # Generated Zod validation schemas
│   ├── db/                  # Drizzle ORM schema, migrations, seed
│   └── integrations-anthropic-ai/  # Anthropic Claude integration
├── scripts/                 # Build & utility scripts
├── package.json             # Root workspace config
└── pnpm-workspace.yaml      # Workspace package definitions
```

## Testing

Run all tests:

```bash
pnpm --filter @workspace/finance-app run test
pnpm --filter @workspace/api-server run test
```

Run with coverage:

```bash
pnpm --filter @workspace/finance-app run test:coverage
pnpm --filter @workspace/api-server run test:coverage
```

## Linting

```bash
pnpm run lint
```

## Billing Cycle Configuration

SurplusEngine uses a custom billing cycle running from the **25th of the previous month to the 24th of the current month**. All monthly summaries, trend data, and budget analysis align to this cycle. Credit card due dates are clamped to the actual month length (e.g., due day 31 in February becomes 28/29).

## Currency Configuration

Currency formatting is configurable via the `app_settings` table. Supported currencies: INR (Indian Rupee), USD (US Dollar), EUR (Euro), GBP (British Pound). The default is INR with Indian number formatting (en-IN locale).

## License

MIT
