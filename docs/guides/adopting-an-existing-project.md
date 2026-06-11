# Adopting Aesop in an existing project

You already have a hand-written `CLAUDE.md`, an `AGENTS.md`, `.cursor/rules`, or Copilot
instructions — possibly several, possibly drifted from each other. Aesop's adoption path is
designed around one promise: **nothing you wrote gets lost.**

## What `aesop init` does with existing files

```bash
aesop init
```

Every existing instruction file Aesop recognizes — `CLAUDE.md`, `AGENTS.md`,
`.github/copilot-instructions.md`, `.cursor/rules/*.mdc`, `GEMINI.md` — is **imported verbatim**
into `aesop.yaml` as an instruction block, marked with its origin:

```yaml
primitives:
  instructions:
    blocks:
      - scope: project
        content: |
          <!-- imported by aesop init from CLAUDE.md; review and fold into canonical blocks -->
          # Project rules
          NEVER touch the legacy/ directory; it is frozen for the audit.
          ...
```

Your files on disk are untouched at this point — `init` only writes `aesop.yaml`.

## The cleanup pass (recommended, 15 minutes)

The import preserves everything, but wholesale blocks duplicate what Aesop's canonical template
already says (plan-first, simplicity, verification, safety — the doctrine). Skim each imported
block and sort its lines into three buckets:

1. **Project facts** (stack, commands, "we deploy with X") → already detected, or belongs in
   `project.commands` / `project.stack`. Delete from the block.
2. **Invariants** ("never correlate by email", "money in cents") → move to
   `project.invariants`. These render with a *load-bearing — never violate* header, stronger
   than a paragraph of prose.
3. **Genuinely yours** (domain rules, team conventions, scoped rules) → keep as blocks. Give
   path-specific rules a `path:` scope so Copilot/Cursor get them natively:

   ```yaml
   - scope: "path:packages/web/**"
     content: |
       React function components only; no class components.
   ```

Anything that duplicates the template's doctrine: delete. The template already says it, in
every harness.

## First compile: what happens to the old files

```bash
aesop compile
```

For each file Aesop now manages:

- If it had no fence (your hand-written original), the generated content goes **on top** and your
  original is preserved **below a marker**:

  ```md
  <!-- aesop:end -->

  <!-- aesop: pre-existing content below — review and fold into aesop.yaml, then delete -->

  # Your original CLAUDE.md content…
  ```

  Since you already imported (and folded) that content, review the duplicate and delete it —
  the marker text says exactly that. Files Aesop doesn't manage are never touched.

If you did the cleanup pass first, a tidier route is to delete the originals just before
compiling — their content already lives in the manifest:

```bash
git rm CLAUDE.md AGENTS.md   # content is in aesop.yaml now; git history keeps the originals
aesop compile
```

(This is exactly how Aesop's own repo was migrated — see the Phase 7 commit.)

## Adopting in a monorepo

`init` detects workspaces (`pnpm-workspace.yaml`, package.json `workspaces`, Cargo workspace
members) and records them in `project.monorepo.packages`. Per-package rules are `path:` blocks;
per-package commands stay in the root verify loop (`pnpm -r test` style) — goal recipes can
narrow (`verify: pnpm -F api test`).

## Adopting alongside teammates who don't use Aesop

Safe: the emitted files are plain native config — teammates consume them with zero Aesop
knowledge. Two rules keep it sane:

1. They edit *below* the fence (or anywhere in unmanaged files); you fold good edits into
   `aesop.yaml` with [`aesop sync --write-back`](everyday-workflow.md).
2. CI runs `aesop compile --check` so in-fence hand edits surface as drift instead of silently
   forking the truth.

## Rollback

`aesop eject --force` strips the fences (all content stays), deletes `aesop.yaml` and `.aesop/`,
and leaves you with exactly the plain native files you'd have written by hand. The exit is a
feature; try Aesop on a branch if you're unsure.
