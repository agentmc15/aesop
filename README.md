# Aesop

**An environment compiler for AI coding agents.** Connect Aesop to any project and get the exact
agentic environment you want — instruction files, skills, subagents, commands, MCP servers, hooks,
permissions, loops, and goals — compiled natively for **any harness**: Claude Code, Codex CLI,
GitHub Copilot (CLI + VS Code), Cursor, Antigravity, VS Code.

> Aesop tells your project's story to every agent, in each agent's native tongue.

```bash
npm install -g github:agentmc15/aesop   # (after the npm publish: just `npx aesop`)

aesop init            # detect your project, answer a short interview → aesop.yaml
aesop compile         # emit native config for every harness you selected
aesop doctor --fix    # audit: does the agent have a real verify loop? working MCP? sane budgets?
aesop sync            # detect drift between manifest and emitted files; --write-back lifts edits
```

**New here? → [Getting started](docs/guides/getting-started.md)** (zero to a compiled
environment and a running goal in ~10 minutes).

One manifest (`aesop.yaml`) is the source of truth. Everything under `.claude/`, `.github/`,
`.cursor/`, `.codex/`, `AGENTS.md`, `GEMINI.md` is compiled output — regenerable, drift-checked,
and ejectable (`aesop eject` leaves plain native files; no lock-in).

## Why

Every harness now ships the same primitives — instructions, skills, subagents, MCP, hooks,
plugins, and native long-running goals (`/goal`) — but in six different dialects. Content
libraries exist (github/awesome-copilot, ecc); what's missing is the **application** that takes
one declarative description of your project and compiles a correct, complete, in-sync environment
for whichever harnesses you run, at whichever point on the cost/accuracy dial you choose:

| Pathway | When |
|---|---|
| `accuracy-max` | migrations, security, anything where a wrong answer is expensive |
| `balanced` | the daily driver |
| `token-lean` | the right place to **start** — turn the dial up only where accuracy pays |

Grounded in the people building this in the open: Andrej Karpathy's agentic-engineering and
verifiability framing, Boris Cherny's day-to-day Claude Code workflow, Addy Osmani's loop
engineering. See [`docs/research/`](docs/research/) for verified notes and sources.

## Status

**v0.1.0 — all 8 roadmap phases complete** ([`docs/08-roadmap.md`](docs/08-roadmap.md)), every
phase gated by tests that encode its goal line verbatim. This repo is **managed by Aesop itself**:
`AGENTS.md`, `CLAUDE.md`, `.claude/`, `.codex/` here are compiled from [`aesop.yaml`](aesop.yaml),
and CI fails on drift (`compile --check`) or an unhealthy environment (`doctor`).

Working today: `init` (detect + interview) · `compile` (6 harnesses, golden-fixture-gated) ·
`sync` (drift with file:line; `--write-back` lifts in-fence edits into the manifest) · `doctor`
(8-point audit) · `add`/`remove`/`list`/`update` (federated registries: builtin, ecc-style,
awesome-copilot-style, `path:`/`github:` sources, vendored + SHA-pinned) · `goal`
(native `/goal` emission + a portable Ralph runner with the three hard stops enforced) ·
`lessons --promote` · `bundle` (claude-plugin / copilot-plugin / tarball) · `mcp serve`
(drive Aesop from inside any agent session) · `eject` (no lock-in).

## Documentation

**Guides** ([index](docs/guides/README.md)) — task-oriented, for using Aesop:

| | |
|---|---|
| [Getting started](docs/guides/getting-started.md) | first run, end to end |
| [Adopting an existing project](docs/guides/adopting-an-existing-project.md) | you already have CLAUDE.md / AGENTS.md / rules |
| [The everyday workflow](docs/guides/everyday-workflow.md) | sync, write-back, lessons, doctor — the daily loop |
| [Skills & commands](docs/guides/skills-and-commands.md) · [Subagents](docs/guides/subagents.md) · [Pathways](docs/guides/pathways.md) | the primitives, used and authored |
| [Goals & loops](docs/guides/goals-and-loops.md) | native `/goal`, the Ralph runner, the three hard stops |
| [MCP, hooks & permissions](docs/guides/mcp-hooks-permissions.md) | real tools + hard policy + tiers |
| [Registries & updates](docs/guides/registries.md) · [Team rollout](docs/guides/team-rollout.md) | federation, bundling, org standards |
| [Agent-driven Aesop](docs/guides/agent-driven.md) | `mcp serve`: the agent repairs its own environment |
| [Per-harness notes](docs/guides/harnesses.md) · [Troubleshooting](docs/guides/troubleshooting.md) | specifics and fixes |

**Reference** — [CLI](docs/06-cli-spec.md) · [`aesop.yaml`](docs/07-manifest-schema.md) ·
[harness matrix](docs/03-harness-matrix.md) (tested against the emitters).

**Design** — [PLAN.md](PLAN.md) and [docs/01–08](docs/) for how and why Aesop is built;
[docs/research/](docs/research/) for the verified Karpathy / Cherny / Osmani grounding.

## The one idea

> You stop being the thing inside the loop. You design the loop, the context, the tools, and the
> guardrails — and you stay the engineer who understands what shipped.

Aesop compiles the loop, the context, the tools, and the guardrails. The understanding stays
yours — by design. Three problems no loop solves for you: **verification is still yours**,
**comprehension debt compounds**, and **cognitive surrender is a choice**. Aesop ships the rails;
you stay the engineer.

## License

MIT — see [`LICENSE`](LICENSE).
