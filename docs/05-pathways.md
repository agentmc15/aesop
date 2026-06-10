# Pathways — the cost/accuracy dial

A pathway is a YAML profile ([`../profiles/`](../profiles/)) consumed twice:
- **Compile time:** decides which primitives exist in the emitted environment (reviewer subagent?
  LLM judge? orchestration?), which models are pinned, what loop budgets are written into goal
  recipes and settings.
- **Run time:** loops read the same numbers (iteration ceiling, no-progress, budget).

## The three calibrations

| Parameter | accuracy-max | balanced | token-lean |
|---|---|---|---|
| reasoning.effort | xhigh | high | medium/fast |
| model_tier | strong | strong | cheap |
| retrieval.strategy | corrective + decomp + graph | router (+corrective) | router / fixed top-k |
| top_k | 12 | 8 | 5 |
| verify_subagent | yes | yes | no |
| reviewer_subagent | yes (strong) | no | no |
| llm_judge | yes | no | no |
| multi_agent | yes | when needed | no |
| compaction | summarize | summarize | truncate |
| max_iterations | 80 | 40 | 20 |
| no_progress_stop | 4 | 3 | 2 |
| budget_usd | 100 | 25 | 5 |

**Choosing:** start `token-lean` (Osmani: best-practice lists assume a token budget you probably
don't have; subagents and judges burn tokens — add them only where a second opinion pays).
`balanced` is the daily driver. `accuracy-max` for migrations, security, anything irreversible.

## Two non-negotiables at every setting

1. **The three hard stops stay on.** Only the numbers change; even accuracy-max keeps a dollar
   ceiling — an unbounded loop is the failure mode regardless of pathway.
2. **Safety never relaxes.** token-lean drops the *extra review pass*, never the
   untrusted-tool-output rule, least privilege, secret hygiene, or human gates on irreversible
   actions.

## Overrides and routing

- **Per-task:** `aesop compile --pathway accuracy-max` (or `aesop goal … --pathway …`) before
  high-stakes work; revert after.
- **Per-intent routing** (product loops): route by class — FAQ → lean, billing/account →
  accuracy-max with a verify pass.
- **Per-verifiability** (Karpathy's law): autonomy scales with how checkable the work is. High
  autonomy on test-covered refactors and lint sweeps; plan-gated low autonomy on novel design.
  Encoded as `autonomy:` hints in goal recipes.
- **Custom points:** `aesop profile new <name> --from balanced` forks a calibration; the dial is
  continuous, the three files are starting points. Profiles also generalize beyond cost to
  *posture* tiers (e.g. `baseline → hardened → regulated`) for compliance-shaped projects.
