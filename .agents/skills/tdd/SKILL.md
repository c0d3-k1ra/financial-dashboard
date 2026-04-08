---
name: tdd
description: Enforce strict Test-Driven Development (Red-Green-Refactor) when building new features. Use whenever writing new feature code, adding new endpoints, new components, new pages, new hooks, or new utility functions. Do not write production code before writing a failing test.
---

# Test-Driven Development (TDD)

Strict Red-Green-Refactor workflow for all new feature development in this project. This skill is mandatory whenever implementing new functionality — no production code without a failing test first.

## Core Rule

**Do not write any production code before writing a failing test.**

Every new behavior starts as a test. If you catch yourself writing feature code first, stop, delete it, and write the test.

## When to Use

Activate this skill whenever:

- Adding a new API endpoint or route
- Adding a new React page or component
- Adding a new hook or utility function
- Adding new business logic to existing code
- Fixing a bug (write a test that reproduces the bug first)
- Adding a new database query or mutation

## When NOT to Use

- Pure configuration changes (ESLint, Vite config, tsconfig)
- Dependency upgrades
- CSS/styling-only changes with no logic
- Renaming or moving files
- Updating documentation

## The Red-Green-Refactor Cycle

### Phase 1: RED — Write a Failing Test

1. Create the test file first (or add to existing test file)
2. Write a test for the specific behavior you want to implement
3. Run the test — it MUST fail
4. If it passes, the test is wrong (testing existing behavior, not new behavior)

**Evidence required:** Show the test failure output before proceeding.

### Phase 2: GREEN — Write Minimum Code to Pass

1. Write ONLY the code needed to make the failing test pass
2. No extra features, no "while I'm here" additions
3. Run the test — it MUST pass now
4. Run all existing tests — no regressions

**Evidence required:** Show the test passing and full suite still green.

### Phase 3: REFACTOR — Clean Up

1. Improve code structure, readability, naming
2. Remove duplication
3. Run all tests again — they MUST still pass
4. If no refactoring needed, skip this phase

**Evidence required:** Show all tests passing after refactoring.

## Workflow Per Feature

Break every feature into small, atomic behaviors. Each behavior gets its own Red-Green-Refactor cycle.

```
Feature: "Add monthly income endpoint"

Cycle 1: GET /api/monthly-config returns empty when no config exists
  RED:   Write test expecting 200 with empty/default response → fails (404)
  GREEN: Add route handler returning default response → passes
  REFACTOR: Extract response shape to type → passes

Cycle 2: POST /api/monthly-config creates a new config
  RED:   Write test posting valid data, expecting 201 → fails (404)
  GREEN: Add POST handler with DB insert → passes
  REFACTOR: none needed

Cycle 3: POST /api/monthly-config rejects invalid data
  RED:   Write test posting bad data, expecting 400 → fails (gets 201)
  GREEN: Add Zod validation → passes
  REFACTOR: none needed
```

## Project-Specific Patterns

### Backend Tests (api-server)

- Test files go in `artifacts/api-server/src/__tests__/`
- Use `supertest` for HTTP integration tests against the real Express app
- Tests run against a real test PostgreSQL database (truncated between tests)
- Import the app from `../app` and wrap with supertest

```typescript
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app";

describe("GET /api/new-endpoint", () => {
  it("returns 200 with expected shape", async () => {
    const res = await request(app).get("/api/new-endpoint");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
  });
});
```

### Frontend Tests (finance-app)

- Test files co-locate with source: `component.test.tsx` next to `component.tsx`
- Use React Testing Library + MSW for API mocking
- Wrap components in `TestWrapper` for providers (QueryClient, Theme, Settings)
- Add MSW handlers for any new API endpoints the component calls

```typescript
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw-server";
import { TestWrapper } from "@/test/test-wrapper";
import { NewComponent } from "./new-component";

describe("NewComponent", () => {
  it("renders data from API", async () => {
    server.use(
      http.get("*/api/new-endpoint", () =>
        HttpResponse.json({ data: [{ id: 1, name: "Test" }] })
      )
    );
    render(<NewComponent />, { wrapper: TestWrapper });
    await waitFor(() => {
      expect(screen.getByText("Test")).toBeInTheDocument();
    });
  });
});
```

## Verification Commands

```bash
# Backend tests
pnpm --filter @workspace/api-server test

# Frontend tests
pnpm --filter @workspace/finance-app test

# Coverage (both)
pnpm --filter @workspace/api-server test:coverage
pnpm --filter @workspace/finance-app test:coverage
```

## Anti-Patterns — STOP If You Catch Yourself

| Anti-Pattern | What to Do Instead |
|---|---|
| Writing feature code first | Stop. Delete it. Write the test. |
| Writing test and code in the same step | Write test, run it, see it fail, THEN write code |
| Writing a test that passes immediately | The test is wrong — it tests existing behavior |
| Writing too much code to pass the test | Only the minimum. One behavior per cycle. |
| Skipping the run step | You MUST run and show output at each phase |
| "I'll add tests after" | No. Test first or not at all. |
| Testing implementation details | Test behavior (inputs/outputs), not internals |
| Large tests covering multiple behaviors | One assertion focus per test, split into multiple cycles |

## Bug Fix TDD

For bug fixes, the cycle is slightly different:

1. **RED:** Write a test that reproduces the exact bug (it should fail because the bug exists)
2. **GREEN:** Fix the bug — the test now passes
3. **VERIFY:** Intentionally revert the fix, confirm the test fails again (proves the test actually catches the bug)
4. **RESTORE:** Re-apply the fix, confirm green

## Commit Discipline

Each Red-Green-Refactor cycle should be a logical unit. When committing:

- The commit should contain both the test and the implementation
- The commit message should describe the behavior added, not "added tests"
- Example: `Add monthly config CRUD endpoint` (not `Add tests for monthly config`)

## Integration with Code Review

The code-review skill's verification gates apply on top of TDD:

- After all TDD cycles for a feature are complete, run full lint + test + coverage
- Request architect review with `includeGitDiff: true`
- Fix any Critical/Important findings before marking complete
