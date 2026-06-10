# Phase 1 — Manifest + detect ✅ (2026-06-10)

Goal (docs/08-roadmap.md): `aesop init` on 5 real repos (node, python, go, rust, monorepo)
produces a schema-valid manifest with ≥80% of fields auto-detected; existing CLAUDE.md/AGENTS.md
content is imported, not lost.

## Plan — all done

- [x] Lock `schemas/aesop.schema.json` (v1 LOCKED) → ajv compiles it; all fixtures validate
- [x] `src/manifest.ts` — load/validate/serialize (ajv + yaml); judge-family ≠ primary enforced
- [x] `src/detect.ts` — precedence: package scripts > Makefile > language defaults > CI scan
- [x] `src/import-existing` (folded into detect.ts — instruction files collected with harness
      inference in one pass; a separate module would have re-walked the same files)
- [x] `src/interview.ts` — readline interview; `--yes`/non-TTY → defaults
- [x] `src/commands/init.ts` — refuses overwrite without --force; prints the three problems
- [x] `src/index.ts` — parseArgs routing; AesopError → exit codes (0/1/2)
- [x] 5 fixtures in `fixtures/init/`
- [x] `registry/commands/` (4 seeds) + `registry/hooks/` (2 seeds)
- [x] 11 tests green; goal-line tests encode the criterion verbatim (detection 24/24)
- [x] Phase 1 marked done in docs/08-roadmap.md

## Review

- Verified end-to-end: `node dist/index.js init --yes --cwd <tmp copy of node-app>` writes a
  valid manifest, imports CLAUDE.md, prints the three problems.
- Runtime deps added (justified): `yaml`, `ajv`. Nothing else.
- Deferred intentionally: `init --refresh` (re-detect + diff) → Phase 4 with sync; interactive
  interview is implemented but only exercisable manually (TTY) — covered again in Phase 4 doctor.

# Next: Phase 2 — Compiler + claude-code/codex emitters (docs/08-roadmap.md)
