# Repo improvement recommendations — 2026-07-12

Assessment baseline, verified on a fresh clone: 54/54 tests pass, `npm run lint` clean,
self `compile --check` clean, `doctor` healthy. All 8 roadmap phases shipped (v0.1.0).
Nothing is broken; these recommendations are about hardening for adoption and the next
stage of functionality. Grouped by priority; each item is independently shippable.

---

## 1. Quick wins (small, do first)

- **CI matrix.** `.github/workflows/ci.yml` runs one job: Ubuntu, Node 22 only — but
  `package.json` declares `engines: node >=20`, so the oldest supported runtime is never
  tested. Add `node-version: [20, 22]` and `os: [ubuntu-latest, macos-latest, windows-latest]`.
  Windows matters most: the emitters write nested paths across six harness layouts, and
  path-separator bugs are the classic cross-platform failure for this kind of tool.
- **`npm audit` is 1 low finding away from clean** — esbuild (dev-only, via tsx),
  GHSA-g7r4-m6w7-qqqr; `npm audit fix` resolves it. Add an audit step (or Dependabot)
  to CI so this class of drift is caught automatically.
- **Wrap the bare `Error` at `src/render.ts:68`** ("instructions template missing from
  resolved primitives") in `AesopError` so even internal-invariant failures follow the
  no-raw-stack-trace contract the rest of the CLI keeps.
- **Deduplicate agent-spec resolution.** The same `find(ref) → parseAgent(resolved, ref)`
  pattern appears in `claude-code.ts:96`, `codex.ts:42`, `copilot.ts:44`, and
  `shared.ts:14`. Extract one `resolveAgentSpec(ctx, resolved)` helper into
  `emitters/shared.ts`.
- **Registry discoverability.** `registry/commands/` and `registry/hooks/` are the only
  seed directories without a README (agents, skills, mcp, plugins all have one). Add the
  two short READMEs.

## 2. Robustness before wider adoption

- **Unit tests for the untested utility layer.** `render.ts` (fence merge), `profile.ts`
  (pruning/overrides), `registry.ts` (frontmatter/agent/hook parsing), `interview.ts`
  (defaults, non-TTY), and `manifest.ts` (validation edge cases) — ~650 lines covered
  only indirectly through compile/federation integration tests. The highest-value target
  is `mergeWithExisting()` in render.ts: it is the guarantee that users' hand-written
  content outside fences survives recompiles, and its edge cases (empty file, multiple
  fences, fence at EOF, CRLF) are unpinned.
- **Coverage visibility.** `node --test` supports `--experimental-test-coverage` natively —
  no new dependency needed (consistent with the yaml+ajv-only rule). Surface it in CI so
  the gap above stays visible.
- **Contribution scaffolding.** No CONTRIBUTING.md, CODE_OF_CONDUCT.md, issue templates,
  or PR template. CONTRIBUTING.md matters most here because this repo has unusual rules a
  drive-by contributor will violate immediately: locked `src/types.ts` and schema,
  doc-first harness-matrix updates, golden fixtures regenerated deliberately, no AI
  trailers in commits. Distill the `## Project` conventions block of AGENTS.md into it.
- **Release automation.** `prepublishOnly` gates publish on tests, but publishing is
  manual. A tag-triggered GitHub Actions release workflow with `npm publish --provenance`
  gives supply-chain attestation — the right look for a security-conscious tool that
  writes files into other people's repos.
- **Harness-matrix freshness.** `docs/03-harness-matrix.md` was verified June 2026 and its
  own protocol says re-verify every 90 days (due ~September). Add a scheduled CI job (or
  calendar routine) that opens an issue when the verified-date exceeds the window, so the
  matrix can't silently go stale — harness churn is the roadmap's #1 tracked risk.

## 3. Functionality — the repo's own documented gaps

Three features are already promised in the docs as "future work"; shipping them closes
the loop between docs and code:

- **`aesop init --refresh`** (`docs/07-manifest-schema.md:77`) — re-run detection on an
  existing manifest and diff the result. This is the missing piece of the maintenance
  story: today detection runs once at init, and a project whose build/test commands
  change has no first-class path to update `aesop.yaml`.
- **`aesop profile new <name> --from balanced`** (`docs/06-cli-spec.md:166`, also promised
  in PLAN.md §4) — the pathways dial is "continuous" in the docs but only three fixed
  points exist in practice.
- **Antigravity skills version pinning** (`docs/03-harness-matrix.md:33`).

## 4. Functionality — next-stage ideas (post-1.0 candidates)

The roadmap ends at Phase 7 with no post-1.0 list; these are candidates for one, in
rough value order:

- **Local drift gate.** CI catches in-fence drift via `compile --check`, but only after
  push. Emit an optional git pre-commit hook (the hooks primitive already has the
  pre-commit fallback machinery) that runs `sync --json` so drift is caught at commit
  time on developers' machines.
- **A seventh emitter as churn insurance.** The emitter interface + capabilities matrix
  exists precisely so new harnesses are cheap; adding one more (e.g. Gemini CLI, which
  already reads the emitted `GEMINI.md`-adjacent forms) would validate the interface
  against a harness not designed for at Phase 0, before an external contributor tries.
- **`doctor --matrix`** — verify the installed harness versions against the pins in
  docs/03-harness-matrix.md and warn on mismatch, mechanizing the freshness protocol.
- **Registry index + search.** `aesop add` currently requires knowing the primitive's
  name. A `aesop search <term>` across registered sources (builtin + federated) would
  make the federation story usable without reading upstream repos.
- **Expand seed content.** 8 agents / 7 skills / 4 commands / 2 hooks is a solid seed but
  thin as a standalone draw; the hooks category especially (2 entries) has obvious
  candidates from the research notes (test-on-save, secret-scan-on-write, branch-protect).

## Non-recommendations

Considered and rejected: splitting large source files (largest is 291 lines — fine);
tightening dependency ranges (^ is appropriate at 0.x with only two runtime deps);
adding a linter beyond `tsc --noEmit` (would add a dev dependency for marginal gain on a
~4,900-line codebase with consistent style). `tasks/todo.md` still shows the completed
June security remediation — archive it when the next plan lands, but that's bookkeeping.
