# Contributing to Aesop

Thanks for contributing. This repo has a few unusual, load-bearing rules — most first PRs that
get rejected violate one of these, so read this before writing code.

## Setup

```bash
npm ci
npm test        # build + 60-odd tests (node:test, no test framework dependency)
npm run lint    # tsc --noEmit
```

Node ≥20. CI runs the suite on Node 20 and 22 across Linux, macOS, and Windows, then gates on
`aesop compile --check` and `aesop doctor` against this repo's own manifest (see Dogfood below).

## The rules that will fail your PR

1. **`src/types.ts` and `schemas/aesop.schema.json` are LOCKED.** Changing either is a breaking
   change to the manifest contract that keeps six emitters comparable. Open an issue first;
   don't include a schema change as a side effect of a feature.
2. **`docs/03-harness-matrix.md` changes BEFORE the emitter it describes** (doc first, then
   code — ideally separate commits). `src/capabilities.test.ts` asserts every emitter's
   `capabilities()` against the doc's table cell-for-cell; change both or CI fails.
3. **Golden fixtures are the compiler's contract.** `fixtures/compile/*/expected/` is compared
   byte-for-byte. Never regenerate them by reflex to make a test pass — regenerate deliberately,
   read the whole diff, and explain it in the PR. An unexplained golden diff is a red flag.
4. **Emitters are pure functions** (manifest, primitives, profile) → files. No filesystem,
   network, or clock inside `emit()`; all I/O lives in the CLI shell (`src/index.ts` +
   `src/commands/`). Library code throws `AesopError`; only the shell exits.
5. **Emitted files reference secret NAMES only, never values.**
6. **Goal recipes without all three hard stops** (iteration ceiling, no-progress detector,
   budget ceiling) **must fail validation** — never default them in silently.
7. **No new runtime dependencies** without prior agreement (currently `yaml` and `ajv` only).
   Dev dependencies are also kept minimal — the test suite is plain `node:test`.
8. **Commits carry no AI co-author trailers or generated-with footers.**

## Dogfood

This repo's own agent environment is compiled by Aesop from `aesop.yaml`. Everything under
`.claude/`, `.codex/`, `.cursor/`, `.github/` (instructions/agents/prompts/skills), `.vscode/`,
`.agents/`, plus `AGENTS.md`, `CLAUDE.md`, and `GUARDRAILS.md` is **generated** — edit
`aesop.yaml` (or the registry seeds) and run `node dist/index.js compile`, never the emitted
files inside their `aesop:begin` fences. CI fails on fence drift.

## Working style

- One reviewable change per PR; every changed line should trace to the stated purpose.
- New behavior lands with tests. Roadmap-phase work encodes its Goal line verbatim in a test.
- Match the existing code style, even where you'd personally do it differently.
- `PLAN.md` is the master plan; `docs/01–08` are the specs. When code and spec disagree, fix the
  spec in the same PR or say why not.
