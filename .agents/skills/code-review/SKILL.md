---
name: code-review
description: Code review practices with technical rigor and verification gates. Use for receiving feedback, requesting code-reviewer subagent reviews, or preventing false completion claims in pull requests.
---

# Code Review

Guide proper code review practices emphasizing technical rigor, evidence-based claims, and verification over performative responses.

## Overview

Code review requires three distinct practices:

1. **Receiving feedback** - Technical evaluation over performative agreement
1. **Requesting reviews** - Systematic review via code-reviewer subagent
1. **Verification gates** - Evidence before any completion claims

## Core Principle

**Technical correctness over social comfort.** Verify before implementing. Ask before assuming. Evidence before claims.

## When to Use This Skill

### Receiving Feedback

Trigger when:

- Receiving code review comments from any source
- Feedback seems unclear or technically questionable
- Multiple review items need prioritization
- External reviewer lacks full context
- Suggestion conflicts with existing decisions

### Requesting Review

Trigger when:

- Completing tasks in subagent-driven development (after EACH task)
- Finishing major features or refactors
- Before merging to main branch
- Stuck and need fresh perspective
- After fixing complex bugs

### Verification Gates

Trigger when:

- About to claim tests pass, build succeeds, or work is complete
- Before committing, pushing, or creating PRs
- Moving to next task
- Any statement suggesting success/completion
- Expressing satisfaction with work

## Quick Decision Tree

```
SITUATION?
│
├─ Received feedback
│  ├─ Unclear items? → STOP, ask for clarification first
│  ├─ From human partner? → Understand, then implement
│  └─ From external reviewer? → Verify technically before implementing
│
├─ Completed work
│  ├─ Major feature/task? → Request code-reviewer subagent review
│  └─ Before merge? → Request code-reviewer subagent review
│
└─ About to claim status
   ├─ Have fresh verification? → State claim WITH evidence
   └─ No fresh verification? → RUN verification command first
```

---

## Part 1: Receiving Feedback

### The Response Pattern

```
WHEN receiving code review feedback:

1. READ: Complete feedback without reacting
2. UNDERSTAND: Restate requirement in own words (or ask)
3. VERIFY: Check against codebase reality
4. EVALUATE: Technically sound for THIS codebase?
5. RESPOND: Technical acknowledgment or reasoned pushback
6. IMPLEMENT: One item at a time, test each
```

### Forbidden Responses

**NEVER:**

- "You're absolutely right!" (explicit CLAUDE.md violation)
- "Great point!" / "Excellent feedback!" (performative)
- "Let me implement that now" (before verification)

**INSTEAD:**

- Restate the technical requirement
- Ask clarifying questions
- Push back with technical reasoning if wrong
- Just start working (actions > words)

### Handling Unclear Feedback

```
IF any item is unclear:
  STOP - do not implement anything yet
  ASK for clarification on ALL unclear items

WHY: Items may be related. Partial understanding = wrong implementation.
```

**Example:**

```
Partner: "Fix 1-6"
You understand 1,2,3,6. Unclear on 4,5.

❌ WRONG: Implement 1,2,3,6 now, ask about 4,5 later
✅ RIGHT: "I understand items 1,2,3,6. Need clarification on 4 and 5 before proceeding."
```

### Source-Specific Handling

**From Human Partner:**

- Trusted - implement after understanding
- Still ask if scope unclear
- No performative agreement
- Skip to action or technical acknowledgment

**From External Reviewers:**

```
BEFORE implementing:
  1. Check: Technically correct for THIS codebase?
  2. Check: Breaks existing functionality?
  3. Check: Reason for current implementation?
  4. Check: Works across target browsers/environments?
  5. Check: Does reviewer understand full context?

IF suggestion seems wrong:
  Push back with technical reasoning

IF can't easily verify:
  Say so: "I can't verify this without [X]. Should I [investigate/ask/proceed]?"

IF conflicts with partner's prior decisions:
  Stop and discuss with partner first
```

### YAGNI Check for "Professional" Features

```
IF reviewer suggests "implementing properly":
  grep codebase for actual usage

  IF unused: "This isn't called anywhere. Remove it (YAGNI)?"
  IF used: Then implement properly
```

### Implementation Order

```
FOR multi-item feedback:
  1. Clarify anything unclear FIRST
  2. Then implement in this order:
     - Blocking issues (breaks, security)
     - Simple fixes (typos, imports)
     - Complex fixes (refactoring, logic)
  3. Test each fix individually
  4. Verify no regressions
```

### When to Push Back

Push back when:

- Suggestion breaks existing functionality
- Reviewer lacks full context
- Violates YAGNI (unused feature)
- Technically incorrect for this stack (Vite/TS/React)
- Conflicts with partner's architectural decisions

**How to push back:**

- Use technical reasoning, not defensiveness
- Ask specific questions
- Reference working tests/code
- Involve partner if architectural

### Acknowledging Correct Feedback

When feedback IS correct:

```
✅ "Fixed. [Brief description of what changed]"
✅ "Good catch - [specific issue]. Fixed in [location]."
✅ [Just fix it and show in the code]

❌ "You're absolutely right!"
❌ "Great point!"
❌ "Thanks for catching that!" / "Thanks for [anything]"
❌ ANY gratitude expression
```

**Why no thanks:** Actions speak. Just fix it. The code itself shows you heard the feedback.

### Gracefully Correcting Your Pushback

If you pushed back and were wrong:

```
✅ "You were right - I checked [X] and it does [Y]. Implementing now."
✅ "Verified this and you're correct. My initial understanding was wrong because [reason]. Fixing."

❌ Long apology
❌ Defending why you pushed back
❌ Over-explaining
```

State the correction factually and move on.

### Common Mistakes

| Mistake                      | Fix                                 |
|------------------------------|-------------------------------------|
| Performative agreement       | State requirement or just act       |
| Blind implementation         | Verify against codebase first       |
| Batch without testing        | One at a time, test each            |
| Assuming reviewer is right   | Check if it breaks things           |
| Avoiding pushback            | Technical correctness > comfort     |
| Partial implementation       | Clarify all items first             |
| Can't verify, proceed anyway | State limitation, ask for direction |

---

## Part 2: Requesting Code Review

### When to Request

**Mandatory:**

- After each task in subagent-driven development
- After completing major feature
- Before merge to main

**Optional but valuable:**

- When stuck (fresh perspective)
- Before refactoring (baseline check)
- After fixing complex bug

### How to Request

Use `architect()` from the code_review skill with these parameters:

```javascript
await architect({
  task: "[WHAT_WAS_IMPLEMENTED] against [PLAN_OR_REQUIREMENTS]",
  relevantFiles: ["file1.ts", "file2.tsx"],
  includeGitDiff: true
});
```

**Required context in the task description:**

- What was built or changed
- What it should do (requirements/plan)
- Any constraints or edge cases to verify

### Acting on Review Feedback

| Severity | Action |
|----------|--------|
| Critical | Fix immediately, re-run verification |
| Important | Fix before marking complete |
| Minor | Fix if quick, otherwise note for later |
| Suggestion | Evaluate against YAGNI, implement if valuable |

**Never:**

- Skip review because "it's simple"
- Ignore Critical issues
- Proceed with unfixed Important issues
- Argue with valid technical feedback without evidence

**If reviewer is wrong:**

- Push back with technical reasoning
- Show code/tests that prove it works
- Request clarification

---

## Part 3: Verification Gates

### The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you haven't run the verification command in this message, you cannot claim it passes.

### Mandatory Pre-Completion Checklist

Before calling `mark_task_complete` or telling the user work is done, you MUST:

```
1. RUN: pnpm lint                                    → must exit 0
2. RUN: pnpm --filter @workspace/finance-app test    → must show all tests pass
3. RUN: architect() with includeGitDiff: true         → fix Critical/Important issues
4. VERIFY: App loads without errors (screenshot or curl)
5. ONLY THEN: Mark complete with evidence
```

Skipping ANY step = incomplete work.

### The Gate Function

```
BEFORE claiming any status or expressing satisfaction:

1. IDENTIFY: What command proves this claim?
2. RUN: Execute the FULL command (fresh, complete)
3. READ: Full output, check exit code, count failures
4. VERIFY: Does output confirm the claim?
   - If NO: State actual status with evidence
   - If YES: State claim WITH evidence
5. ONLY THEN: Make the claim

Skip any step = lying, not verifying
```

### Verification Commands (pnpm monorepo)

```bash
# Lint (ESLint across all source)
pnpm lint

# Tests (Vitest frontend tests)
pnpm --filter @workspace/finance-app test

# API server tests (if applicable)
pnpm --filter @workspace/api-server test

# Build check
pnpm --filter @workspace/api-server build
```

### Common Failures

| Claim                       | Requires                                | Not Sufficient                 |
|-----------------------------|----------------------------------------|--------------------------------|
| Types correct               | `tsc --noEmit` output: 0 errors        | "Looks typed correctly"        |
| Linter clean                | Lint output: 0 errors/warnings         | Partial check, extrapolation   |
| Build succeeds              | Build exit 0, dist produced            | Linter passing, logs look good |
| Bug fixed                   | Test/reproduce original symptom: passes| Code changed, assumed fixed    |
| Tests pass                  | Full test run, all green               | "Should pass"                  |
| Agent completed             | VCS diff shows changes                 | Agent reports "success"        |
| Requirements met            | Line-by-line checklist                 | Tests passing                  |
| Component renders correctly | Screenshot or test output              | "Should render fine"           |

### Red Flags — STOP

- Using "should", "probably", "seems to"
- Expressing satisfaction before verification ("Great!", "Perfect!", "Done!", etc.)
- About to commit/push/PR without verification
- Trusting agent success reports
- Relying on partial verification (e.g. lint passed → assuming build passes)
- Thinking "just this once"
- **ANY wording implying success without having run verification**

### Rationalization Prevention

| Excuse                                  | Reality                           |
|-----------------------------------------|-----------------------------------|
| "Should work now"                       | RUN the verification              |
| "I'm confident"                         | Confidence ≠ evidence             |
| "Just this once"                        | No exceptions                     |
| "Linter passed"                         | Linter ≠ compiler                 |
| "tsc passed"                            | Type safety ≠ runtime correctness |
| "Agent said success"                    | Verify independently              |
| "Replit preview looks fine"             | Preview ≠ production build        |
| "Partial check is enough"              | Partial proves nothing            |
| "Different words so rule doesn't apply" | Spirit over letter                |

### Key Patterns

**Lint:**

```
✅ [Run pnpm lint] [See: no output / exit 0] "Lint clean"
❌ "The code looks clean"
```

**Tests:**

```
✅ [Run pnpm --filter @workspace/finance-app test] [See: 41 passed] "All tests pass"
❌ "Tests should pass"
```

**Build:**

```
✅ [Run pnpm --filter @workspace/api-server build] [See: dist/ produced, exit 0] "Build passes"
❌ "Linter passed so build should be fine"
```

**Code review:**

```
✅ [Run architect()] [See: no Critical/Important issues] "Review clean"
❌ "I looked at the code and it's fine"
```

**Requirements:**

```
✅ Re-read plan → Create checklist → Verify each item → Report gaps or completion
❌ "Build passes, feature complete"
```

**Agent delegation:**

```
✅ Agent reports success → Check VCS diff → Verify changes exist → Report actual state
❌ Trust agent report at face value
```

### When to Apply

**ALWAYS before:**

- ANY variation of success/completion claims
- ANY expression of satisfaction
- ANY positive statement about work state
- Committing, PR creation, task completion
- Moving to next task
- Delegating to agents

**Rule applies to:**

- Exact phrases
- Paraphrases and synonyms
- Implications of success
- ANY communication suggesting completion/correctness

---

## Bottom Line

1. **Technical rigor over social performance** — No performative agreement
1. **Systematic review processes** — Use architect() subagent
1. **Evidence before claims** — Verification gates always
1. **Run lint + test + review before every completion** — No exceptions

Verify. Question. Then implement. Evidence. Then claim.
