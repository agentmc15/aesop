# CLI specification

Conventions: every command supports `--json` (machine output, agent-native), `--dry-run` where it
writes, `--cwd <path>`. Exit codes: `0` ok · `1` error · `2` validation failure · `3` drift/audit
findings (CI-friendly). The full surface is also exposed via `aesop mcp serve` so agents can
drive Aesop mid-session.

## `aesop init`
Detect → interview → write `aesop.yaml` → first compile.
- Detection: lockfiles/manifests → stack; package scripts/Makefile/CI → build/test/lint;
  workspace globs → monorepo; existing `CLAUDE.md`/`AGENTS.md`/`.cursor/rules`/`.github/copilot-*`
  → **imported** via each emitter's `importExisting()` (never clobbered).
- Interview (skippable with `--yes` + flags): invariants, models + different-family judge, risk
  posture, review bandwidth, harnesses, pathway, registries.
- Flags: `--harness <list>` `--pathway <name>` `--from-existing` (import-only, no interview).
- Ends by printing the three problems no loop solves (verification, comprehension debt, cognitive
  surrender). Not a joke; a contract.

## `aesop compile`
Manifest → native files for every selected harness.
- Idempotent; preserves outside-fence content byte-for-byte.
- Flags: `--check` (CI mode: exit 3 if output would differ), `--harness <id>` (subset),
  `--pathway <name>` (one-off override), `--verbose` (shows capability fallbacks).

## `aesop sync`
Compare fenced regions against lockfile hashes.
- Reports drift per file; `--accept` regenerates, `--write-back` lifts manual in-fence edits into
  the manifest (instruction edits map automatically; structural edits prompt).
- Exit 3 on drift → wire into CI alongside `compile --check`.

## `aesop doctor`
The audit (checks table in [`02-architecture.md`](02-architecture.md) §5).
- `--fix` applies safe fixes (create `tasks/`, add missing stops with profile defaults).
- `--matrix` re-validates harness capabilities vs installed versions.

## `aesop add <type> <name> [--from <registry>]`
Types: `skill` `agent` `command` `mcp` `hook` `instructions` `loop`.
- Resolves across declared registries (nearest-wins; `--from` pins), normalizes foreign formats
  (awesome-copilot, ecc) into canonical schemas, SHA-pins in `.aesop/lock.json`, recompiles.
- `aesop remove <type> <name>` inverse; `aesop list [type] [--available]` to browse.

## `aesop goal <name> | --new`
Author/emit goal recipes (schema in [`04-primitives.md`](04-primitives.md) §8).
- Validates the three hard stops + a runnable `verify` command; refuses otherwise.
- Output per harness: `/goal` invocation text (Claude Code, Codex) or Ralph runner config
  (Cursor, Copilot); `--run` launches where the harness CLI supports it.

## `aesop bundle [--format claude-plugin|copilot-plugin|tarball]`
Package current environment for distribution; emits marketplace metadata where applicable.

## `aesop update`
Fetch registry heads; show reviewable diff per pinned primitive; `--apply` after review only.
A prompt change is a code change.

## `aesop lessons ["text"]`
Append to `tasks/lessons.md`; `--promote` lifts a lesson into an instruction rule in the
manifest and recompiles. Boris's mistake→rule, as a verb.

## `aesop profile <list|show|new|set>`
Manage pathway profiles; `new <name> --from balanced` forks.

## `aesop eject`
Strip fences, delete manifest/lockfile (with confirmation), leave native files in place.

## `aesop mcp serve`
Stdio MCP server exposing: `compile`, `sync`, `doctor`, `add`, `list`, `lessons`, `goal` as
tools — schemas mirror the CLI flags. The agent that hits a missing skill installs it without
leaving its loop.
