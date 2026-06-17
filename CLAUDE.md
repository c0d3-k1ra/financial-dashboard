# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Install dependencies**
```bash
pnpm install
```

**Dev servers** (run in separate terminals)
```bash
pnpm --filter @workspace/api-server run dev   # Express API (builds then starts)
pnpm --filter @workspace/finance-app run dev  # Vite frontend
```

**Build / typecheck / lint**
```bash
pnpm run build        # typecheck + build all packages
pnpm run typecheck    # tsc across all packages
pnpm run lint         # ESLint across api-server, finance-app, db
```

**Tests**
```bash
pnpm --filter @workspace/finance-app run test          # frontend (jsdom + MSW)
pnpm --filter @workspace/api-server run test           # backend (mocked DB)
pnpm --filter @workspace/finance-app run test:watch    # watch mode

# Run a single test file
pnpm --filter @workspace/finance-app run test -- src/components/transactions/transaction-form.test.tsx
pnpm --filter @workspace/api-server run test -- src/routes/transactions.test.ts

# Coverage (85% thresholds enforced on both packages)
pnpm --filter @workspace/finance-app run test:coverage
pnpm --filter @workspace/api-server run test:coverage
```

**Database**
```bash
pnpm --filter @workspace/db run push       # push Drizzle schema to Postgres
pnpm --filter @workspace/db run seed       # seed initial data
```

**API codegen** — run after any change to `lib/api-spec/openapi.yaml`
```bash
pnpm --filter @workspace/api-spec run codegen
# regenerates lib/api-zod (Zod schemas) and lib/api-client-react (React Query hooks)
```

## Architecture

### Monorepo layout
```
artifacts/
  api-server/    # Express 5 backend
  finance-app/   # React 19 + Vite PWA frontend
lib/
  api-spec/      # openapi.yaml + Orval config (source of truth for the API contract)
  api-zod/       # GENERATED — Zod schemas for backend validation
  api-client-react/ # GENERATED — React Query hooks for frontend
  db/            # Drizzle ORM schema, migrations, seed
  integrations-anthropic-ai/  # Anthropic SDK wrapper
```

### API contract flow
`lib/api-spec/openapi.yaml` is the single source of truth. Orval codegen produces:
- `lib/api-zod` — Zod schemas used by the backend for request/response validation
- `lib/api-client-react` — typed React Query hooks used exclusively by the frontend

Never hand-write API types in either the backend or frontend; change `openapi.yaml` and regenerate.

### Backend (`artifacts/api-server`)
- All routes mount under `/api` via `src/routes/index.ts`
- Route files are domain-scoped (`transactions.ts`, `goals.ts`, etc.)
- AI endpoints live in `routes/ai.ts` and `routes/ai-chat.ts`; their logic is split into helper modules under `routes/helpers/` (anomaly-detection, merchant-mapping, query-handler, recurring-patterns, chat-prompt, chat-confirmation)
- Rate limiting: 20 req/min for AI endpoints, 200 req/min global (bypassed in tests via `src/test/setup.ts`)
- **Backend tests mock the entire `@workspace/db` module** (`src/test/setup.ts` replaces it with a vi.fn() chain). Tests run single-fork, non-parallel (`fileParallelism: false`).

### Frontend (`artifacts/finance-app`)
- Path alias `@` → `src/`
- Routing via `wouter`; 6 pages: Dashboard, Transactions, Budget, Goals, Accounts, Settings
- All API calls go through generated hooks from `@workspace/api-client-react` — no raw fetch calls
- Context providers (outermost to innermost): `QueryClientProvider` → `ThemeProvider` → `SettingsProvider` → `AiParseProvider`
- **Responsive dialogs**: all modals use `useIsMobile()` to switch between Radix `<Dialog>` (desktop) and Vaul `<Sheet>` (mobile bottom sheet). See `ResponsiveModal` helper in accounts, `GoalFormModal` in goals
- **Privacy shield**: wrap any sensitive monetary value in `<SensitiveValue>` (supports `as="span"|"div"`); state lives in `PrivacyProvider` context, persisted to `localStorage`
- **Frontend tests use MSW** for API mocking (`src/test/msw-server.ts`); handlers live alongside test files

### Database (`lib/db`)
- Schema files under `lib/db/src/schema/` — one file per domain, all re-exported from `index.ts`
- Drizzle push (not migrations) is used in dev: `drizzle-kit push`
- Loan amortization fields on the `accounts` table: `original_loan_amount`, `loan_start_date`, `emis_paid`

### Billing cycle
The app uses a custom billing cycle: **25th of the previous month through 24th of the current month**. All monthly summaries, budget analysis, and trend data align to this cycle. Credit card due dates are clamped to actual month length.

### AI assistant
Natural language input → `POST /api/transactions/parse-natural` (slot-filling) or `POST /api/ai/chat` (multi-turn). Query-style messages (spending questions, balance checks) are routed directly to DB queries in `routes/helpers/query-handler.ts` without hitting the LLM.

## Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | API server port |
| `CORS_ORIGIN` | Allowed origin in production (open in dev) |
