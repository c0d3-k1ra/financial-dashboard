# Overview

SurplusEngine is a personal finance web application designed to track bank balances, manage daily transactions, and automate financial goal achievement through a "waterfall surplus" logic. The primary goals are to facilitate emergency fund building and loan prepayment. Built as a pnpm workspace monorepo using TypeScript, it aims to provide a comprehensive, intuitive, and AI-powered financial management experience.

The project seeks to empower users with better control over their finances, offering a clear overview of their financial health, detailed transaction insights, and proactive guidance towards their savings and debt reduction goals. Its market potential lies in offering a sophisticated yet user-friendly tool for individuals seeking to optimize their personal financial strategies.

# User Preferences

I prefer iterative development, with a focus on delivering working features incrementally. Please ask before making any major architectural changes or introducing new dependencies. I prefer clear, concise explanations and well-documented code. Ensure all changes are thoroughly tested.

# System Architecture

SurplusEngine is structured as a pnpm workspace monorepo.

**Technology Stack:**
*   **Monorepo Tool:** pnpm workspaces
*   **Backend:** Node.js 24, Express 5, PostgreSQL, Drizzle ORM, Zod for validation
*   **Frontend:** React, Vite, Tailwind CSS, shadcn/ui, Recharts
*   **Build Tools:** esbuild (API server), Vite (frontend)
*   **API Generation:** Orval from OpenAPI spec
*   **Testing:** Vitest, Supertest

**Monorepo Structure:**
*   `artifacts/`: Contains deployable applications (`api-server`, `finance-app`).
*   `lib/`: Houses shared libraries (`api-spec`, `api-client-react`, `api-zod`, `db`, `integrations-anthropic-ai`).
*   `scripts/`: Utility scripts.

**Frontend (`artifacts/finance-app`):**
*   A React + Vite application providing a dark mode personal finance dashboard.
*   Features 6 tabs: Dashboard, Transactions, Budget, Goals, Accounts, Settings.
*   Uses `wouter` for routing, Recharts for data visualization, and `shadcn/ui` for components.
*   Responsive design, adapting tables to card views on mobile.
*   Supports configurable currency formatting (INR/USD/EUR/GBP) via `app_settings` table.
*   All API interactions use generated hooks from `@workspace/api-client-react`.

**Backend (`artifacts/api-server`):**
*   Express 5 server exposing RESTful APIs.
*   Routes are organized by domain (e.g., `transactions.ts`, `goals.ts`, `accounts.ts`).
*   Utilizes `@workspace/api-zod` for request and response validation.
*   Integrates with `@workspace/db` for persistence.
*   Key features include:
    *   CRUD operations for transactions, accounts, categories, and goals.
    *   Monthly configuration and budget goal management.
    *   Dashboard summaries, monthly trends, and budget analysis.
    *   Waterfall surplus distribution logic.
    *   Account reconciliation and EMI processing.
    *   AI-powered transaction parsing and intent routing.
    *   Custom billing cycle: 25th of previous month to 24th of current month.

**Database (`lib/db`):**
*   PostgreSQL database managed with Drizzle ORM.
*   Key tables: `accounts`, `categories`, `transactions`, `monthly_config`, `budget_goals`, `goals`, `surplus_allocations`, `merchant_mappings`.
*   Includes a seed script for initial data population.

**API Specification and Generation:**
*   `lib/api-spec` contains the OpenAPI 3.1 specification (`openapi.yaml`) and Orval configuration for code generation.
*   `lib/api-zod` generates Zod schemas from the OpenAPI spec for validation.
*   `lib/api-client-react` generates React Query hooks and a fetch client for frontend API consumption.

**Waterfall Surplus Logic:**
1.  Calculates total mandatory expenses and savings.
2.  Determines monthly surplus (Income - Expenses & Savings).
3.  Allocates surplus to an Emergency Fund upon user action.
4.  Maintains a rolling balance where the end balance of one month becomes the starting balance of the next.

**UI/UX and Theming (iOS-Style Glass System):**
*   **Design Language:** Apple iOS/macOS Control Center aesthetic with layered frosted glass on a dark mesh gradient.
*   **Glass Tiers:** Defined in `index.css` with varying `rgba` backgrounds, `backdrop-filter` blur, and saturation for `.glass-1` (primary cards), `.glass-2` (nested/inputs), and `.glass-3` (elevated/modals).
*   **Background:** Animated mesh gradient with ambient orbs.
*   **Navigation:** Frosted glass navigation bar with active tab highlighting.
*   **Typography:** Inter for headings, JetBrains Mono for monetary values.
*   **Charts:** Monotone curves with linear gradient fills, glass-3 tooltips, and subtle gridlines.
*   **Accessibility:** Fallback for `backdrop-filter` and `prefers-reduced-motion` support.
*   **Mobile:** Minimum 44px touch targets, bottom-sheet drawer for transaction input.

**AI Transaction Assistant:**
*   A floating action button (FAB) activates a multi-turn chat panel for natural language transaction input.
*   **Smart Slot-Filling:** Extracts fields from natural language, applies defaults, and only prompts for missing information.
*   **Confirmation Cards:** Displays parsed transaction summaries with inline-editable fields.
*   **Persistence:** Chat state persists across sessions via localStorage.
*   **Merchant Mappings:** `merchant_mappings` table stores keyword-to-category/account mappings, used for auto-filling and learning.
*   **Anomaly Detection:** Flags transactions exceeding 3x average category/merchant spend.
*   **Budget Awareness:** Warns if a transaction pushes spending over budget.
*   **Duplicate Detection:** Identifies and warns about near-duplicate transactions.
*   **Recurring Pattern Detection:** Automatically identifies and pre-fills recurring transactions.

# External Dependencies

*   **Database:** PostgreSQL
*   **ORM:** Drizzle ORM
*   **API Framework:** Express 5
*   **Frontend Framework:** React
*   **UI Component Library:** shadcn/ui
*   **Charting Library:** Recharts
*   **Validation:** Zod
*   **API Codegen:** Orval
*   **AI Integration:** Anthropic Claude (via `integrations-anthropic-ai` library)
*   **Package Manager:** pnpm