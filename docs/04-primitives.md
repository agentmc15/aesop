# The nine primitives — canonical schemas and semantics

Each primitive has one canonical form (schema in [`../schemas/`](../schemas/)), seed content in
[`../registry/`](../registry/), and a row per harness in [`03-harness-matrix.md`](03-harness-matrix.md).
Emit targets live there; this doc is the *semantics*.

## 1. Instructions

Canonical form: ordered **blocks** in the manifest, each with `scope` (`global` | `project` |
`path:<glob>`) and markdown content. The base template is
[`../registry/instructions/AGENTS.template.md`](../registry/instructions/AGENTS.template.md) —
the kit's canonical AGENTS.md carrying Karpathy's 11 principles, the verification doctrine, the
three hard stops, and the safety non-negotiables. Project facts go in the `## Project` block;
everything above it is portable.

Semantics:
- **Global vs local:** global = *your* durable preferences (plan style, effort defaults), emitted
  to user-level paths (`~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, …). Local = *project* truth
  (stack, commands, invariants), committed to the repo. Never mix them.
- **Path-scoped blocks** emit natively where supported (Copilot `applyTo`, Cursor `globs`, nested
  CLAUDE.md/AGENTS.md) and fold into the main file with a heading elsewhere.
- **Budget:** each emitted file ≤ ~250 lines. The compiler warns at 200, fails at 300 unless
  overridden — instruction files must survive compaction; every line earns its place.

## 2. Skills

Canonical form = the converged `SKILL.md` folder (frontmatter `name`, `description`; body;
optional `scripts/`, `references/`, `assets/`). Progressive disclosure is the entire point:
description always in context → body on trigger → bundled files on demand.

Authoring rules (enforced by `doctor`): description ≤ 2 sentences, states *when to use*; body
states the procedure, not the philosophy; anything used more than once a day belongs here or in
a command (Boris's rule of thumb). Seeds: spec-first, verify-loop, lessons-loop,
context-compaction, safe-trace, llm-wiki, agentic-rag-router.

## 3. Subagents

Canonical form: one YAML role file — `name`, `description` (when to delegate), `tools`
(narrowest set), `model` (tier or pin), `effort`, `prompt`. Doctrine:
- One job per agent; read-only by default; the main agent does the edits.
- **Maker ≠ checker** is the highest-value split: reviewer pinned to a *stronger* model at
  *higher* effort than the maker. The pathway dial controls which roles exist at all.
- Seeds: explorer, implementer, critic, researcher, code-simplifier, spec-reviewer,
  security-reviewer, verify-app.

## 4. Commands / prompts

Canonical form: prompt file + optional args schema. For inner-loop workflows a human triggers
repeatedly — distinct from skills (knowledge the *agent* pulls in). Seeds: `commit-pr`, `fix-ci`,
`techdebt`, `add-learning` (appends to `tasks/lessons.md` and offers to promote to a rule).

## 5. MCP servers

Canonical form: `name`, `transport` (stdio | http), `command`/`url`, `env` (names only),
`scopes` (what it may touch), `trust` (read | write | irreversible). The `trust` field feeds the
permissions primitive: an `irreversible` MCP tool is automatically human-gated. Default posture
is Boris-thin: zero MCP servers until a workflow needs one.

## 6. Hooks

Canonical form: `event` (pre-tool | post-tool | stop | session-start) + `matcher` + `action`
(shell). Hooks carry **hard policy** — the rules that must hold even when the model doesn't
comply: format-on-write, dangerous-command block, notify-on-stop. On harnesses without native
hooks, the emitter falls back to git pre-commit + wrapper scripts and says so.

## 7. Permissions

Canonical form: three tiers mapped per harness — **read** (free), **mutate** (allowlist/policy),
**irreversible** (human approval: deploys, pushes to default branch, data deletion, spending).
Plus an `unattended` block: the devcontainer recipe that is the *only* sanctioned context for
skip-permissions mode.

## 8. Loops & goals

Canonical form — the **goal recipe**:

```yaml
goal: "all tests in packages/api pass"
verify: "pnpm -F api test"          # the measurable stopping condition — required
plan_gate: true                      # plan approved before execution (Boris)
stops:                               # all three required; schema rejects a recipe without them
  max_iterations: 40
  no_progress_after: 3
  budget_usd: 25
```

Compiles to: native `/goal` (Claude Code ≥2.1.139, Codex CLI) · the portable Ralph runner
(Cursor, Copilot — fixed prompt re-fed each tick, context reset to anchor files) · orchestration
(mayor/worker over worktrees, `max_parallel` = manifest `review_bandwidth`) · scheduled
automations (Routines / cron / Antigravity scheduled tasks) for discovery-and-triage loops.

## 9. State & memory

Pure convention, identical everywhere: `tasks/todo.md` (current plan, checkboxes),
`tasks/lessons.md` (mistake→rule log, read at session start), optional `tasks/notes/`. Durable
state lives on disk, not in context — the agent forgets; the repo doesn't. Aesop emits the
directory, the instruction-file references to it, and the `add-learning` command that feeds it.

## Plugins (distribution, not a primitive)

`aesop bundle` wraps any subset of 1–8 as: a Claude Code plugin (`.claude-plugin/` +
marketplace.json), a Copilot plugin (`copilot plugin install <name>@<marketplace>`), or a plain
tarball. Same contents, three wrappers — the skill is the authoring format; the plugin is how you
ship it.
