# Harness matrix — exact files, formats, and features per harness

This is the compiler's target table. Each emitter implements one column. Verified June 2026;
each harness row carries the version/date it was last checked. **When a harness ships a new
primitive, this doc changes first, then the emitter.**

## Instruction files

| Harness | Project-level | Path-scoped | Global / user-level | Reads AGENTS.md? |
|---|---|---|---|---|
| **Claude Code** | `CLAUDE.md` (repo root; parent/child dirs also read; `@import` supported) | child-dir `CLAUDE.md` | `~/.claude/CLAUDE.md` | yes (increasingly; emit both) |
| **Codex CLI** | `AGENTS.md` (the native standard) | nested `AGENTS.md` | `~/.codex/AGENTS.md` + `~/.codex/config.toml` | native |
| **Copilot** | `.github/copilot-instructions.md` | `.github/instructions/*.instructions.md` with `applyTo:` glob frontmatter | personal instructions (web) / user profile | yes (agent mode) |
| **Cursor** | `.cursor/rules/*.mdc` (frontmatter: `description`, `globs`, `alwaysApply`) | per-rule `globs` | user rules in app settings | yes |
| **Antigravity** | `AGENTS.md` → `GEMINI.md` → defaults | `@workspace_scope` | `~/.gemini/antigravity/` | native (also reads `CLAUDE.md` on Claude models) |
| **VS Code (Copilot)** | Copilot files above | `.instructions.md` `applyTo` | profile settings | yes |

Emit policy: canonical instruction blocks render to **every** selected harness's native file, plus
`AGENTS.md` always (it's the portable standard). Keep each emitted instruction file under ~250
lines — it must survive compaction; every line earns its place.

## Skills

Converged format: a folder with `SKILL.md` (YAML frontmatter `name` + `description`, then body)
plus optional `scripts/`, `references/`, `assets/`. Progressive disclosure: frontmatter is always
in context; body loads on trigger; bundled files load on demand.

| Harness | Location | Notes |
|---|---|---|
| Claude Code | `.claude/skills/<name>/SKILL.md` | implicit trigger by description; also `/skill` |
| Codex | skills dir per config | same format |
| Copilot | `.github/skills/` (awesome-copilot category: "self-contained folders with instructions and bundled assets") | |
| Antigravity | skills supported natively | |
| Cursor / VS Code | no native skills → emit as rules (`.mdc` with `description` trigger) / instructions + prompt files | LCD fallback, flagged in matrix tests |

**The description is the API.** A tight, boring description beats a clever one — implicit
invocation matches on it.

## Subagents

| Harness | Format | Model/tool pinning |
|---|---|---|
| Claude Code | `.claude/agents/<name>.md` — YAML frontmatter: `name`, `description`, `tools`, `model` | yes |
| Codex | `.codex/agents/<name>.toml` | yes |
| Copilot | `.github/agents/<name>.md` (awesome-copilot "agents" category; MCP-integrated) | partial |
| Cursor / Antigravity / VS Code | no first-class subagents → emit role prompt files + orchestration docs | fallback |

Canonical roles in [`../registry/agents/`](../registry/agents/): explorer, implementer, critic,
researcher, code-simplifier, spec-reviewer, security-reviewer, verify-app. The load-bearing pair
is **maker vs checker** — reviewer pinned to a stronger model at higher effort.

## Commands / prompts

| Harness | Format |
|---|---|
| Claude Code | `.claude/commands/<name>.md` (slash command; `$ARGUMENTS`) |
| Copilot | `.github/prompts/<name>.prompt.md` |
| Codex | custom prompts dir |
| Cursor / others | prompt files + docs (no native slash registry) |

Seed commands: `commit-pr` (Boris's most-used), `fix-ci`, `techdebt`, `add-learning`.

## MCP

All harnesses speak MCP; only config location differs.

| Harness | Config |
|---|---|
| Claude Code | `.mcp.json` (project) / `claude mcp add` (user) |
| VS Code / Copilot | `.vscode/mcp.json` |
| Cursor | `.cursor/mcp.json` |
| Codex | `~/.codex/config.toml` `[mcp_servers]` |
| Antigravity | MCP config in app settings |

One canonical server spec (transport, command/url, env-var *names* only — never values) emits to
all. Secrets never enter emitted files; Aesop references env vars and `doctor` checks they're set.

## Hooks

| Harness | Mechanism |
|---|---|
| Claude Code | `settings.json` hooks: `PreToolUse`, `PostToolUse`, `Stop`, `Notification`, `SessionStart` — deterministic shell |
| Copilot | hooks (awesome-copilot category: "automated actions triggered during agent sessions") |
| Cursor | hooks support (per ecc adapter) |
| Codex / others | fallback: git pre-commit + wrapper scripts |

Standard hook set: format-on-write (PostToolUse), dangerous-command block (PreToolUse),
notify-on-stop. **Hooks are for hard policy** — LLM compliance is probabilistic; hooks are
guaranteed.

## Permissions

| Harness | Mechanism |
|---|---|
| Claude Code | `.claude/settings.json` `permissions.allow/deny/ask`; `--dangerously-skip-permissions` only in containers |
| Codex | sandbox modes + approval policy in `config.toml` |
| Copilot CLI | tool allowlisting |
| Cursor | YOLO/allowlist settings |

Canonical tiers: **read free · mutate policy-checked · irreversible human-gated.** Tier mapping is
per-harness in the emitter; the devcontainer recipe for safe unattended runs ships in the registry.

## Loops & goals

| Harness | Native long-running loop | Aesop emits |
|---|---|---|
| Codex CLI | `/goal` (first to ship, late Apr 2026; SQLite-backed; create/pause/resume/clear) | goal recipe → `/goal` invocation + config |
| Claude Code | `/goal` (2.1.139, May 12 2026; Haiku per-turn evaluator) + `/loop` + Routines (scheduled) | goal recipe → `/goal` + stopping conditions |
| Copilot CLI | agentic; no first-party `/goal` (comparison posts exist; re-verify each release) | Ralph runner config |
| Cursor | agent mode; no first-party `/goal` | Ralph runner config |
| Antigravity | Manager surface + scheduled tasks | scheduled-task config + Ralph |

One **goal recipe** (success criterion + iteration ceiling + no-progress detector + budget
ceiling) compiles to whichever form the harness supports. The three hard stops are required
fields — a recipe without them fails schema validation.

## State & memory

Identical everywhere: `tasks/todo.md` (plan + checkboxes), `tasks/lessons.md` (mistake→rule),
project notes dir. The agent forgets between runs; the repo doesn't. No translation needed — this
is the one primitive that's pure convention.

## Verification protocol for this doc

`aesop doctor --matrix` (Phase 4) re-checks each cell against the installed harness version and
flags rows older than 90 days. Until then: re-verify by hand each time an emitter changes.
