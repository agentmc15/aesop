# Addy Osmani — Loop Engineering (verified notes)

Source: [addyosmani.com/blog/loop-engineering](https://addyosmani.com/blog/loop-engineering/).

## Thesis

Stop prompting agents turn-by-turn; **"design the system that does it instead."** The leverage
point moved from prompt quality to **loop architecture**.

## The five primitives + state

| Primitive | Function |
|---|---|
| Automations | scheduled discovery & triage — run on cadence, surface findings unprompted |
| Worktrees | parallel agent isolation — separate working dirs prevent collisions |
| Skills | codified project knowledge (`SKILL.md`) — stop re-explaining intent every cycle |
| Plugins/connectors (MCP) | issue trackers, DBs, Slack, staging APIs — action beyond the filesystem |
| Sub-agents | maker/checker separation — models shouldn't grade their own work |
| State/memory | markdown files or boards outside context — "the agent forgets, the repo doesn't" |

Tool-agnostic: Codex and Claude Code both implement all five; "once you recognize the shape, tool
selection becomes secondary." (This is Aesop's existence proof — same shape, different dialects.)

## The standard daily loop

1. Automation runs on schedule → 2. triage skill reads CI failures / issues / commits →
3. findings written to markdown or Linear → 4. per finding: isolated worktree, explorer subagent,
reviewer subagent checks against skills & tests → 5. connectors open PRs, update tickets →
6. unhandled items surface in a triage inbox → 7. a state file tracks progress across cycles.

## Cautions (the loop still doesn't do this)

1. **Verification is yours.** "A loop running unattended is also a loop making mistakes
   unattended." Split verifiers strengthen claims; they don't guarantee correctness.
2. **Comprehension debt accelerates.** Faster shipping widens the gap between deployed code and
   your understanding unless you actively read.
3. **Cognitive surrender.** "Designing the loop is the cure when you do it with judgement and the
   accelerant when you do it to avoid thinking."

Plus two operational tensions:
- **Token costs vary wildly** — usage patterns differ enormously between token-rich and
  token-poor users. (→ Aesop's pathway dial is the spine of the product.)
- **Review bandwidth is the ceiling** — worktrees make parallelism technically free; your
  capacity to review determines real concurrency. (→ orchestration templates take `max_parallel`
  from the manifest's `review_bandwidth`.)

Final guidance: *"Build the loop. But build it like someone who intends to stay the engineer, not
just the person who presses go."*
