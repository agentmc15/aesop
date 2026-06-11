# Goals & loops

A goal is a task with a **mechanical stopping condition**: a shell command whose exit code
proves the work is done. That one constraint is what makes unattended agents safe to run —
"done" stops being a vibe and becomes a verifiable fact.

## Anatomy of a recipe

```yaml
# aesop.yaml
loops:
  - name: green-tests
    goal: the full test suite passes
    verify: npm test            # exits 0 ⇒ done. Required — no verify, no recipe.
    plan_gate: true             # agree on a plan before execution
    stops:                      # ALL THREE required; schema rejects a recipe without them
      max_iterations: 40
      no_progress_after: 3
      budget_usd: 25
```

Or from the CLI (stops default from your active pathway):

```bash
aesop goal new green-tests --goal "the full test suite passes" --verify "npm test"
```

Compiling a recipe produces, automatically:

| File | What it's for |
|---|---|
| `.aesop/goals/<name>.md` | the recipe doc — paste-ready `/goal` text, runner usage, cron example |
| `.aesop/goals/<name>.ralph.json` | portable runner config (prompt, stops, agent command) |
| `.claude/commands/goal-<name>.md` | `/goal-<name>` slash command in Claude Code |
| `.codex/prompts/goal-<name>.md` | the same for Codex |
| `.aesop/orchestration.md` | the parallel-agents pattern, capped at your review bandwidth |

## Way 1 — native `/goal` (Claude Code ≥ 2.1.139, Codex CLI)

```bash
aesop goal show green-tests
```

```
/goal the full test suite passes — verified when `npm test` exits 0. Stop after 40 iterations, 3 no-progress turns, or $25.
```

Paste that into the harness. Its own evaluator keeps the agent working across turns until the
condition is met. Use native `/goal` when you're at the keyboard in a harness that has it — it's
the smoothest experience.

## Way 2 — the portable Ralph runner (any harness, unattended)

```bash
aesop goal run green-tests                                     # default agent: claude -p
aesop goal run green-tests --agent 'codex exec "$AESOP_PROMPT"'  # any CLI that reads $AESOP_PROMPT
```

```
  tick 1: not yet (≈$0.25)
  tick 2: not yet (≈$0.50)
  tick 3: VERIFIED (≈$0.75)
✓ goal 'green-tests' VERIFIED in 3 iteration(s) (cost ≈ $0.75)
```

How it works — the classic Ralph shape, productized:

1. **Verify first.** If the goal is already met, zero ticks, zero dollars.
2. **Fresh agent every tick, fixed prompt.** Context never accumulates; the prompt re-anchors
   each session to `tasks/todo.md` and `tasks/lessons.md` ("you have no memory of previous
   sessions — the tasks/ files are your memory").
3. **Verify after every tick.** The verify command is the only judge.
4. **Cost tracking** — parsed from `claude -p --output-format json` (`total_cost_usd`), or
   estimated per tick for agents that don't report.
5. **Durable state** — `.aesop/goals/<name>.state.json` updates every tick; a crashed run
   resumes from disk truth, not from memory.

Exit codes: `0` verified · `3` halted by a stop. So a goal run drops straight into scripts/CI.

## The three hard stops

Most of the job of running a loop is making sure it halts. Every recipe carries all three —
the schema literally rejects a recipe missing any:

| Stop | Triggers when | Tune it when |
|---|---|---|
| `max_iterations` | the tick counter hits the ceiling | bigger task → raise deliberately, never reflexively |
| `no_progress_after` | the **verify command's output** is identical N consecutive ticks | your verify prints nothing — see below |
| `budget_usd` | accumulated cost crosses the line | never remove; even accuracy-max keeps one |

**Make your verify command print a progress signal.** The no-progress detector measures progress
through the verification lens: identical output N ticks in a row ⇒ nothing is moving. A bare
`test $(...)` prints nothing and looks identical even while the agent works, so print the number:

```bash
# weak: silent — no-progress can fire spuriously
verify: test $(npm test 2>&1 | grep -c PASS) -ge 80
# strong: the count is the progress signal
verify: npm test 2>&1 | grep -c PASS && test $(npm test 2>&1 | grep -c PASS) -ge 80
```

(Real test runners print counts naturally — `npm test`, `pytest`, `cargo test` are all fine
as-is.)

When a run halts, the summary tells you where to look:

```
✗ goal 'green-tests' halted: no-progress after 2 iteration(s) (cost ≈ $0.50)
the loop stopped honestly — review .aesop/goals/green-tests.state.json and tasks/todo.md before raising the stops
```

Don't reflexively raise the stop that fired. A no-progress halt usually means the goal is
under-specified or the agent is missing a fact — fix the recipe or add the invariant, then rerun.

## Scheduling (discovery loops)

The recipe doc includes a cron line:

```cron
0 7 * * 1-5  cd /path/to/repo && aesop goal run nightly-triage --json >> .aesop/goals/nightly-triage.runs.jsonl
```

Pattern: a *discovery* goal (triage CI failures, flag unanswerable issues, audit drift) runs on a
cadence, writes findings to `tasks/todo.md`, and you — or a worker goal — pick them up. On
harnesses with native schedulers (Claude Code Routines, Antigravity scheduled tasks), point the
schedule at the same recipe text.

## Orchestration (parallel goals)

`.aesop/orchestration.md` is compiled with your numbers baked in. The shape:

- **One worktree per agent** (`git worktree add …`) — mechanical collisions gone.
- **max_parallel = your `review_bandwidth`**, not your CPU count. Worktrees make parallelism
  free; your capacity to review what ships is the real ceiling.
- **Mayor/workers:** a triage loop maintains `tasks/todo.md`; each worker runs one recipe in its
  own worktree; every maker's diff meets a checker before merge.
- **State in git + `tasks/`** — a crashed loop resumes from disk.

## Three things no loop solves

A smoother loop makes these sharper, not easier: **verification is still yours** (a loop running
unattended is making mistakes unattended — the verify command proves the criterion, not the
quality), **comprehension debt** (read what the loop made), and **cognitive surrender** (design
the loop with judgment, not to avoid thinking). Build the loop; stay the engineer.
