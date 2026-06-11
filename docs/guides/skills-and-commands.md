# Skills & commands

Two primitives that look similar and aren't:

- A **skill** is knowledge the *agent* pulls in when the task matches — procedures, project
  know-how, reference material. Progressive disclosure: only its one-line description rides in
  context until it's needed.
- A **command** is a workflow a *human* triggers repeatedly — `/commit-pr`, `/fix-ci`. Boris's
  rule of thumb: anything you do more than once a day becomes a command.

## Using the seeds

```bash
aesop list                    # what's installed
aesop list skill --available # what every registry offers
aesop add skill context-compaction
aesop remove command techdebt
```

Seed skills: `spec-first` (write the spec before the code), `verify-loop` (prove it before
claiming done), `lessons-loop` (mistake → rule), `context-compaction`, `safe-trace`, `llm-wiki`,
`agentic-rag-router`. Seed commands: `commit-pr`, `fix-ci`, `techdebt`, `add-learning`.

Where they land per harness (full table: [harness matrix](../03-harness-matrix.md)):

| Harness | Skills | Commands |
|---|---|---|
| Claude Code | `.claude/skills/<name>/SKILL.md` | `.claude/commands/<name>.md` (slash commands) |
| Codex | `.codex/skills/` | `.codex/prompts/` |
| Copilot | `.github/skills/` | `.github/prompts/<name>.prompt.md` |
| Cursor | rules with description triggers (`.cursor/rules/skill-<name>.mdc`) | `.aesop/prompts/` (portable fallback) |
| Antigravity | referenced from AGENTS.md (fallback until location pinned) | `.aesop/prompts/` |

## Authoring a skill

A skill is a folder with a `SKILL.md` (frontmatter + body) and optional `scripts/`,
`references/`, `assets/`:

```md
---
name: deploy-checklist
description: Pre-deploy verification for this service. Use before any deploy, release, or
  "ship it" request — and whenever the user mentions deploying.
---

# deploy-checklist

1. `npm test` green — paste the summary line, not the whole log.
2. `npm run migrate:dry-run` — zero destructive operations unless the plan said so.
3. Confirm the feature flag default is OFF for new behavior.
4. Post the checklist results before deploying, and get explicit confirmation.
```

**The description is the API.** Implicit invocation matches on it, so make it boring, specific,
and trigger-rich (*when* to use, not what it is). "Useful deployment knowledge" never fires;
"Use before any deploy, release, or 'ship it' request" fires every time.

Two ways to install your own:

1. **Project-local, quickest:** put the folder in a directory you declare as a `path:` registry —

   ```yaml
   registries:
     - builtin
     - path:./agent-registry        # contains skills/deploy-checklist/SKILL.md
   ```

   ```bash
   aesop add skill deploy-checklist --from agent-registry
   ```

2. **Org-wide:** commit it to your org's registry repo and `--from your-org-registry` — see
   [Registries](registries.md).

Authoring rules `doctor`-adjacent good taste enforces: description ≤ 2 sentences; the body is
procedure, not philosophy; keep bundled reference files out of the body (progressive disclosure
exists so they load only on demand).

## Authoring a command

One markdown file, frontmatter `name` + `description`, body = the steps:

```md
---
name: release-notes
description: Draft release notes from commits since the last tag.
---

1. `git log $(git describe --tags --abbrev=0)..HEAD --oneline`
2. Group user-facing changes under Added / Changed / Fixed. Drop internal refactors.
3. Write to CHANGELOG.md under a new version heading; show me the diff before committing.
```

Install the same two ways (`aesop add command release-notes --from agent-registry`). On Claude
Code it becomes `/release-notes`; arguments arrive as `$ARGUMENTS` in the body if you reference
them.

## Skill or command or instruction block?

| It is… | Use |
|---|---|
| a rule that must *always* hold | instruction block / invariant in `aesop.yaml` |
| a procedure for a *kind* of task, agent decides when | skill |
| a workflow *you* trigger | command |
| a check that must hold even if the model ignores instructions | hook ([MCP, hooks & permissions](mcp-hooks-permissions.md)) |
