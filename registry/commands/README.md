# Commands

A command is a **parameterized daily workflow** — the inner loop written down. Boris Cherny's
rule: anything you do more than once a day becomes a slash command. Skills carry knowledge;
commands carry *procedures* you invoke on purpose.

## Format
One markdown file per command: YAML frontmatter (`name`, `description`, optional `args`), then
numbered steps the agent executes. The description is what shows in the harness's command list —
keep it one tight sentence.

## Where they emit
| Harness | Location |
|---|---|
| Claude Code | `.claude/commands/<name>.md` (invoked as `/<name>`) |
| Copilot | `.github/prompts/<name>.prompt.md` |
| Codex | `.codex/prompts/<name>.md` |
| Cursor / Antigravity | `.aesop/prompts/<name>.md` (portable fallback — paste on demand) |

## In this folder
- `commit-pr` — commit verified work, push, open a PR; the most-used inner-loop command.
- `fix-ci` — diagnose and fix the failing CI run end to end; root cause, no band-aids.
- `add-learning` — record a correction as a durable lesson (mistake → rule).
- `techdebt` — sweep the area you just touched for small, safe cleanups; never speculative.

Add your own with `aesop add command <name> --from <registry>`, or drop a file here following
the same shape. Goal recipes also emit as commands (`goal-<name>`) — see `../loops/`.
