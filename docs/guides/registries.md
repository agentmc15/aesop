# Registries & updates

Aesop doesn't compete with content libraries — it **federates** them. Declare sources in the
manifest; `aesop add` normalizes whatever format they use into canonical primitives and vendors
the result into your repo, pinned and reviewable.

## Declaring sources

```yaml
# aesop.yaml
registries:
  - builtin                              # aesop's seed registry (ships with the package)
  - github:affaan-m/ecc                  # 64 agents · 261 skills · rules · hooks
  - github:github/awesome-copilot        # instructions · prompts · agents · skills · plugins
  - github:your-org/agent-standards      # your company's blessed set
  - path:../shared-agent-registry        # any local checkout (great for monorepos/airgapped)
```

The short name used with `--from` is the last path segment: `ecc`, `awesome-copilot`,
`agent-standards`, `shared-agent-registry`.

## Adding content

```bash
aesop add agent code-reviewer --from ecc
aesop add instructions react --from awesome-copilot
aesop add skill tdd-workflow --from ecc        # found even in ecc's skills/<domain>/<name> nesting
aesop add command changelog --from awesome-copilot   # .prompt.md files import as commands
aesop add skill verify-loop                    # no --from: search declared registries in order
```

What happens on `add`:

1. **Fetch** — GitHub sources shallow-clone into `.aesop/cache/` (gitignored); `path:` sources
   read in place.
2. **Normalize** — foreign formats become canonical: Claude-format agents (comma-string tools,
   `model: opus`) → tier/effort/edits; awesome-copilot `.instructions.md` with `applyTo` →
   path-scoped instruction blocks; `rules/*.md` → project blocks; `.prompt.md` → commands.
3. **Vendor** — the normalized content lands in `.aesop/vendor/<registry>/…`, **tracked in
   git**, with the upstream SHA pinned in `.meta.json`. Compiles never need the network again,
   and the import is reviewable in your PR — registry content is untrusted input until you've
   read it.
4. **Manifest + recompile** — the reference (`{name: code-reviewer, from: ecc}`) is recorded and
   every selected harness gets the native form (a Claude-format agent round-trips: `opus` →
   `strong` → back to `opus` for Claude Code, `read_only = true` in Codex TOML, role prompt for
   Cursor…).

Browse before adding:

```bash
aesop list agent --available
```

## The update flow (review-gated, always)

```bash
aesop update
```

```
~ agent:code-reviewer (ecc)
    - missing error handling, untested branches, style drift, and security smells. Report as
    + missing error handling, untested branches, style drift, and security smells and tech debt. Report as
review the diff, then `aesop update --apply` to take it (recompiles).
```

`update` re-fetches each vendored registry, re-normalizes, and diffs against your vendored copy.
**Nothing applies without `--apply`** — a prompt change is a code change; an upstream registry
edit can change your agents' behavior everywhere, so it goes through the same review a code dep
bump would. `--apply` rewrites the vendor, swaps any provenance-marked instruction blocks in the
manifest, and recompiles — the upstream change lands in every harness in one reviewable git diff.

If something vanished upstream, `update` says so and keeps your vendored copy: you depend on
what you reviewed, not on upstream's whims.

## Running your own registry

Any repo (or directory) using one of the recognized layouts works. The simplest is Aesop's own
canonical layout:

```
agent-standards/
  agents/api-contract-reviewer.md      # canonical frontmatter (see guides/subagents.md)
  skills/deploy-checklist/SKILL.md
  commands/release-notes.md
  instructions/error-handling.md       # plain markdown → project-scope block
```

ecc-style (`agents/ + rules/ + skills/<domain>/<name>/`) and awesome-copilot-style
(`instructions/*.instructions.md + prompts/*.prompt.md + agents/`) layouts import equally —
Aesop looks up names across all the known path patterns, and normalization is per-file, so mixed
repos are fine.

Removal cleans up after itself:

```bash
aesop remove agent code-reviewer    # manifest edit + recompile + deletes the orphaned emitted files
```

For the org-wide story (one blessed registry + bundle + CI drift audit), see
[Team rollout](team-rollout.md).
