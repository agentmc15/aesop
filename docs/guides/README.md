# Aesop guides

Task-oriented documentation for *using* Aesop. (The numbered docs one level up —
[`../01-vision.md`](../01-vision.md) through [`../08-roadmap.md`](../08-roadmap.md) — are the
design docs for people working *on* Aesop.)

## Start here

| Guide | When |
|---|---|
| [Getting started](getting-started.md) | first time — zero to a compiled environment and a running goal in ~10 minutes |
| [Adopting an existing project](adopting-an-existing-project.md) | you already have a CLAUDE.md / AGENTS.md / .cursor/rules and don't want to lose it |
| [The everyday workflow](everyday-workflow.md) | the daily loop: doctor, sync, write-back, lessons — how the environment stays correct and gets smarter |

## Primitives

| Guide | Covers |
|---|---|
| [Skills & commands](skills-and-commands.md) | using the seeds, authoring your own, where each harness puts them |
| [Subagents](subagents.md) | maker ≠ checker, the eight seed roles, authoring, model/effort pinning |
| [Pathways](pathways.md) | choosing accuracy-max / balanced / token-lean, per-task overrides, custom profiles |
| [Goals & loops](goals-and-loops.md) | native `/goal`, the portable Ralph runner, the three hard stops, scheduling, orchestration |
| [MCP, hooks & permissions](mcp-hooks-permissions.md) | wiring real tools, hard policy, the three permission tiers |

## Scaling up

| Guide | Covers |
|---|---|
| [Registries & updates](registries.md) | pulling from ecc / awesome-copilot / your org; vendoring; the review-gated update flow |
| [Team rollout](team-rollout.md) | bundle as a plugin, the org registry pattern, CI gating |
| [Agent-driven Aesop](agent-driven.md) | `aesop mcp serve` — letting the agent repair its own environment |
| [Per-harness notes](harnesses.md) | exactly what Claude Code, Codex, Copilot, Cursor, Antigravity, VS Code each get |

## Reference

- [CLI reference](../06-cli-spec.md) — every command, flag, and exit code
- [`aesop.yaml` reference](../07-manifest-schema.md) — the manifest, annotated
- [Harness matrix](../03-harness-matrix.md) — file formats and capabilities per harness
- [Troubleshooting & FAQ](troubleshooting.md)
