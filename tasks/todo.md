# Phase 2 — Compiler + claude-code/codex emitters ✅ (2026-06-10)

Goal: golden-fixture round-trip — compile on 3 fixture manifests matches checked-in expected
output byte-for-byte; `compile --check` exits 0/3 correctly in CI.

## Done

- [x] 8 registry agent seeds normalized to canonical YAML frontmatter
- [x] Template cleaned: kit header removed, `{{PROJECT_BLOCK}}` parameterized
- [x] `src/profile.ts` — kit-YAML → locked Profile; overrides; agent pruning with notes
- [x] `src/registry.ts` — builtin resolver + sha256; frontmatter/agent/hook parsers
- [x] `src/render.ts` — AGENTS.md renderer, fence wrap/merge/drift
- [x] `src/emitters/claude-code.ts` — CLAUDE.md (@AGENTS.md), .claude/*, .mcp.json, settings
      (permissions allow/ask mapping, hooks → Pre/PostToolUse)
- [x] `src/emitters/codex.ts` — .codex/{config.toml, agents/*.toml, prompts, skills}
- [x] `src/commands/compile.ts` — resolve → profile → render → merge → write/check + lock.json
- [x] `aesop profile list|show`
- [x] 3 fixtures + goldens (minimal 7 files / full 25 / token-lean 5)
- [x] 17 tests green; CLI exit codes 0/3 verified live

## Review

- format-on-write hook emits only when `project.commands.format` exists — no invented formatter.
- Collision guard: two emitters producing different content for one path is a hard error.
- Goldens regenerate via compile-into-temp + copy (documented in git history); lock.json excluded
  from goldens (hashes covered by byte-compare of the files themselves).

# Next: Phase 3 — copilot, cursor, antigravity, vscode emitters (docs/08-roadmap.md)
