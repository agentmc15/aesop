# Emitters

One module per harness, each implementing the `Emitter` interface from
[`../types.ts`](../types.ts) — **pure render, no I/O**. The target formats are specified
cell-by-cell in [`../../docs/03-harness-matrix.md`](../../docs/03-harness-matrix.md); the
capability matrix returned by `capabilities()` must match that doc exactly (it's the test spec).

| Module (Phase) | Emits |
|---|---|
| `claude-code.ts` (2) | `CLAUDE.md`, `.claude/{agents,skills,commands,settings.json}`, `.mcp.json`, hooks, `/goal` recipes |
| `codex.ts` (2) | `AGENTS.md`, `.codex/config.toml`, `.codex/agents/*.toml`, `/goal` recipes |
| `copilot.ts` (3) | `.github/copilot-instructions.md`, `.github/instructions/*.instructions.md` (applyTo), `.github/prompts/*.prompt.md`, `.github/agents/`, `.vscode/mcp.json` |
| `cursor.ts` (3) | `.cursor/rules/*.mdc` (description/globs/alwaysApply), `.cursor/mcp.json`, Ralph runner config |
| `antigravity.ts` (3) | `AGENTS.md`, `GEMINI.md`, `GUARDRAILS.md`, scheduled-task config |
| `vscode.ts` (3) | `.vscode/settings.json`, `.vscode/tasks.json`, Copilot files delegation |

Shared helpers (Phase 2): fence writer, instruction renderer (canonical blocks → dialect),
`AGENTS.md` renderer (always emitted — the portable standard).

Rules:
1. Native over lowest-common-denominator; every fallback goes in `capabilities().fallback` and is
   surfaced by `compile --verbose`.
2. Secrets: env-var names only, ever.
3. Each emitter lands with golden fixtures: `fixtures/<harness>/{manifest.yaml → expected/}`.
