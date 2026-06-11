# Phase 3 — copilot, cursor, antigravity, vscode emitters ✅ (2026-06-10)

Goal: same golden-fixture gate per harness; capabilities() matches docs/03-harness-matrix.md
cell-for-cell.

## Done
- [x] src/emitters/shared.ts — slugify, .aesop/{roles,prompts}/ fallback builders (shared bytes
      → collision-guard dedup), both MCP JSON dialects
- [x] copilot: copilot-instructions.md (path blocks excluded — native applyTo files carry them),
      .github/{instructions,prompts,agents,skills}, .vscode/mcp.json
- [x] cursor: 00-aesop.mdc alwaysApply pointer, scoped-*.mdc globs, skill-*.mdc description
      triggers, .cursor/mcp.json
- [x] antigravity: generated GUARDRAILS.md (safety + tiers + invariants + stops); no GEMINI.md
      (AGENTS.md wins precedence)
- [x] vscode: settings.json wiring, tasks.json verify loop, mcp.json
- [x] docs/03 matrix updated first (doc-first rule) + "Capabilities summary (tested)" table
- [x] capabilities.test.ts — cell-for-cell vs the doc table; fallback descriptions non-trivial;
      no native/fallback overlap
- [x] full fixture → 6 harnesses, 47 golden files; path-scoping + dedup assertions
- [x] 19 tests green

# Next: Phase 4 — sync + doctor (docs/08-roadmap.md)
