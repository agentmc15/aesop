# Roadmap — phases 0–7, one reviewable PR each

Built the way the kit prescribes: **rails first, then delegate phase-by-phase against locked
schemas.** Each phase has a measurable success criterion — paste it straight into `/goal`. After
Phase 1, schema changes are breaking changes requiring explicit justification.

## Phase 0 — Rails *(this repo, done)*
Plan, docs, research notes, registry seeds, profiles, schema draft, CLI skeleton with locked
interfaces (`src/types.ts`).
**Done when:** docs complete; seeds in place; `Emitter`/`Manifest` interfaces compile.

## Phase 1 — Manifest + detect *(done 2026-06-10)*
Finalize `aesop.schema.json` (lock it). Implement `init`: detection (lockfiles → stack; package
scripts/Makefile/CI → commands; workspaces → monorepo; existing agent files → import) +
interview + manifest writer.
**Goal:** *`aesop init` on 5 real repos (node, python, go, rust, monorepo) produces a
schema-valid manifest with ≥80% of fields auto-detected; existing CLAUDE.md/AGENTS.md content is
imported, not lost.*
**Result:** schema locked (v1); `src/{detect,interview,manifest,commands/init}.ts`; 5 fixtures in
`fixtures/init/`; 11 tests green — goal-line tests encode the criterion verbatim (detection
24/24 aimed fields; imports preserved; same-family judge and stop-less goal recipes rejected).
Runtime deps justified: `yaml` (manifest fidelity), `ajv` (the schema IS the contract).

## Phase 2 — Compiler + first two emitters *(done 2026-06-10)*
Resolve/lock pipeline, profile application, fence writer, and the **claude-code** and **codex**
emitters (the two with native `/goal`).
**Goal:** *golden-fixture round-trip: compile on 3 fixture manifests matches checked-in expected
output byte-for-byte; `compile --check` exits 0/3 correctly in CI.*
**Result:** `src/{profile,registry,render}.ts`, `src/emitters/{claude-code,codex}.ts`,
`src/commands/compile.ts`; agent seeds normalized to canonical frontmatter; AGENTS.md emitted
once by the core (CLAUDE.md = `@AGENTS.md`); 3 golden fixtures byte-compared; --check exits 0/3
verified at CLI level; token-lean pruning + outside-fence preservation + one-off `--pathway`
override all tested. 17 tests green. `aesop profile list|show` shipped early.

## Phase 3 — Four more emitters *(done 2026-06-10)*
**copilot** (copilot-instructions.md + path-scoped `.instructions.md` + `.prompt.md` +
`.github/agents/`), **cursor** (`.mdc` rules with globs/alwaysApply), **antigravity**
(AGENTS.md + GUARDRAILS.md), **vscode**. Capability matrix tests: every fallback explicit.
**Goal:** *same golden-fixture gate per harness; `capabilities()` output matches
docs/03-harness-matrix.md cell-for-cell.*
**Result:** all six emitters live; full fixture compiles 47 files across all harnesses,
golden-gated. Copilot gets native `applyTo` path scoping (excluded from its main file to avoid
duplication); Cursor gets `globs` rules + skills-as-rules + a slim alwaysApply pointer to
AGENTS.md; Antigravity gets generated GUARDRAILS.md (no GEMINI.md — AGENTS.md wins precedence);
VS Code gets settings wiring + verify-loop tasks.json. Fallbacks are shared-byte files in
`.aesop/{roles,prompts}/`. The matrix doc gained a "Capabilities summary" table that
`capabilities.test.ts` asserts cell-for-cell. 19 tests green.

## Phase 4 — Sync + doctor *(done 2026-06-10)*
Lockfile hashing, drift detection, `--write-back` (instruction edits auto-lift; structural edits
prompt), the full doctor check table, `doctor --matrix`.
**Goal:** *10 fixtures with seeded drift → 10/10 detected with correct file/line; doctor catches
all 8 canonical misconfigurations (broken test cmd, dead MCP, missing stops, oversize
instructions, secret in config, YOLO outside container, missing tasks/, judge same family).*
**Result:** compile refactored around `computeOutputs()` (one source of expected truth);
`aesop sync` reports edited/missing/orphaned with first-differing line (10/10 seeded drifts
caught at exact file:line), `--accept` regenerates preserving outside-fence content,
`--write-back` lifts in-fence AGENTS.md additions into a manifest block and recompiles;
`aesop doctor` catches all 8 codes (verify loop actually executed with timeout; MCP =
binary-resolution for now, honest in the finding), `--fix` creates the state dir only,
`--matrix` prints live capabilities; `aesop lessons [--promote]` and `aesop eject --force`
shipped (both were Phase-4 table entries). 27 tests green; doctor/sync exit 3 on findings.

## Phase 5 — Registry federation *(done 2026-06-10)*
Importers normalizing awesome-copilot (`.instructions.md`/`.prompt.md`/agents/skills) and ecc
(agents/skills/rules/hooks) into canonical schemas; SHA pinning; `update` with reviewable diffs.
**Goal:** *`aesop add agent code-reviewer --from ecc` and `aesop add instructions react --from
awesome-copilot` each emit valid native files on all 6 harnesses; `update` shows a correct diff
when upstream moves.*
**Result:** providers (builtin / `github:` cloned into gitignored `.aesop/cache/` / `path:` for
org-local checkouts — FLAGGED additive schema widening, all old manifests stay valid); per-file
importers (Claude-format agents → canonical tiers/tools, `applyTo` → path scope, rules → blocks,
ecc domain-nested skills found via wildcard lookup); imported content is **vendored** into
tracked `.aesop/vendor/<registry>/` (reviewable, SHA-pinned via `.meta.json`, offline compiles);
instruction imports become provenance-marked manifest blocks so `update --apply` can replace
them. `add` / `remove` (with orphan deletion) / `list --available` / `update` all live. 32 tests
green.

## Phase 6 — Loops + goals
Goal-recipe validation (three stops + runnable verify), `/goal` emission for Claude Code + Codex,
the portable Ralph runner, orchestration templates (worktree-per-agent, `max_parallel` =
`review_bandwidth`), scheduled-automation emission (Routines/cron).
**Goal:** *one recipe runs to verified completion twice: via native `/goal` on Claude Code AND
via the Ralph runner on a harness without `/goal`; both halt correctly on each of the three stops
when forced.*

## Phase 7 — Bundle + MCP + ship
`bundle` (claude-plugin, copilot-plugin, tarball), `aesop mcp serve`, npm publish as `aesop`
(or scoped fallback), dogfood: this repo managed by itself.
**Goal:** *a teammate installs the full environment with one command; `aesop doctor` is green on
Aesop's own repo, compiled by Aesop.*

---

## Kickoff prompt (paste into Claude Code or Codex)

```
You're working in the Aesop repo. Read PLAN.md, then docs/01–08, then AGENTS.md. Follow AGENTS.md
— especially simplicity, surgical changes, verify-before-done, and the three hard stops.

ENTER PLAN MODE and propose the implementation plan for Phase <N> from docs/08-roadmap.md, one
reviewable PR. Constraints:
- Do not modify schemas/ after Phase 1 without flagging it as a breaking change and stopping for
  approval.
- Every emitter is a pure function (manifest, primitives, profile) → files; all I/O stays in the
  CLI shell.
- Each phase lands with tests that encode its Goal line verbatim.
- Append any correction I give you to tasks/lessons.md.
Show me the plan before writing code.
```

Per-phase follow-up: *"Implement Phase <N> per the approved plan. Run the verify loop before
declaring done; show me the test output for the phase's Goal line."*

## Standing risks

| Risk | Mitigation |
|---|---|
| Harness churn (formats/features move quarterly) | matrix doc is version-pinned and checked by `doctor --matrix`; emitters isolated behind one interface |
| LCD trap (portability eating capability) | native-over-LCD rule + explicit `capabilities()` fallbacks + matrix tests |
| Registry trust (foreign prompts are untrusted input) | schema validation, SHA pins, review-gated `update`, never auto-apply |
| The three unsolvables (verification · comprehension debt · cognitive surrender) | not mitigable by tooling — documented, surfaced at init, parallelism capped by review bandwidth. Build the loop like someone who intends to stay the engineer. |
