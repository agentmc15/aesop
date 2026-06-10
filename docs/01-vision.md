# Vision

## The problem

Setting up a *good* agentic environment for one harness takes a day of expertise: a tight
instruction file, skills with boring descriptions, maker/checker subagents, permission tiers,
hooks for hard policy, MCP wiring, a goal loop with real stopping conditions. Keeping it correct
across **six harnesses** — each with its own dialect, each shipping new primitives quarterly — is
a job nobody is staffed for. So teams either pick one harness and accept lock-in, or maintain N
hand-forked copies that silently drift.

## The bet

The primitives have converged (instructions, skills, subagents, commands, MCP, hooks,
permissions, loops/goals, state). Only the **file formats** differ. Convergence + divergent
dialects = a compiler problem. Aesop is that compiler, plus the three things a compiler enables:

1. **Detection & interview** — most of a manifest is derivable from the repo; only invariants,
   models, and risk posture need a human.
2. **Drift sync & audit** — generated output can be checked, regenerated, and written back. A
   hand-kept config can only rot.
3. **Federation** — content libraries (awesome-copilot, ecc, your org's standards) become
   *sources* normalized into one schema, instead of competing silos.

## Product principles

1. **Native over lowest-common-denominator.** Portability must never cost capability.
2. **The manifest is the only source of truth.** Everything emitted is regenerable.
3. **Agent-native.** `--json` everywhere, MCP server mode, schemas for all artifacts. Agents will
   run Aesop more than humans will (Karpathy's infrastructure point, applied to ourselves).
4. **Verifiability is the gate.** An environment without a runnable verify loop is unhealthy by
   definition. A goal without a measurable stopping condition doesn't validate.
5. **Safety never scales down.** The pathway dial trades cost vs depth of review — never the
   untrusted-input rules, least privilege, secret hygiene, or the three hard stops.
6. **No lock-in.** `aesop eject` leaves plain native files. The exit is a feature.
7. **Preserve human understanding.** Parallelism caps at stated review bandwidth; comprehension
   tooling ships in every environment; the three unsolvable problems are documented, not hidden.

## Non-goals

- Running the agent (the harness's job) · hosting models · replacing CI · a GUI (Phase ≤7) ·
  competing on registry volume (we federate).

## Name

Aesop told the same stories so they'd survive retelling in any tongue; each fable ends with the
moral made explicit. Same job here: one story (your project), every dialect (each harness), moral
attached (the guardrails).
