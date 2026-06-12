# Architecture

```
aesop.yaml ──► load + schema-validate ──► resolve registries ──► apply profile ──► render ──► emit
                                                                                              │
            sync ◄── fingerprint store (.aesop/lock.json) ◄──────────────────────────────────┘
```

## 1. The manifest (`aesop.yaml`)

Single source of truth, committed to git. Four sections: `project` (facts), `harnesses`
(targets), `pathway` (profile + overrides), `primitives` (selected skills/agents/commands/mcp/
hooks/permissions/loops + inline instruction blocks). Annotated example:
[`07-manifest-schema.md`](07-manifest-schema.md); JSON Schema: [`../schemas/aesop.schema.json`](../schemas/aesop.schema.json).

`aesop init` builds it in three passes:
1. **Detect** — language/stack (lockfiles, manifests), build/test/lint commands (package scripts,
   Makefile, CI config), monorepo layout, existing agent files (imported, never clobbered),
   existing MCP configs.
2. **Interview** — only what can't be detected: domain invariants ("correlate by persistent ID,
   never email"), model choices (+ different-family judge), risk posture, review bandwidth,
   harness selection, pathway.
3. **Confirm** — print the manifest, the user edits, first compile runs.

## 2. The compiler

- **Resolve:** each primitive reference (`verify-loop`, `security-reviewer@ecc`) is looked up
  across declared registries, version-pinned by SHA into `.aesop/lock.json`.
- **Profile application:** the pathway decides *what* gets emitted (no reviewer subagent at
  `token-lean`), *which models* get pinned into subagent frontmatter, and the loop budget numbers.
- **Render:** canonical forms → native dialects via per-harness emitters. Pure functions:
  `(manifest, resolvedPrimitives, profile) → FileSet`. No I/O in render; all writes in one place.

## 3. Emitters

One per harness, implementing one interface (locked in Phase 0, [`../src/types.ts`](../src/types.ts)):

```ts
interface Emitter {
  harness: HarnessId;
  emit(ctx: CompileContext): EmittedFile[];   // pure
  importExisting(root: string): Partial<Manifest>;  // init-time adoption of hand-written config
  capabilities(): CapabilityMatrix;           // what's native vs fallback — drives matrix tests
}
```

Capability fallbacks are explicit, never silent: a harness without native skills gets the skill
rendered as a rule/instruction *and* a note in `compile --verbose` output. The capability matrix
doubles as the test spec ([`03-harness-matrix.md`](03-harness-matrix.md)).

## 4. Fences, drift, write-back

Every emitted file wraps generated content in fences:

```md
<!-- aesop:begin v1 sha256:af31… -->
…generated…
<!-- aesop:end -->
```

- Content *outside* fences is the user's; compile preserves it byte-for-byte.
- `.aesop/lock.json` stores the post-compile hash of each fenced region.
- `aesop sync` recomputes: hash mismatch inside a fence = drift. Options: `--accept` (regenerate),
  `--write-back` (parse the manual edit, lift it into the manifest — instruction-rule edits map
  cleanly; structural edits prompt). Write-back is Boris's mistake→rule loop, mechanized.
- JSON/TOML targets that can't carry comments get a sidecar entry in the lock file instead of an
  inline fence.

## 5. Doctor

Static + dynamic audit, exit-coded for CI:

| Check | Why |
|---|---|
| manifest schema-valid; lock in sync | foundation |
| `test`/`lint`/`build` commands actually run | the verify loop is load-bearing (Karpathy's law) |
| MCP servers respond to handshake | dead connector = silent capability loss |
| instruction files ≤ ~250 lines, no contradictions across scopes | must survive compaction |
| goal recipes carry all three hard stops | non-negotiable |
| no secrets in emitted files; env-var names only and set | hygiene |
| permissions: no blanket YOLO outside a container config | Boris's rule |
| harness-version vs matrix-doc freshness | catch harness churn |

## 6. Security posture

- Emitted configs reference secret *names*, never values.
- Registry content is untrusted input: imports are schema-validated, diffed on `update`, and
  never auto-applied (a prompt change is a code change — it goes through review).
- Instruction templates always include the untrusted-tool-output rule (prompt-injection surface)
  regardless of pathway.

## 7. Runtime choices

TypeScript/Node ≥20, distributed via `npx @agentmc15/aesop` (zero install). Library-first: `src/` exposes
the compiler as an API; the CLI and the MCP server (`aesop mcp serve`) are thin shells over it.
No daemon, no network calls except registry fetch and `update`.
