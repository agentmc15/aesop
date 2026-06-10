# Skills

A skill is the **compounding unit** of agent work: project knowledge written down once, on the
outside, so the agent reads it every run instead of re-deriving (and mis-guessing) it. *The reusable
unit inside the loop is a skill, not a prompt.*

A skill is a folder with a `SKILL.md` (YAML frontmatter: `name`, `description`; then a markdown
body) plus optional `scripts/`, `references/`, `assets/`. The format is **identical across Claude
Code, Codex, and Antigravity**; Copilot supports skills too.

## How they trigger
The agent invokes a skill explicitly (`$name`, `/skills`) or **implicitly when the task matches the
description** — so write a **tight, boring, specific** description that says both what it does and
when to use it. A vague description under-triggers; a clever one misfires.

## Where they live
| Harness | Project scope | Global scope |
|---|---|---|
| Claude Code | `.claude/skills/` | `~/.claude/skills/` |
| Codex | `.codex/skills/` (or repo `skills/`) | user-level |
| Antigravity | `.agents/skills/` | `~/.gemini/antigravity/skills/` |

## Rule of thumb
If you do something more than once a day, make it a skill (or slash command) and commit it. To share
a skill across repos or a team, **bundle it in a plugin** (see `../plugins/`).

## In this folder
- `_TEMPLATE/` — copy this to start a new skill.
- `spec-first` — write the spec before the code.
- `verify-loop` — prove it works (build/test/lint); the `self_verify()` of every loop.
- `context-compaction` — keep long sessions inside the window.
- `llm-wiki` — Karpathy's compile-sources-into-a-knowledge-base pattern.
- `agentic-rag-router` — pick the cheapest sufficient retrieval strategy.
- `safe-trace` — observability without leaking chain-of-thought or secrets.
- `lessons-loop` — capture a durable lesson on every correction (prompted Reflexion).
