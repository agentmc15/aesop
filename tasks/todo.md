# Phase 5 — registry federation ✅ (2026-06-10)

Goal: add agent from ecc + add instructions from awesome-copilot emit valid native files on all
6 harnesses; update shows a correct diff when upstream moves.

## Done
- [x] FLAGGED additive schema widening: registries pattern gains `path:<dir>` (offline tests +
      org-local checkouts; every previously valid manifest stays valid; version stays 1)
- [x] src/federation.ts — providers (builtin / github→.aesop/cache / path), name derivation,
      per-file importers (Claude-format agents → canonical, applyTo → path scope, rules →
      blocks, wildcard lookup for ecc skills/<domain>/<name>)
- [x] Vendoring: .aesop/vendor/<registry>/ tracked in git, SHA-pinned via .meta.json; compile
      resolves non-builtin refs from vendor (offline compiles guaranteed)
- [x] add / remove (orphan files deleted via lock before/after) / list [--available] / update
      (changed-line preview; --apply rewrites vendor + provenance-marked manifest blocks +
      recompiles)
- [x] fixtures/registries/{ecc,awesome-copilot}; 5 federation tests; 32 total green
- [x] CLI smoke: add → list → update diff verified live

## Review
- Builtin adds skip vendoring (plain name refs); only foreign content is vendored.
- update never auto-applies; instructions blocks are replaced only when the provenance marker
  matches — hand-edited blocks without the marker are never touched.

# Next: Phase 6 — loops + goals (goal recipes → /goal, Ralph runner, orchestration)
