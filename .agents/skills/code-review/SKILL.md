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

**1. Get git SHAs:**

```bash
BASE_SHA=$(git rev-parse HEAD~1)  # or origin/main
HEAD_SHA=$(git rev-parse HEAD)
```

**2. Dispatch code-reviewer subagent:**

Use Task tool with `code-reviewer` type, filling these placeholders:

- `{WHAT_WAS_IMPLEMENTED}` - What you just built
- `{PLAN_OR_REQUIREMENTS}` - What it should do
- `{BASE_SHA}` - Starting commit
- `{HEAD_SHA}` - Ending commit
- `{DESCRIPTION}` - Brief summary

**3. Act on feedback:**

- Fix Critical issues immediately
- Fix Important issues before proceeding
- Note Minor issues for later
- Push back if reviewer is wrong (with reasoning)

### Example

```
[Just completed Task 2: Add verification function]

You: Let me request code review before proceeding.

BASE_SHA=$(git log --oneline | grep "Task 1" | head -1 | awk '{print $1}')
HEAD_SHA=$(git rev-parse HEAD)

[Dispatch code-reviewer subagent]
  WHAT_WAS_IMPLEMENTED: Verification and repair functions for conversation index
  PLAN_OR_REQUIREMENTS: Task 2 from docs/plans/deployment-plan.md
  BASE_SHA: a7981ec
  HEAD_SHA: 3df7661
  DESCRIPTION: Added verifyIndex() and repairIndex() with 4 issue types

[Subagent returns]:
  Strengths: Clean architecture, real tests
  Issues:
    Important: Missing progress indicators
    Minor: Magic number (100) for reporting interval
  Assessment: Ready to proceed

You: [Fix progress indicators]
[Continue to Task 3]
```

### Integration with Workflows

**Subagent-Driven Development:**

- Review after EACH task
- Catch issues before they compound
- Fix before moving to next task

**Executing Plans:**

- Review after each batch (~3 tasks)
- Get feedback, apply, continue

**Ad-Hoc Development:**

- Review before merge
- Review when stuck

### Red Flags

**Never:**

- Skip review because "it's simple"
- Ignore Critical issues
- Proceed with unfixed Important issues
- Argue with valid technical feedback

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

### Verification Commands (Vite + TypeScript + React on Replit)

```bash
# Type check
npx tsc --noEmit

# Lint
npm run lint

# Build
npm run build

# Dev server (confirm it starts without errors)
npm run dev

# Tests (if configured)
npm test
# or if using Vitest:
npx vitest run
```

> **Replit note:** Prefer `npm` over `bun` unless the project explicitly uses bun. Always read the full terminal output — Replit's shell may suppress exit codes visually but errors will appear in the log.

### Common Failures

| Claim                       | Requires                                | Not Sufficient                 |
|-----------------------------|----------------------------------------|--------------------------------|
| Types correct               | `tsc --noEmit` output: 0 errors        | "Looks typed correctly"        |
| Linter clean                | Lint output: 0 errors/warnings         | Partial check, extrapolation   |
| Build succeeds              | `npm run build` exit 0, dist produced  | Linter passing, logs look good |
| Bug fixed                   | Test/reproduce original symptom: passes| Code changed, assumed fixed    |
| Regression test works       | Red-green cycle verified               | Test passes once               |
| Agent completed             | VCS diff shows changes                 | Agent reports "success"        |
| Requirements met            | Line-by-line checklist                 | Tests passing                  |
| Component renders correctly | Manual check or test output            | "Should render fine"           |

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

**Type check:**

```
✅ [Run tsc --noEmit] [See: no output / exit 0] "No type errors"
❌ "The types look right"
```

**Build:**

```
✅ [Run npm run build] [See: dist/ produced, exit 0] "Build passes"
❌ "Linter passed so build should be fine"
```

**Regression tests (TDD Red-Green):**

```
✅ Write test → Run (pass) → Revert fix → Run (MUST FAIL) → Restore → Run (pass)
❌ "I've written a regression test" (without red-green verification)
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
1. **Systematic review processes** — Use code-reviewer subagent
1. **Evidence before claims** — Verification gates always

Verify. Question. Then implement. Evidence. Then claim.
