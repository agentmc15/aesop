# CLI reference (as built, v0.1.0)

Global conventions:

- Every command supports `--json` (machine output — agents are first-class callers) and
  `--cwd <path>` (operate on another directory; defaults to the current one).
- **Exit codes:** `0` success · `1` error (bad usage, missing file, failed fetch) ·
  `2` validation failure (schema, locked-interface violations) · `3` findings
  (drift from `compile --check`/`sync`, doctor findings, a goal halted by a hard stop).
  `3` is the CI-friendly "nothing crashed, but you should look" code.
- The same surface is exposed to agents via [`aesop mcp serve`](#aesop-mcp-serve).

---

## `aesop init`

Detect the project → interview for what can't be detected → write `aesop.yaml` → done
(run `aesop compile` next).

```bash
aesop init                          # interactive interview (TTY only)
aesop init --yes                    # defaults, no questions
aesop init --yes --harness claude-code,codex --pathway balanced
aesop init --force                  # overwrite an existing aesop.yaml
```

| Flag | Effect |
|---|---|
| `--yes`, `-y` | skip the interview; also implied on non-TTY stdin |
| `--harness a,b` | select harnesses (default: inferred from existing agent files, else `claude-code,codex`) |
| `--pathway p` | starting profile (default `token-lean` — turn the dial up only where accuracy pays) |
| `--force` | overwrite an existing `aesop.yaml` |

Detection: stack from lockfiles/manifests (node/ts, python, go, rust); build/test/lint commands
with precedence *package.json scripts > Makefile targets > language defaults > CI workflow scan*;
monorepo packages from workspaces; harnesses inferred from existing agent files. Existing
`CLAUDE.md` / `AGENTS.md` / `.github/copilot-instructions.md` / `.cursor/rules/*.mdc` /
`GEMINI.md` are **imported into the manifest as instruction blocks** — never clobbered.

If no test command is detectable and the interview is skipped, the manifest gets the explicit
placeholder `TODO: set your test command` — schema-valid, and `doctor` flags it until fixed.

## `aesop compile`

Render `aesop.yaml` through the active pathway profile into every selected harness's native
files. Idempotent; content outside `<!-- aesop:begin -->…<!-- aesop:end -->` fences is preserved
byte-for-byte.

```bash
aesop compile                       # write all files + .aesop/lock.json
aesop compile --check               # CI mode: exit 3 if any file would change, write nothing
aesop compile --harness claude-code # subset of selected harnesses
aesop compile --pathway accuracy-max  # one-off pathway override (manifest untouched)
aesop compile --verbose             # also print every capability fallback per harness
```

## `aesop sync`

Diff every managed file against what the manifest would produce.

```bash
aesop sync                # report drift; exit 3 if any
aesop sync --accept       # regenerate drifted files (outside-fence content survives)
aesop sync --write-back   # lift lines added INSIDE the AGENTS.md fence into a manifest
                          # instruction block, then recompile (mistake → rule, mechanized)
```

Drift kinds: `edited` (with the first differing line number), `missing` (file deleted),
`orphaned` (the lockfile tracks it but the manifest no longer produces it — you removed a
primitive). Edits *outside* the fences are not drift; preservation is the contract.
`--write-back` on non-instruction files reports "structural edit — fold into aesop.yaml by hand."

## `aesop doctor`

The eight-point environment audit. Exit 3 on any finding.

```bash
aesop doctor              # audit
aesop doctor --fix        # also create the missing state dir files (the only auto-fix)
aesop doctor --matrix     # print live emitter capabilities to compare with docs/03
```

| Code | Checks |
|---|---|
| `verify-loop` | the test command exists, isn't the TODO placeholder, and **actually runs** (120 s timeout) |
| `mcp-dead` | every stdio MCP server's binary resolves on PATH |
| `schema` | manifest is schema-valid — including goal recipes carrying all three stops |
| `instructions-oversize` | no emitted instruction file exceeds 300 lines |
| `secret` | no committed credentials in `aesop.yaml` or any lock-tracked file (reported as `file:line`) |
| `yolo` | `--dangerously-skip-permissions` only with `permissions.unattended: devcontainer` (the block-dangerous-commands hook quoting the flag doesn't count) |
| `state-dir` | `tasks/todo.md` and `tasks/lessons.md` exist |
| `judge-family` | judge model family differs from the primary |

## `aesop add` / `aesop remove` / `aesop list`

Manage primitives across federated registries.

```bash
aesop add skill verify-loop                       # search declared registries in order
aesop add agent code-reviewer --from ecc          # pin a registry by short name
aesop add instructions react --from awesome-copilot
aesop remove skill tdd-workflow                   # manifest edit + recompile + delete orphans
aesop list                                        # installed primitives
aesop list agent --available                      # browse every declared registry
```

Addable types: `skill`, `agent`, `command`, `instructions` (mcp/hooks/loops are authored in
`aesop.yaml` directly). Non-builtin content is normalized to canonical form and **vendored**
into `.aesop/vendor/<registry>/` — tracked in git, SHA-pinned via `.meta.json`, so compiles work
offline and imports are reviewable. Instruction imports become provenance-marked manifest blocks.

## `aesop update`

Re-fetch every vendored registry, re-normalize, and diff against the vendored copy.

```bash
aesop update              # changed-line preview per primitive; applies NOTHING
aesop update --apply      # rewrite vendor + provenance-marked blocks, recompile
```

A prompt change is a code change: review the diff, then apply.

## `aesop goal`

Author and run goal recipes (the loops primitive).

```bash
aesop goal list
aesop goal show green-tests                       # the recipe doc incl. paste-ready /goal text
aesop goal new fix-lint --goal "lint passes with zero warnings" --verify "npm run lint" \
  [--max-iterations 30] [--no-progress-after 3] [--budget-usd 10]   # stops default from the pathway
aesop goal run green-tests                        # portable Ralph loop, default agent: claude -p
aesop goal run green-tests --agent 'codex exec "$AESOP_PROMPT"'     # any CLI reading $AESOP_PROMPT
```

`goal run` exits `0` when the verify command passes, `3` when a hard stop halted the loop
(`max_iterations` / `no_progress` / `budget`). Per-tick state persists in
`.aesop/goals/<name>.state.json`. See [guides/goals-and-loops.md](guides/goals-and-loops.md).

## `aesop lessons`

```bash
aesop lessons "Never call the payments API in tests; use the sandbox."
aesop lessons "…" --promote       # also add it as an instruction rule everywhere + recompile
```

## `aesop bundle`

Package the compiled environment for distribution (output in `.aesop/bundle/`, gitignored).

```bash
aesop bundle                                  # default: claude-plugin (+ marketplace.json)
aesop bundle --format copilot-plugin          # agents/ prompts/ instructions/ skills/ dirs
aesop bundle --format tarball                 # tar.gz of every managed file
```

## `aesop profile`

```bash
aesop profile list                # builtin: accuracy-max, balanced, token-lean (+ custom)
aesop profile show balanced
```

Custom profiles: drop a YAML file at `.aesop/profiles/<name>.yaml` (same shape as
`profiles/*.yaml`); it takes precedence over a builtin of the same name and can be referenced
from `pathway.profile`. (A `profile new` scaffold command is future work.)

## `aesop eject`

```bash
aesop eject --force       # strip fences (content stays), delete aesop.yaml and .aesop/
```

The one deliberately destructive command, hence the mandatory `--force`. The native files are
yours afterward; nothing else changes.

## `aesop mcp serve`

Stdio MCP server exposing `compile`, `sync`, `doctor`, `add`, `list`, `lessons`, `goal_list`,
`goal_run` as tools (every tool takes an optional `cwd`). Register it with any MCP-capable
harness so the agent can repair and extend its own environment mid-session — see
[guides/agent-driven.md](guides/agent-driven.md).
