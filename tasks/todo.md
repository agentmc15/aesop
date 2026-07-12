# Slice 2: quick wins + robustness (2026-07-12)

From tasks/improvement-recommendations.md §1–2. Deferred by choice: release automation
(needs an NPM_TOKEN decision from the human) and the seventh emitter (post-1.0 tier).

## Code fixes
- [x] render.ts:68 bare Error → AesopError → verify: render.test.ts pins the message
- [x] resolveAgentSpec() helper in emitters/shared.ts; use in claude-code, codex,
      copilot, rolePromptFiles → verify: full suite green, goldens unchanged

## Tests
- [x] render.test.ts — fence contract unit tests: wrapInlineFence hash, fenceDrift
      (clean / tampered / no fence), mergeWithExisting (no file, fence replace with
      content above AND below preserved, unmanaged file → marker, empty file)
      → verify: npm test

## Dependencies & CI
- [x] npm audit fix (esbuild dev-dep, GHSA-g7r4-m6w7-qqqr) → verify: audit clean, tests green
- [x] .github/dependabot.yml (npm + github-actions, weekly)
- [x] CI matrix: node 20/22 × ubuntu/macos/windows; doctor stays ubuntu-only (posix
      `command -v` checks); audit + coverage steps on one leg → verify: CI green on PR;
      iterate on any windows/macos failure rather than dropping the leg silently
- [x] .gitattributes `* -text` so goldens survive Windows checkout byte-for-byte

## Docs & contribution scaffolding
- [x] registry/commands/README.md + registry/hooks/README.md (parallel to agents/skills)
- [x] CONTRIBUTING.md — distill the load-bearing rules: locked types/schema, doc-first
      matrix, deliberate golden regeneration, no AI trailers, phase workflow
- [x] .github/ISSUE_TEMPLATE/{bug_report,feature_request}.md + pull_request_template.md
- [x] .github/workflows/matrix-freshness.yml — monthly cron + dispatch; opens an issue
      when docs/03's verified date exceeds 90 days
- [x] CHANGELOG Unreleased additions

## Wrap-up
- [x] npm test + lint + self compile --check + doctor green; push; PR; CI green; merge
