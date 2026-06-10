# Instruction files: global vs. local, per harness

An instruction file is *intent written down on the outside* so the agent reads your conventions
every run instead of re-deriving (and mis-guessing) them. Treat it as **living**: after correcting
the agent, have it update the file so it won't repeat the mistake; iterate until the mistake rate
drops.

## Two scopes
- **Global / user-level** — applies to every project for *you*. Put durable personal preferences
  here (how you like plans, default effort, review style).
- **Project / repo-level** — committed to git, shared by the team. Put project truth here (stack,
  commands, conventions, the one incident that taught you a rule). **Precedence: project overrides
  global**; more-specific (path-scoped) overrides less-specific.

## Paths & precedence by harness
| Harness | Global | Project | Path-scoped / extras |
|---|---|---|---|
| Claude Code | `~/.claude/CLAUDE.md` | `./CLAUDE.md` (also reads `AGENTS.md`) | `.claude/` agents, commands, skills, settings, hooks |
| Codex | `~/.codex/` global `AGENTS.md` + `config.toml` | `./AGENTS.md` | `.codex/agents/*.toml`, `.codex/skills/` |
| Copilot | personal instructions (settings) | `.github/copilot-instructions.md` | `.github/instructions/*.instructions.md` (`applyTo` globs), `.prompt.md`, agents |
| Cursor | user rules | `.cursor/rules/*.mdc` (also `AGENTS.md`) | rule `globs` + `alwaysApply` |
| Antigravity | `~/.gemini/antigravity/` | `AGENTS.md` → `GEMINI.md` → defaults | `GUARDRAILS.md`, `.agents/skills/`, `@workspace_scope` |
| VS Code | (via Copilot) | Copilot files + `.vscode/settings.json` | tasks, instruction-file settings |

## The portable standard
`AGENTS.md` is read natively by Codex and Antigravity and honored by Cursor; Antigravity also reads
`CLAUDE.md` when running a Claude model. That's why this kit keeps **one canonical `AGENTS.md`** and
generates the rest. Maintain the canonical file; sync the adapters.

## Keep it lean
A project instruction file should survive context compaction — keep it tight (≤ ~250 lines), put
project-specific facts in one `## Project` block, and push detailed/procedural knowledge into
**skills** rather than bloating the instruction file.
