# Subagents

The single highest-value structure in agentic work is **maker ≠ checker**: the model that wrote
the code is too lenient grading its own homework. Subagents are how you encode that — plus cheap
parallel exploration that keeps the main context clean.

## The eight seed roles

| Role | Job | Tier/effort | Edits? |
|---|---|---|---|
| `explorer` | map the code before any change ("where is X, how does Y work") | cheap / fast | no |
| `researcher` | gather sourced evidence (docs, tickets, web) | mid / medium | no |
| `implementer` | make the change once a plan exists | strong / high | yes |
| `verify-app` | PROVE it: build, test, lint, smoke-check; PASS/FAIL with evidence | mid / medium | no |
| `code-simplifier` | last pass on the diff only; no behavior change | mid / medium | yes |
| `spec-reviewer` | review against spec + conventions; didn't write the code — that's the point | strong / high | no |
| `security-reviewer` | injection, authz, secrets, SSRF — anything touching trust boundaries | strong / high | no |
| `critic` | adversarial challenge of high-stakes plans before committing | strong / high | no |

```bash
aesop add agent security-reviewer
aesop add agent code-reviewer --from ecc      # or pull from a federated registry
```

## The pathway prunes for you

Which selected agents actually get emitted depends on the dial
([Pathways](pathways.md)):

- `token-lean` — verify-app and all reviewers pruned (inline self-check only; no second model
  to pay for). Explorer survives — it's cheap and protects context.
- `balanced` — verify-app in; reviewers (critic, spec-reviewer, security-reviewer) pruned.
- `accuracy-max` — everything you selected, reviewers pinned strong/high.

`aesop compile` prints every prune as a note, and `--pathway accuracy-max` restores the
reviewers for one risky task without touching the manifest.

## What each harness gets

Native subagents on Claude Code (`.claude/agents/*.md`), Codex (`.codex/agents/*.toml`), and
Copilot (`.github/agents/*.md`). Cursor, Antigravity, and VS Code have no first-class subagents,
so each role also lands as a **role prompt** at `.aesop/roles/<name>.md` — open a second
session/tab, paste the role, and you have your checker. Same words, every harness.

## Authoring a role

One markdown file, canonical frontmatter:

```md
---
name: api-contract-reviewer
description: Review any change under packages/api for breaking contract changes. Read-only.
tools: [read, grep]
model: strong
effort: high
edits: false
---

Compare the changed handlers and schemas against the OpenAPI spec in api/openapi.yaml.
Flag: removed/renamed fields, type changes, new required params, status-code changes.
Report as `endpoint — change — consumer impact — fix`. Approve only if a deployed client
built against the old spec keeps working.
```

Field notes:

- **`tools`** — narrowest set that does the job, from: `read`, `grep`, `glob`, `edit`, `bash`,
  `search`, `mcp`. Aesop maps them per harness (`edit` → Edit+Write on Claude Code;
  `read_only = true` in Codex TOML when `edits: false`).
- **`model` is a tier**, not a model name — `cheap`/`mid`/`strong` map to whatever each harness
  calls them (haiku/sonnet/opus on Claude Code today; the matrix doc governs). Your roles
  survive model generations.
- **Reviewers get `strong` + `high`** — pay for the second opinion where it pays you back.
  Explorers get `cheap` + `fast` — they run constantly.
- **One job per role.** A "review everything" agent reviews nothing well.

Per-use overrides without editing the role file:

```yaml
agents:
  - explorer
  - { name: security-reviewer, model: strong, effort: xhigh }
```

## Using them well

- Delegate read-heavy and parallelizable work (exploration, research, verification) — it keeps
  the main agent's context window for the actual change.
- After the implementer claims done, send `verify-app` — "done" is a claim; the checker turns it
  into a proof.
- For parallel work: one worktree per agent, capped by your review bandwidth — see
  `.aesop/orchestration.md` in your compiled output and [Goals & loops](goals-and-loops.md).
