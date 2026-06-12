# AESOP — The Comprehensive Plan

> **Aesop tells your project's story to every agent, in each agent's native tongue.**
>
> Aesop is an *environment compiler* for AI coding agents. You connect it to any project, it
> detects what the project is, asks you what it can't detect, and compiles the **exact agentic
> environment you want** — instruction files, skills, subagents, MCP servers, hooks, plugins,
> loops, and goals — natively, for **any harness**: Claude Code, Codex CLI, GitHub Copilot
> (CLI + VS Code), Cursor, Antigravity, VS Code, and whatever ships next.

This document is the master plan. Each section links to a deeper spec in [`docs/`](docs/).
The research grounding (Karpathy, Boris Cherny, Addy Osmani, prior art) lives in
[`docs/research/`](docs/research/) with sources.

---

## 0. Thesis — why Aesop exists

Three facts, all verified mid-2026 (see [`docs/research/`](docs/research/)):

1. **The unit of programming moved up.** Karpathy dates the inflection to December 2025: models
   now reliably execute *macro actions* ("implement this feature", "migrate this module"), and the
   human's scarce contribution is **spec, taste, verification, and orchestration**. His
   verifiability law: *LLMs automate what you can verify* — so the highest-leverage thing you can
   give an agent is a verifiable environment. ([Sequoia Ascent 2026](https://karpathy.bearblog.dev/sequoia-ascent-2026/))
2. **The unit of work moved up too.** Boris Cherny runs five parallel Claude Code sessions in
   separate worktrees and ships 20–30 PRs/day; the leverage is no longer the prompt, it's the
   **loop and the environment around it** — CLAUDE.md as living memory, slash commands for every
   daily workflow, plan-mode-first, mistake→rule. Addy Osmani names the discipline *loop
   engineering*: five primitives + state, the same shape in every tool.
3. **Every harness now ships the same primitives under different names.** Instructions, skills,
   subagents, MCP, hooks, plugins, and now native long-running **goals** (`/goal` shipped in Codex
   CLI late-April 2026, Claude Code 2.1.139 mid-May 2026). The primitives converged; the *file
   formats didn't*. Six harnesses means six dialects of the same configuration.

**The gap Aesop fills:** the world has content libraries (github/awesome-copilot, ecc with its 64
agents and 261 skills, the agentic-harness-kit this repo grew out of) but no *application* that
takes **one declarative description of your project + your preferences** and compiles it into a
correct, complete, in-sync environment for whichever harness(es) you run — then keeps it in sync,
audits it, and upgrades it as best practices move.

Karpathy's "agent-native infrastructure" point is the design north star: products must expose
**machine-readable schemas, CLIs, and MCP** — docs should say *what to paste to the agent*, not
what a human should click. Aesop is agent-native infrastructure *for the agents themselves*.

> The one idea, inherited from the kit and made executable:
> **define the context → define the tools → define the feedback loop → define the guardrails →
> let agents work → preserve human understanding.**
> Aesop compiles the first four, runs the fifth, and is explicitly designed not to let you skip
> the sixth.

---

## 1. What Aesop is (and is not)

**Aesop is:**
- A **CLI application** (`npx @agentmc15/aesop init` in any repo) plus a **registry** of proven primitives,
  plus a set of **emitters** that write each harness's native files.
- **Declarative.** One manifest — `aesop.yaml` — is the single source of truth in the user's
  project. Everything under `.claude/`, `.github/`, `.cursor/`, `.codex/`, `GEMINI.md`, `AGENTS.md`
  is *compiled output*, regenerable and drift-checked.
- **Pathway-aware.** The same primitives at different settings on one dial: `accuracy-max`,
  `balanced`, `token-lean` (and custom points in between). Pick per-project, override per-task.
- **Self-applying.** Aesop's own repo is configured by Aesop (dogfood from day one).

**Aesop is not:**
- Another content library. It *federates* libraries (its own registry, ecc, awesome-copilot, any
  git URL) rather than competing on volume.
- A wrapper that runs the agent for you. The harness stays the harness; Aesop builds the
  environment the harness runs in.
- A framework inside your code. It writes config files; `aesop eject` leaves you with plain native
  files and no dependency.

---

## 2. Architecture — manifest → compile → emit → sync

```
                       ┌─────────────────────────┐
        detect ──────► │       aesop.yaml        │ ◄────── interview
   (stack, commands,   │  the manifest: project  │    (what can't be detected:
    CI, conventions)   │  facts · harnesses ·    │     invariants, models,
                       │  pathway · primitives   │     risk tolerance, MCP creds)
                       └───────────┬─────────────┘
                                   │  aesop compile
                       ┌───────────▼─────────────┐
                       │        COMPILER         │
                       │ resolve primitives from │ ◄────── registry/ (built-in)
                       │ registries · apply      │ ◄────── ecc, awesome-copilot,
                       │ pathway profile · render│         any git URL (federated)
                       └───────────┬─────────────┘
              ┌──────────┬─────────┼──────────┬───────────┬──────────┐
              ▼          ▼         ▼          ▼           ▼          ▼
         claude-code   codex    copilot    cursor    antigravity   vscode     ← emitters
         CLAUDE.md    AGENTS.md .github/   .cursor/  GEMINI.md+   .vscode/
         .claude/*    .codex/*  {instr,    rules/    AGENTS.md+   + copilot
         .mcp.json              prompts,   *.mdc     GUARDRAILS   files
                                agents}/
              └──────────┴─────────┴──────────┴───────────┴──────────┘
                                   │
                       ┌───────────▼─────────────┐
                       │   aesop sync / doctor   │  drift detection · audit ·
                       │   aesop update          │  registry upgrades · lessons
                       └─────────────────────────┘
```

Design rules, in priority order:

1. **One canonical model, thin native emitters.** The manifest + canonical instruction blocks are
   the source of truth; per-harness files are *rendered*, never hand-forked. (`AGENTS.md` is
   emitted too — it's the portable standard read natively by Codex, Antigravity, Cursor, and
   increasingly Claude Code — but in Aesop even `AGENTS.md` is output, not source.)
2. **Native over lowest-common-denominator.** Where a harness has a richer native form (Copilot's
   path-scoped `.instructions.md` with `applyTo` frontmatter, Cursor's `.mdc` rules with `globs`/
   `alwaysApply`, Claude Code's hooks and plugins), the emitter uses it. Portability must never
   cost capability.
3. **Generated files are marked and fenced.** Every emitted file carries a `<!-- aesop:begin -->`
   fence; users can add hand-written content outside the fence and `aesop sync` preserves it.
   Drift *inside* the fence is detected and reported (with a `--write-back` path that lifts manual
   edits into the manifest, mirroring Boris's mistake→rule loop).
4. **Everything is schema'd.** `aesop.yaml`, primitives, profiles, and emitter outputs all have
   JSON Schemas in [`schemas/`](schemas/). Machine-readable first — agents will run Aesop more
   often than humans will.

Full spec: [`docs/02-architecture.md`](docs/02-architecture.md).

---

## 3. The primitives — what Aesop manages

Nine primitive types, unified from Osmani's loop-engineering parts list and what every harness now
ships. Each has: a canonical schema, seed content in [`registry/`](registry/), and a column in the
emit matrix ([`docs/03-harness-matrix.md`](docs/03-harness-matrix.md)).

| # | Primitive | Job in the loop | Canonical form | Emits to (examples) |
|---|---|---|---|---|
| 1 | **Instructions** | who the agent is + the rules; global vs local | `instructions:` blocks in manifest + AGENTS template | `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md` + `.github/instructions/*.instructions.md`, `.cursor/rules/*.mdc`, `GEMINI.md` |
| 2 | **Skills** | codified project knowledge; the compounding unit | `SKILL.md` folder (the converged format) | `.claude/skills/`, `.github/skills/`, Codex skills, Antigravity skills |
| 3 | **Subagents** | maker ≠ checker; parallel, context-isolated work | one YAML role file | `.claude/agents/*.md`, `.codex/agents/*.toml`, `.github/agents/*.md`, Cursor rules-scoped roles |
| 4 | **Commands / prompts** | the daily inner-loop workflows, parameterized | one prompt file + args schema | `.claude/commands/`, `.github/prompts/*.prompt.md`, Codex prompts |
| 5 | **MCP servers** | let the loop touch real tools | one server spec (transport, auth, scopes) | `.mcp.json`, `.vscode/mcp.json`, `.cursor/mcp.json`, `.codex/config.toml [mcp]` |
| 6 | **Hooks** | deterministic policy (LLM compliance is probabilistic; hooks are guaranteed) | event + matcher + action | `.claude/settings.json` hooks, Copilot hooks, git pre-commit fallback for harnesses without hooks |
| 7 | **Permissions** | tiered: read free, mutate policy-checked, irreversible human-gated | allow/deny/ask lists | `.claude/settings.json`, Codex sandbox config, Copilot policies |
| 8 | **Loops & goals** | the heartbeat: native `/goal` where it exists, portable Ralph loop where it doesn't, orchestration above both | goal recipe (success criterion + 3 hard stops) | `/goal` recipes (Claude Code, Codex), `loops/ralph` runner (Cursor, Copilot), cron/Routines/automations |
| 9 | **State & memory** | what survives between runs — on disk, not in context | `tasks/` convention (todo.md, lessons.md) | identical everywhere (it's just files — the one primitive that needs no translation) |

Plugins are deliberately *not* a tenth primitive: **a plugin is a distribution wrapper** around
1–8. `aesop bundle` emits a Claude Code plugin (`.claude-plugin/`), a Copilot plugin installable
via `copilot plugin install`, or a plain tarball — same contents, three wrappers.

Detail per primitive, including the canonical schemas: [`docs/04-primitives.md`](docs/04-primitives.md).

---

## 4. Pathways — the dial

Inherited from the kit, kept verbatim as the proven calibration ([`profiles/`](profiles/)), now
applied at **compile time** (which primitives get emitted, which models get pinned, how loops are
budgeted) rather than only at run time:

| Parameter | accuracy-max | balanced | token-lean |
|---|---|---|---|
| reasoning effort | xhigh | high | medium/fast |
| model tier | strong | strong | cheap |
| verify subagent | yes | yes | no |
| reviewer subagent | yes (strong model) | no | no |
| LLM judge | yes | no | no |
| multi-agent | yes | when needed | no |
| compaction | summarize | summarize | truncate |
| max iterations / no-progress / budget $ | 80 / 4 / 100 | 40 / 3 / 25 | 20 / 2 / 5 |

- **token-lean is the right starting point** (Osmani: prescriptive best practices assume a token
  budget you probably don't have; subagents and judges burn tokens — spend where a second opinion
  pays).
- **Two non-negotiables at every setting:** the three hard stops stay on (only numbers change),
  and safety rules never relax (token-lean drops the *extra review pass*, never the
  untrusted-input, least-privilege, or no-secrets rules).
- Pathways are **per-task overridable**: `aesop compile --pathway accuracy-max` before a
  migration; per-intent routing inside loops (FAQ → lean, billing → max) for product use.
- The dial is continuous. `aesop profile new <name> --from balanced` forks a calibration.

Full parameter semantics: [`docs/05-pathways.md`](docs/05-pathways.md).

---

## 5. The CLI — command surface

The application is a single Node/TypeScript CLI (`npx @agentmc15/aesop`, no install). Full spec with flags,
exit codes, and JSON output modes: [`docs/06-cli-spec.md`](docs/06-cli-spec.md).

| Command | What it does |
|---|---|
| `aesop init` | **Detect** (stack, package manager, build/test/lint commands, CI, existing agent files) → **interview** (only what can't be detected: invariants, models, judge family, risk posture, harnesses, pathway) → write `aesop.yaml` → first compile. Existing `CLAUDE.md`/`AGENTS.md`/`.cursor/rules` are *imported*, not clobbered. |
| `aesop compile` | Render the manifest through the active profile into every selected harness's native files. Idempotent; `--check` mode for CI. |
| `aesop sync` | Diff emitted files against what compile would produce. Report drift; `--write-back` lifts in-fence manual edits into the manifest (mistake→rule, mechanized). |
| `aesop doctor` | Audit: schema-validate the manifest, verify commands actually run (`test`/`lint`/`build`), check MCP servers respond, flag missing verify-loop, flag instruction files over budget (~250 lines), flag secrets in config. |
| `aesop add <type> <name>` | Add a primitive from any registered source (`aesop add skill verify-loop`, `aesop add agent security-reviewer --from ecc`, `aesop add instructions react --from awesome-copilot`). |
| `aesop goal <recipe>` | Emit a goal recipe with a measurable stopping condition + the three hard stops, in the native form: `/goal` invocation for Claude Code / Codex, Ralph-loop config for Cursor / Copilot. |
| `aesop bundle` | Package the current environment as a plugin (Claude Code marketplace format, Copilot plugin, or tarball) so a team installs it in one step. |
| `aesop update` | Pull registry updates; show a reviewable diff of what would change (a prompt change is a code change — it goes through review). |
| `aesop lessons` | Append a correction to `tasks/lessons.md` and optionally promote it to an instruction rule in the manifest. |
| `aesop eject` | Remove the fences and the manifest; leave plain native files. No lock-in, ever. |

Every command supports `--json` (agent-native: agents are first-class callers) and is also exposed
as an **MCP server** (`aesop mcp serve`) so any harness can drive Aesop from inside a session —
the agent that hits a missing skill can install it without leaving the loop.

---

## 6. The registry — federated, not monolithic

[`registry/`](registry/) ships **seed content** proven in the agentic-harness-kit: 7 skills
(spec-first, verify-loop, lessons-loop, context-compaction, safe-trace, llm-wiki,
agentic-rag-router + template), 8 subagents (explorer, implementer, critic, researcher,
code-simplifier, spec-reviewer, security-reviewer, verify-app), MCP examples, the canonical
AGENTS template, and the three loop families (goal recipes, Ralph, orchestration).

Beyond the seeds, sources are **federated** — `aesop.yaml` declares them:

```yaml
registries:
  - builtin                                  # this repo's registry/
  - github:github/awesome-copilot            # instructions · prompts · agents · skills · plugins · hooks
  - github:affaan-m/ecc                      # 64 agents · 261 skills · rules · hooks · mcp-configs
  - github:your-org/agent-standards          # your company's blessed set
```

Aesop normalizes each source's format into the canonical schemas on import (awesome-copilot's
`.instructions.md`/`.prompt.md`/`.agent.md`, ecc's agents/skills/rules layout), pins versions by
commit SHA, and `aesop update` diffs upstream changes for review. The org story is the kit's
"enablement" case mechanized: one company registry + `aesop bundle` = the whole team gets the
blessed environment in one command, and an automation audits repos for drift from the baseline.

---

## 7. Research grounding — what's encoded where

The full notes with sources are in [`docs/research/`](docs/research/). The load-bearing
techniques and where Aesop encodes each:

**From Karpathy** ([notes](docs/research/karpathy.md)):
- *Verifiability law* ("LLMs automate what you can verify") → `aesop doctor` refuses to call an
  environment healthy without a working verify loop; every goal recipe requires a measurable
  stopping condition; pathway autonomy scales with verifiability (high autonomy on test-covered
  refactors, low on novel design).
- *Agent-native infrastructure* (CLIs, MCP, machine-readable schemas, docs-as-paste-targets) →
  `--json` everywhere, `aesop mcp serve`, JSON Schemas for every artifact, README quickstarts
  written as agent-pasteable blocks.
- *Vibe coding raises the floor; agentic engineering raises the ceiling* → Aesop targets the
  ceiling: guardrails and review gates are defaults, not options.
- *Outsource thinking, never understanding* → comprehension features are first-class: emitted
  environments include the explain/walkthrough commands, and orchestration templates cap parallel
  agents at your stated **review bandwidth**, not your CPU count.
- *The 11 coding principles* (from the karpathy-skills CLAUDE.md: explicit assumptions, tradeoffs,
  clarifying questions, simplicity bias, no premature abstraction, minimal scope, surgical edits,
  behavioral matching, orphan cleanup, test-first, plan documentation) → the canonical
  instruction template, [`registry/instructions/AGENTS.template.md`](registry/instructions/AGENTS.template.md).

**From Boris Cherny** ([notes](docs/research/boris-cherny.md)):
- *CLAUDE.md as living memory; mistake→rule* → `aesop lessons` + `aesop sync --write-back`.
- *Plan mode first; good plan ⇒ one-shot implementation* → plan-first is in the canonical
  instructions; goal recipes carry a plan-gate phase.
- *Anything done more than once a day becomes a slash command* → the commands primitive +
  `aesop add command`; seed commands include commit-push-PR, fix-ci, techdebt.
- *5 parallel sessions, one worktree each; writer/reviewer pairing* → the orchestration loop
  template emits worktree-per-agent setups; maker/checker subagent pairs are the default at
  `balanced` and above.
- *Permission allowlists over YOLO; full-skip only in containers* → the permissions primitive
  defaults; devcontainer recipe ships in the registry.
- *Hooks for hard policy* (format-on-write, dangerous-command blocks) → hooks primitive, with git
  pre-commit fallback on harnesses without native hooks.

**From Addy Osmani** ([notes](docs/research/loop-engineering.md)):
- The five primitives + state map directly onto Aesop's primitive types.
- *Token rich vs token poor* → the pathways dial is the product's spine, not a footnote.
- *Review bandwidth is the ceiling* → orchestration templates take `max_parallel` from the
  manifest's `review_bandwidth`, defaulting low.
- *The three problems no loop solves* (verification is yours, comprehension debt, cognitive
  surrender) → printed by `aesop init` at the end of setup, encoded in BLUEPRINT-style docs, and
  deliberately *not* automated away.

**From the `/goal` shipping wave (April–May 2026)** ([notes](docs/research/references.md)):
- Codex `/goal` (SQLite-backed, create/pause/resume) and Claude Code `/goal` (2.1.139, Haiku as
  per-turn evaluator) are the native loop targets; Cursor and Copilot get the portable Ralph
  runner. One goal recipe → both forms.

---

## 8. Build roadmap — phased, one reviewable PR each

Aesop is built the way the kit prescribes: rails first, then delegate phase-by-phase against
locked schemas. Kickoff prompts per phase: [`docs/08-roadmap.md`](docs/08-roadmap.md).

| Phase | Deliverable | Success criterion (the `/goal` stopping condition) |
|---|---|---|
| **0. Rails** *(this repo, now)* | Plan, schemas, registry seeds, CLI skeleton with locked interfaces | `aesop --help` runs; schemas validate the seed content; docs complete |
| **1. Manifest + detect** | `aesop.yaml` schema final; `aesop init` detection (stack, commands, existing agent files) + interview | `aesop init` on 5 real repos (node, python, go, rust, monorepo) produces a valid manifest with ≥80% of fields auto-detected |
| **2. Compiler + 2 emitters** | Claude Code + Codex emitters (the two with native `/goal`) | round-trip test: compile → files match golden fixtures; `aesop compile --check` green in CI |
| **3. Four more emitters** | Copilot (CLI + VS Code), Cursor, Antigravity, VS Code | same golden-fixture gate per harness; native-feature parity table all green |
| **4. Sync + doctor** | drift detection, write-back, environment audit | seeded drift in 10 fixtures → 10/10 detected; doctor catches the 8 canonical misconfigurations |
| **5. Registry federation** | importers for awesome-copilot + ecc formats; SHA pinning; `aesop update` diffs | `aesop add agent code-reviewer --from ecc` and `aesop add instructions react --from awesome-copilot` both emit valid native files on all 6 harnesses |
| **6. Loops + goals** | goal recipes, Ralph runner, orchestration templates, three-hard-stops enforcement | a recipe runs to verified completion via native `/goal` on Claude Code AND via Ralph on a harness without `/goal` |
| **7. Bundle + MCP + ship** | `aesop bundle` (3 wrapper formats), `aesop mcp serve`, npm publish, dogfood repo public | a teammate installs the full environment in one command; Aesop's own repo is Aesop-managed |

Per the kit's playbook: **schema changes after Phase 1 are breaking changes** and need explicit
justification — the schema lock is what keeps six emitters comparable.

Risks tracked in the roadmap doc: harness churn (mitigated by the emitter interface + matrix doc
with per-harness version pins), format divergence (mitigated by native-over-LCD rule), and the
standing one — *a smoother loop makes verification, comprehension debt, and cognitive surrender
sharper, not easier*. Aesop ships the rails; you stay the engineer.

---

## 9. Repo map

```
PLAN.md                 ← you are here — the master plan
README.md               quickstart + the one idea
AGENTS.md               Aesop's own agent instructions (dogfood; CLAUDE.md mirrors it)
docs/
  01-vision.md          thesis, gap analysis vs prior art
  02-architecture.md    manifest → compiler → emitters → sync/doctor, in depth
  03-harness-matrix.md  the exact file/feature matrix per harness (version-pinned)
  04-primitives.md      the nine primitives: schemas, semantics, emit targets
  05-pathways.md        the dial: parameter semantics + per-task overrides
  06-cli-spec.md        every command: flags, exit codes, JSON output
  07-manifest-schema.md aesop.yaml, annotated
  08-roadmap.md         phases 0–7 with kickoff prompts (BUILD-WITH-AN-AGENT style)
  guides/               user documentation: getting started · adopting · everyday workflow ·
                        skills/agents/pathways/goals/MCP · registries · team rollout ·
                        per-harness notes · troubleshooting (see guides/README.md)
  research/             verified notes: karpathy · boris-cherny · loop-engineering ·
                        prior-art (ecc, awesome-copilot, karpathy-skills, the kit) · references
registry/               seed primitives: skills/ agents/ instructions/ mcp/ plugins/ loops/
profiles/               accuracy-max.yaml · balanced.yaml · token-lean.yaml
schemas/                aesop.schema.json + primitive schemas (locked at Phase 1)
src/                    CLI skeleton: commands/ emitters/ — typed interfaces, IMPLEMENT markers
```
