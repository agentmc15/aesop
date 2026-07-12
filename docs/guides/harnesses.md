# Per-harness notes

What each harness gets from `aesop compile`, what's native vs fallback, and the tips that matter.
The authoritative cell-by-cell table is the [harness matrix](../03-harness-matrix.md) — it's
tested against the emitters, so it cannot silently lie.

Universal across all six: `AGENTS.md` (the portable standard, full render), `tasks/` (durable
memory), `.aesop/goals/` (recipes + runner configs), `.aesop/orchestration.md`.

---

## Claude Code

The fullest-featured target — everything is native.

| You get | Where |
|---|---|
| instructions | `CLAUDE.md` → `@AGENTS.md` import (one visible source of truth) |
| subagents | `.claude/agents/*.md` (tools + model mapped: strong→opus, mid→sonnet, cheap→haiku) |
| commands | `.claude/commands/` → `/commit-pr`, `/fix-ci`, `/goal-<name>`, … |
| skills | `.claude/skills/<name>/SKILL.md` |
| permissions + hooks | `.claude/settings.json` (allow/ask rules; Pre/PostToolUse) |
| MCP | `.mcp.json` |
| loops | native `/goal` (paste from `aesop goal show`) + `/goal-<name>` command + Routines for schedules |

Tips: plan mode first (the instructions say so, but `Shift+Tab ×2` is the habit); `/permissions`
shows the compiled allowlist live; the emitted settings never include YOLO mode — that stays a
conscious, containerized choice.

## Codex CLI

Native almost everywhere; reads `AGENTS.md` directly (no wrapper file needed).

| You get | Where |
|---|---|
| instructions | `AGENTS.md` (native) |
| subagents | `.codex/agents/*.toml` (`read_only` derived from the role; model tier as comment — map to your configured model) |
| commands | `.codex/prompts/` |
| skills | `.codex/skills/` |
| config | `.codex/config.toml` (approval policy, sandbox mode, MCP servers) |
| loops | native `/goal` (first harness to ship it) — paste from `aesop goal show` |

Fallback: no native hook events — the dangerous-command guard is instruction-level here until
the pre-commit wrapper lands.

## GitHub Copilot (CLI + VS Code agent mode)

The one harness with **native path-scoped instructions** — Aesop exploits it.

| You get | Where |
|---|---|
| instructions | `.github/copilot-instructions.md` (path blocks deliberately excluded…) |
| path-scoped rules | …because they land natively in `.github/instructions/<slug>.instructions.md` with `applyTo` |
| commands | `.github/prompts/<name>.prompt.md` |
| agents | `.github/agents/*.agent.md` |
| skills | `.github/skills/` |
| MCP | `.vscode/mcp.json` |

Fallbacks: permissions are org/user Copilot policy (not a repo file); no first-party `/goal` —
use `aesop goal run`. Hook format isn't pinned in the matrix yet.

## Cursor

Cursor reads `AGENTS.md` natively, so Aesop keeps `.cursor/rules` lean instead of duplicating
doctrine into every session's context:

| You get | Where |
|---|---|
| always-on pointer | `.cursor/rules/00-aesop.mdc` (verify loop + where the truth lives; `alwaysApply: true`) |
| path-scoped rules | `.cursor/rules/scoped-<slug>.mdc` with `globs` |
| skills | `.cursor/rules/skill-<name>.mdc` — the SKILL description becomes the rule trigger |
| MCP | `.cursor/mcp.json` |

Fallbacks: no first-class subagents → open a second tab and paste `.aesop/roles/<name>.md`
(maker in one tab, checker in the other); commands → `.aesop/prompts/`; loops →
`aesop goal run`.

## Antigravity

Reads `AGENTS.md` natively and it **wins precedence over `GEMINI.md`** — so Aesop emits no
redundant `GEMINI.md` at all. The distinctive artifact:

| You get | Where |
|---|---|
| instructions | `AGENTS.md` (native) |
| guardrails | `GUARDRAILS.md` — generated: safety non-negotiables, your permission tiers, your invariants, the three hard stops |
| skills | `.agents/skills/<name>/SKILL.md` (native — pinned July 2026; legacy `.agent/skills/` is still read) |
| loops | Manager surface + scheduled tasks (point them at the recipe text); `aesop goal run` works too |

Fallbacks: roles via `.aesop/roles/` (run them from the Manager surface); MCP lives in app
settings, not a repo file.

## VS Code (Copilot in the workspace)

A wiring layer: enable the `copilot` harness alongside it for the content.

| You get | Where |
|---|---|
| settings | `.vscode/settings.json` — turns on `useInstructionFiles` + `chat.promptFiles` |
| tasks | `.vscode/tasks.json` — `aesop: test` (default test task), `aesop: build`, `aesop: lint` — the verify loop one keypress away |
| MCP | `.vscode/mcp.json` |

---

## Mixing harnesses

List several and the truth stays single: one manifest, one `AGENTS.md`, each harness reading
its own dialect of the same rules.

```yaml
harnesses: [claude-code, codex, copilot, cursor]
```

If two harnesses would ever emit different content to the same path, compile fails loudly
(collision guard) rather than letting one win silently. Run `aesop compile --verbose` once after
adding a harness — it prints every fallback that harness incurs, so you know exactly what
degraded and what to do about it.
