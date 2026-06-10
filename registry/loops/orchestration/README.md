# Orchestration — loops supervising loops

The Stage-5 pattern (the "Gas Town / Mayor" design): an orchestrator agent plans and assigns work;
a pool of worker agents run in isolated worktrees; review/patrol agents run their own continuous
loops; and shared state lives in git so work survives a crash. **The loop is the unit of work.**

Why this isn't "just cron": cron gives you scheduling only. What it can't express is a
decision-maker in the body, one loop supervising others concurrently, and durable shared state with
crash recovery. Stack those and you have something cron cannot.

## Files
- `orchestrator.py` — runnable simulation of the Mayor loop over a mock PR queue (no network). One
  tick: dispatch a worker per PR (isolated worktree) → worker self-verifies → review agent scans →
  checkpoint state → check the three hard stops.
- `state.schema.json` — the durable-state contract (`run_id`, `iteration`, `usd_spent`,
  `halt_reason`, per-PR status). This is what survives a restart.
- `pr-babysitter.loop.yaml` — the canonical "babysit all my PRs" loop, as a spec.
- `cron.example` — scheduling it (cron, or Claude Code `/loop`/Routines, or Codex Automations).

## Run
```bash
python orchestrator.py --demo
```

## The durable upgrade over ralph
ralph assumed your terminal stayed open; this assumes it doesn't. State lives in git, so a crash, a
restart, or closing your laptop resumes from the last checkpoint instead of starting over. And once
the model writes code for almost nothing, **the expense moves to the loop running it** — which is
why every guardrail is a halt condition, not a feature.

> Worktrees take away the mechanical collisions of parallel agents, but **your review bandwidth is
> still the ceiling** on how many you can actually run. Build the loop; stay the engineer.
