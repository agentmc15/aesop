# Pathways — using the dial

The same primitives at different settings. The pathway decides, at compile time, which agents
exist, which models get pinned, and what the loop budgets are — and at run time, when loops halt.

## Choosing

| | `token-lean` | `balanced` | `accuracy-max` |
|---|---|---|---|
| use for | the starting point; cheap tasks, fast iteration | the daily driver | migrations, security, anything where a wrong answer is expensive |
| verification | inline self-check only | + verify-app subagent | + reviewer subagents (strong models) + judge |
| effort / model tier | medium / cheap | high / strong | xhigh / strong |
| stops (iter / no-progress / $) | 20 / 2 / $5 | 40 / 3 / $25 | 80 / 4 / $100 |

Start `token-lean`. The prescriptive best-practice lists assume a token budget you probably
don't have; subagents and judges burn real money. Turn the dial up only where a second opinion
pays for itself — and notice the dollar ceiling *never* disappears, even at accuracy-max: an
unbounded loop is the failure mode at every setting.

**What never changes with the dial:** the three hard stops stay on (only the numbers move), and
safety rules never relax — token-lean drops the *extra review pass*, not the untrusted-input
rule, least privilege, or human gates on irreversible actions.

## Setting it

```yaml
# aesop.yaml — the standing choice
pathway:
  profile: balanced
  overrides:          # sparse per-knob tweaks; stops can be tuned, never removed
    budget_usd: 15
```

```bash
aesop compile --pathway accuracy-max   # one-off override for a risky task; manifest untouched
aesop compile                          # back to the manifest's setting
```

The active pathway is visible to the agent too — it renders into `AGENTS.md`'s Project block
(`Pathway: balanced (effort high; stops: 40 iterations / 3 no-progress / $25)`), so the agent
knows its own budget.

## What concretely changes when you switch

- **Agent pruning** — `token-lean` emits no verify-app/reviewers; `balanced` adds verify-app;
  `accuracy-max` adds critic/spec-reviewer/security-reviewer (each prune is printed as a compile
  note). The `.claude/agents/`, `.codex/agents/` directories literally change contents.
- **Model/effort pinning** — roles without explicit pins inherit the profile tier.
- **Loop budgets** — `aesop goal new` defaults its stops from the active profile; goal docs and
  `GUARDRAILS.md` render the numbers.
- **Compaction posture** — summarize vs truncate guidance in the rendered instructions.

## Custom profiles

Drop a YAML at `.aesop/profiles/<name>.yaml` (same shape as the builtins — copy one):

```bash
mkdir -p .aesop/profiles
aesop profile show balanced > .aesop/profiles/nightly.yaml
# edit: effort high, budget_usd 8, reviewer_subagent true …
```

```yaml
pathway:
  profile: nightly
```

Custom profiles shadow builtins of the same name and live with the repo, so the whole team gets
the same calibration. `aesop profile list` shows both sources.

Profiles also generalize beyond cost — posture tiers (`baseline` → `hardened` → `regulated`)
for compliance-shaped projects work the same way: fork a profile, raise the verification knobs,
reference it per-repo or per-task.

## Routing by intent (product loops)

If your loops serve different request classes, route the pathway by class instead of picking one
globally: FAQ-shaped work on `token-lean`, billing/account changes on `accuracy-max` with a
verify pass. Concretely: define one goal recipe per class with stops to match, or run
`compile --pathway` in the dispatcher before invoking the harness. Karpathy's law is the
routing function: **autonomy scales with verifiability** — high autonomy on test-covered
refactors, plan-gated low autonomy on novel design.
