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
*   PWA-enabled via `vite-plugin-pwa` with standalone display mode, service worker caching, and iOS meta tags for home screen app experience.
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

**UI/UX and Theming (Dual-Theme Glass System):**
*   **Design Language:** Dual-theme system with distinct light and dark aesthetics.
*   **Light Theme:** Apple visionOS-inspired matte frosted glass — milky, diffused frost panels with no shine/gloss/reflections. Soft color wash overlays (blue, lavender, mint, peach) bleed through with 180px blur. Cards use `box-shadow: none`, flat matte inputs, 10% opacity badges, and density-based separation via borders only.
*   **Dark Theme:** iOS/macOS Control Center aesthetic with layered frosted glass on a dark mesh gradient, retaining shadow-lg depth and inset highlights.
*   **Glass Tiers:** Defined in `index.css` with varying `rgba` backgrounds, `backdrop-filter` blur, and saturation for `.glass-1` (primary cards), `.glass-2` (nested/inputs), and `.glass-3` (elevated/modals). Light theme overrides remove all shadows and top-edge highlights.
*   **Background:** Light: warm multi-tone radial gradient with 4 fixed frost wash pseudo-elements. Dark: animated mesh gradient with ambient orbs.
*   **Navigation:** Frosted glass navigation bar with active tab highlighting.
*   **Typography:** Inter for headings, JetBrains Mono for monetary values.
*   **Charts:** Monotone curves with linear gradient fills, matte tooltips (light) / glass-3 tooltips (dark), and subtle gridlines.
*   **Accessibility:** Fallback for `backdrop-filter` and `prefers-reduced-motion` support.
*   **Privacy Shield:** Global eye toggle in header hides/reveals all sensitive monetary values app-wide using frosted glass blur (`filter: blur(10px)`). State persisted in localStorage (key: `surplusengine-privacy-shield`), defaults to hidden on load. Implemented via `PrivacyProvider` context wrapping the app, `SensitiveValue` wrapper component (supports `as="span"|"div"`), and `PrivacyToggle` button. Applied across Dashboard, Transactions, Budget, Goals, and Accounts pages. Respects `prefers-reduced-motion`.
    *   **Mobile-First Experience:**
    *   Fixed bottom tab bar (5 tabs: Dashboard, Transactions, Budget, Goals, Accounts) with glass styling and safe-area padding. Settings gear moved to header on mobile.
    *   AI Assistant renders as full-screen bottom sheet (~95dvh) with swipe-down-to-dismiss on mobile; floating panel on desktop.
    *   Transaction filters collapse behind a single "Filters" button on mobile with active filter count badge; full filter bar on desktop.
    *   All dialogs (Transfer, Add/Edit Account, Reconcile, Delete Account, Create/Edit Goal, Distribute Surplus, Undo Distribution) render as bottom sheets on mobile, centered dialogs on desktop. Uses `useIsMobile()` hook + conditional Sheet/Dialog rendering.
    *   Minimum 44px touch targets on all mobile action buttons (account card icons, goal card icons, Sheet/Dialog close buttons).
    *   Goals page projection chart collapsed by default on mobile with expandable toggle.
    *   `ResponsiveModal` helper in accounts.tsx, `GoalFormModal` helper in goals.tsx, `DashboardModal` helper in dashboard.tsx for Sheet/Dialog switching.
    *   `surplus-distribute-modal.tsx` uses neutral HTML elements instead of Dialog-context primitives for portability across Sheet and Dialog wrappers.

**AI Transaction Assistant:**
*   A floating action button (FAB) activates a multi-turn chat panel for natural language transaction input.
*   **Smart Slot-Filling:** Extracts fields from natural language, applies defaults, and only prompts for missing information.
*   **Rich Empty State:** Time-of-day greeting ("Good morning/afternoon/evening") with 6 tappable quick-action chips (Log expense, Record salary, Transfer money, Today's spending, Check balances, Monthly summary). Mobile: full-width stacked cards; Desktop: 2-column grid.
*   **Animated Typing Indicator:** 3-dot bouncing animation in AI bubble replaces "Thinking..." spinner. Header shimmer on mobile during processing.
*   **Premium Confirmation Cards:** Large amount display with INR formatting, colored type pill (Expense/Income/Transfer) with icon, category chip with icon, account line with type icon. "Log It" button full-width 48px on mobile; Edit as pencil icon button in top-right corner. Warning cards have colored left borders (orange/red/yellow).
*   **Redesigned Edit Mode:** Proper Radix Select components, DatePicker, 44px+ touch inputs, ₹ prefix on amount, category selector as scrollable icon+label chip grid, account selector as tappable cards, type selector as chips.
*   **Enhanced Success State:** Transaction summary (amount, category, account), animated SVG checkmark, visual undo countdown bar synced to actual expiry, "Log another" chip.
*   **Conversation UX:** Clear conversation button (trash icon, double-tap confirm), relative timestamps ("Just now", "2m ago"), slide-up message entrance animations.
*   **Voice Input UX:** Mic button promoted to standalone 48px button next to Send (not inside input), pulsing recording indicator bar above input.
*   **Mobile Input Refinements:** 48px input/send/mic heights, 16px font (prevents iOS zoom), safe area padding.
*   **Persistence:** Chat state persists across sessions via localStorage with schema migration for backward compatibility.
*   **Merchant Mappings:** `merchant_mappings` table stores keyword-to-category/account mappings, used for auto-filling and learning.
*   **Anomaly Detection:** Flags transactions exceeding 3x average category/merchant spend.
*   **Budget Awareness:** Warns if a transaction pushes spending over budget.
*   **Duplicate Detection:** Identifies and warns about near-duplicate transactions.
*   **Recurring Pattern Detection:** Automatically identifies and pre-fills recurring transactions.
*   **Query Capabilities (Financial Copilot):** Detects question-style messages (spending queries, balance checks, debt summaries, category breakdowns, recent transactions, top expenses, monthly summaries) and routes them directly to database queries instead of the AI model. Returns structured `query_result` responses with styled cards showing titles, item lists, totals, and summaries. Supports period-aware queries (today, this week, this month, last month) using the billing cycle configuration.

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