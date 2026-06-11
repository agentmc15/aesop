# `aesop.yaml` — annotated

Schema: [`../schemas/aesop.schema.json`](../schemas/aesop.schema.json). Locked at Phase 1; later
changes are breaking and need explicit justification.

```yaml
version: 1

project:
  name: acme-api
  stack: [typescript, node20, postgres]        # detected
  commands:                                    # detected from package scripts / Makefile / CI
    build: pnpm build
    test: pnpm test                            # doctor verifies these actually run
    lint: pnpm lint
  monorepo:
    packages: ["packages/*"]
  invariants:                                  # interview — the rules an agent would guess wrong
    - "Correlate accounts by persistent user ID, never email."
    - "All money math in integer cents."
  models:
    primary: { family: claude, tier: strong }
    judge:   { family: openai, tier: strong }  # different family than primary — enforced
  review_bandwidth: 2                          # max parallel agents a human will actually review

harnesses: [claude-code, codex, copilot, cursor]   # emitters to run; antigravity, vscode also valid

pathway:
  profile: balanced                            # accuracy-max | balanced | token-lean | custom
  overrides:                                   # sparse per-knob overrides of the profile
    budget_usd: 15

registries:
  - builtin
  - github:github/awesome-copilot
  - github:affaan-m/ecc
  # - github:your-org/agent-standards

primitives:
  instructions:
    template: builtin:AGENTS.template          # the canonical base (Karpathy's 11 + doctrine)
    blocks:
      - scope: project                         # rendered into every harness's project file
        content: |
          ## Domain rules
          - API handlers never touch the DB directly; go through repositories.
      - scope: "path:packages/web/**"          # path-scoped: applyTo / globs / nested files
        content: |
          React function components only; no class components.
    global:                                    # user-level, emitted outside the repo
      - "Plans before code for anything non-trivial."
  skills: [spec-first, verify-loop, lessons-loop, context-compaction]
  agents:                                      # pathway may prune: reviewer only at accuracy-max
    - explorer
    - verify-app
    - { name: security-reviewer, model: strong, effort: xhigh }
  commands: [commit-pr, fix-ci, add-learning]
  mcp: []                                      # thin by default (Boris); add when a workflow needs it
  hooks: [format-on-write, block-dangerous-commands]
  permissions:
    mutate_allow: ["pnpm *", "git commit *", "git push origin HEAD"]
    irreversible: ["git push origin main", "deploy", "db:migrate up"]
    unattended: devcontainer                   # the only sanctioned skip-permissions context
  loops:
    - name: green-tests
      goal: "all workspace tests pass"
      verify: pnpm test
      plan_gate: true
      stops: { max_iterations: 40, no_progress_after: 3, budget_usd: 25 }

state:
  dir: tasks/                                  # todo.md, lessons.md — read at session start
```

Notes:
- Anything **detected** can be re-detected by re-running `aesop init --force` in a scratch copy
  and diffing (a first-class `--refresh` flag is future work).
- Anything **interviewed** is the human's: sync never overwrites `invariants`, `models`,
  `review_bandwidth` without `--write-back` confirmation.
- `models.judge.family ≠ models.primary.family` is schema-enforced (the different-family-judge
  rule from the kit's eval doctrine).
- Goal recipes without all three `stops` fields fail validation — by design, not by default.
