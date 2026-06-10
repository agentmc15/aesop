# Writing stopping conditions

A goal loop halts when its success criterion is **verified**. The criterion must be *checkable* by a
fast validator, not a vibe.

## Bad → good
| Vague (forces babysitting) | Checkable (loop can self-halt) |
|---|---|
| "make the API better" | "`GET /users/:id` returns 200 for a valid id and 404 for an unknown id, and the suite is green" |
| "fix the bug" | "a test reproducing issue #412 now passes and no other test regresses" |
| "clean up the code" | "no duplication flagged by the linter in the changed files; suite green" |
| "migrate to TOML" | "all callers updated, `config.json` removed from src/, `npm test` green" |

## A good criterion names
1. **The observable end-state** (status code, test result, file absent, metric threshold).
2. **A guard against regression** ("and no other test fails", "and behavior on main is unchanged").
3. **A scope** so the loop knows when it's overreaching.

## By pathway
- **accuracy-max:** add an explicit acceptance rubric and a reviewer/judge pass to the criterion —
  e.g. "...and the security-reviewer subagent approves the diff." Generous iteration budget; $ cap on.
- **balanced:** suite green + the specific behavior verified + the `verify-app` subagent passes.
- **token-lean:** the single cheapest sufficient check ("the failing test passes"); tight iteration
  ceiling and a small $ cap. Don't add a judge you don't need.

## Always
Keep the three hard stops on. State the criterion once, up front; a strong criterion is exactly what
lets the agent run without you (and what `spec-first` + `verify-loop` skills produce).
