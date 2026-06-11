# Phase 6 — loops + goals ✅ (2026-06-10)

Goal: one recipe to verified completion via native /goal AND via the Ralph runner; all three
stops halt correctly when forced.

## Done
- [x] render.ts: goal doc (+/goal paste text + cron), ralph.json, fixed Ralph prompt (anchored
      to tasks/), orchestration.md (max_parallel = review_bandwidth)
- [x] compile core emits goal + orchestration files; claude-code/codex emit goal-<name>
      command/prompt wrappers
- [x] src/loops/ralph.ts — fresh agent per tick, verify-first short-circuit, cost from trailing
      JSON (claude -p) or estimate, per-tick state file, three hard stops
- [x] aesop goal list | show | new (profile-default stops) | run [--agent] (exit 0/3)
- [x] Ralph half of goal line: verified completion + iteration/no-progress/budget all forced
      and halting correctly (4 E2E tests); native half at emission level (live /goal run →
      Phase 7 dogfood, needs interactive session + spend)
- [x] Goldens regenerated (59 files; .aesop/ outputs now golden-tracked except lock/cache)
- [x] 40 tests green; CLI smoke: new → run (verified in 3 ticks) → re-run (0 ticks, $0)

## Review
- Progress detection rides the verify command's output hash — recipes should print a progress
  signal in verify (documented in each emitted recipe doc).
- goalCommand wrapper lives in claude-code emitter; codex imports it (same text both sides).

# Next: Phase 7 — bundle + MCP serve + npm publish + dogfood (aesop manages its own repo)
