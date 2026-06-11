# Phase 7 — bundle + MCP + ship + dogfood ✅ (2026-06-10)

Goal: one-command install; doctor green on Aesop's own repo, compiled by Aesop.

## Done
- [x] doctor YOLO check no longer flags its own block-dangerous-commands hook
- [x] bundle: claude-plugin (+plugin.json +marketplace.json → /plugin install aesop@aesop-marketplace),
      copilot-plugin dir, tarball of all managed files
- [x] mcp serve: hand-rolled stdio JSON-RPC (no SDK dep) — compile/sync/doctor/add/list/
      lessons/goal_list/goal_run; E2E-tested over real stdio
- [x] packaging: v0.1.0, repository field, prepublishOnly=test; npm pack --dry-run verified
      (dist+registry+profiles+schemas only). npm publish NOT run — owner's call.
- [x] DOGFOOD: aesop.yaml at root; hand AGENTS.md/CLAUDE.md replaced by compiled output
      (25 files); doctor exit 0; compile --check clean; live bundle smoke (11 files)
- [x] CI: npm test + compile --check + doctor
- [x] 44 tests green

## All 8 phases complete. Remaining for the owner:
- `npm publish` when ready (prepublishOnly runs the suite)
- live native-/goal run (interactive session + spend) — the one goal-line clause testable only by hand
