# Goal loops (`/goal`)

A `/goal` loop is **ralph, productized**: you set a measurable stopping condition and a small,
fast validator model checks after each turn whether it's met. If not, the agent keeps going; if so,
it halts and reports. Without it, *you* are the loop, pressing enter over and over.

## Who has it (mid-2026)
| Harness | Native `/goal`? | How |
|---|---|---|
| **Codex CLI** | ✅ shipped first (late April) | persisted goal workflows; create/pause/resume/clear |
| **Claude Code** | ✅ (mid-May) | a Haiku evaluator checks after each turn; also `/loop`, Routines |
| **Cursor** | ❌ | agent mode (in-IDE, diff previews); use `../ralph/` |
| **Copilot / VS Code** | ❌ | agentic but user-built loop; use `../ralph/` |
| **Antigravity** | ~ | Manager surface + scheduled tasks; bound with `GUARDRAILS.md` |

So: **native `/goal` where you have it, the portable Ralph loop where you don't.**

## Files
- `stopping-conditions.md` — how to write a stopping condition that actually halts, with examples
  per pathway. (Codex-specific `/goal` recipes are in `adapters/codex/goal-workflows.md`.)

## The rule that makes it safe
A `/goal` is only as good as its success criterion, and an autonomous loop is a loop making mistakes
autonomously — so **always keep the three hard stops on** (iteration ceiling, no-progress detector,
dollar ceiling) and run goal loops in a worktree.
