# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed

- **Windows support** (#4): registry short names now derive correctly from
  Windows `path:` sources (both in federation and the F6 collision rule), and
  `doctor`'s exec probes are platform-aware (`where` on win32, `command -v`
  elsewhere — still argv-only, no shell interpolation). The full test suite is
  green on windows-latest and the CI Windows legs now gate merges.
- Internal missing-template invariant now fails through the typed `AesopError`
  path instead of a raw stack trace.
- `npm audit` clean (esbuild dev-dependency advisory GHSA-g7r4-m6w7-qqqr).

### Changed

- CI now tests Node 20 and 22 across Linux, macOS, and Windows (the Windows
  legs are non-gating pending #4), gates on `npm audit`, and reports test
  coverage; Dependabot watches npm and Actions.
  Line-ending rewrites are disabled repo-wide (`.gitattributes`) so the
  byte-for-byte golden fixtures survive Windows checkouts.
- A monthly workflow opens an issue when `docs/03-harness-matrix.md` passes
  its own 90-day re-verification window.
- Contribution scaffolding: CONTRIBUTING.md (the load-bearing rules), issue
  and PR templates, READMEs for `registry/commands/` and `registry/hooks/`.

### Added

- **`aesop init --refresh`** — re-run detection against an existing manifest
  and report drift in detected fields (commands, stack, monorepo); exit 3 on
  unapplied drift, `--write` to apply. Interviewed fields are never touched,
  and detection finding nothing never removes a manifest value.
- **`aesop profile new <name> --from <base>`** — fork a pathway calibration
  into `.aesop/profiles/<name>.yaml` (comment-preserving copy; refuses
  overwrite). `aesop profile show` now resolves custom profiles too.
- **Antigravity native skills** — skills now emit to
  `.agents/skills/<name>/SKILL.md` (location pinned July 2026 in the harness
  matrix) instead of the referenced-from-AGENTS.md fallback.

## [0.1.0] — 2026-06-12

First release. An environment compiler for AI coding agents: one manifest
(`aesop.yaml`) compiled into native configuration for six harnesses.

### Added

- **CLI** — `init` (detect + interview), `compile` (`--check` for CI), `sync`
  (drift detection, `--write-back` lifts in-fence edits into the manifest),
  `doctor` (8-point environment audit, `--fix`), `add`/`remove`/`list`,
  `update` (reviewable registry diffs, never auto-applied), `goal` (recipes
  with three hard stops), `bundle` (claude-plugin · copilot-plugin · tarball),
  `lessons` (mistake → rule, `--promote`), `profile`, `eject` (no lock-in),
  and `mcp serve` (the whole surface as an MCP server). Every command
  supports `--json`.
- **Emitters** for Claude Code, Codex CLI, GitHub Copilot, Cursor,
  Antigravity, and VS Code — native forms (`.mdc` rules with `alwaysApply`,
  path-scoped `.instructions.md`, `GUARDRAILS.md`, hooks, settings), never
  lowest-common-denominator. All emitted files carry `aesop:begin` fences;
  hand-written content outside the fence survives recompiles.
- **Federated registries** — builtin seeds (8 agents, 7 skills, 4 commands,
  2 hooks) plus `github:` and `path:` sources with SHA pinning; importers
  normalize ecc and awesome-copilot formats. Verified live against
  `github:affaan-m/ecc` and `github:github/awesome-copilot`.
- **Pathways** — `accuracy-max` / `balanced` / `token-lean` profiles applied
  at compile time; per-task override via `compile --pathway`.
- **Goal loops** — native `/goal` emission where it exists, portable Ralph
  runner where it doesn't; every recipe requires a verify command and the
  three hard stops (iteration ceiling, no-progress detector, budget ceiling).
- **Security hardening** — 8 audit findings (path traversal, hostile
  frontmatter, secret scanning, injection surfaces) remediated with
  regression tests.
- **Dogfood** — this repository's own agent environment is compiled by Aesop
  for all six harnesses; CI gates `compile --check` and `doctor`.

### Notes

- Published as `@agentmc15/aesop` (the bare npm name was already taken);
  the binary is still `aesop`.
