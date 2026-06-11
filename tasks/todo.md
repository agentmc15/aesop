# Phase 4 — sync + doctor ✅ (2026-06-10)

Goal: 10 seeded drifts → 10/10 at correct file:line; doctor catches all 8 canonical
misconfigurations.

## Done
- [x] compile refactor: computeOutputs() — one source of expected truth for compile AND sync
- [x] sync: edited (file:line) / missing / orphaned; --accept; --write-back lifts in-fence
      AGENTS.md additions into a manifest block + recompiles (mistake→rule mechanized);
      outside-fence edits are NOT drift (preservation contract)
- [x] doctor: 8 coded findings; lenient manifest load (schema errors are findings, not crashes);
      verify loop actually executed (120s timeout); MCP = binary resolution (honest); --fix
      creates state dir only; --matrix prints live capabilities
- [x] lessons [--promote] and eject --force (Phase-4 COMMANDS table entries)
- [x] 27 tests green incl. both goal lines; CLI exits verified live (doctor 0/3, sync 0/3)

## Review
- Orphan detection rides the lockfile: file tracked but no longer produced → flagged.
- Write-back validates the manifest before writing; an invalid lift aborts cleanly.

# Next: Phase 5 — registry federation (awesome-copilot + ecc importers, SHA pinning, update)
