# Goal: green-tests

- **Goal:** the full test suite passes
- **Verify (the stopping condition):** `npm test` — exits 0 ⇒ done. "Done" is a claim; this is the proof.
- **Plan gate:** on — agree on a plan before execution
- **Hard stops:** 40 iterations · 3 no-progress · $25

## Native /goal (Claude Code ≥2.1.139, Codex CLI)

Paste:

```
/goal the full test suite passes — verified when `npm test` exits 0. Stop after 40 iterations, 3 no-progress turns, or $25.
```

## Portable Ralph runner (any harness)

```bash
aesop goal run green-tests            # default agent: claude -p
aesop goal run green-tests --agent '<any agent CLI reading $AESOP_PROMPT>'
```

Fresh agent each tick, fixed prompt, verify after every tick, all three stops enforced.
Progress is measured through the verify command's output — make `npm test` print a
progress signal (test counts, error counts) so the no-progress detector can see movement.

## Schedule it (discovery loops)

```cron
0 7 * * 1-5  cd $(pwd) && aesop goal run green-tests --json >> .aesop/goals/green-tests.runs.jsonl
```
