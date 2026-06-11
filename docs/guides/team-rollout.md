# Team rollout

One person tuning an environment is a craft; a team sharing one is leverage. Three mechanisms,
in increasing order of commitment.

## Level 1 — the repo itself (zero extra work)

Everything Aesop emits is plain native config, committed to the repo. A teammate who clones gets
the working environment with no Aesop knowledge at all: `CLAUDE.md` works in their Claude Code,
`.cursor/rules` in their Cursor. Add the two CI lines so nobody forks the truth by hand:

```yaml
- run: npx aesop compile --check    # drift inside fences fails the build
- run: npx aesop doctor             # unhealthy environment fails the build
```

## Level 2 — bundle: one-command install into *other* repos

Package the environment your team perfected so other projects can adopt it without copying
files around:

```bash
aesop bundle                           # → .aesop/bundle/claude-plugin/
```

This produces a Claude Code **plugin + marketplace** pair. Push the bundle directory (or your
whole repo) somewhere reachable and a teammate runs:

```
/plugin marketplace add your-org/agent-env
/plugin install my-api@my-api-marketplace
```

One command, and their Claude Code has your commands, agents, and skills. Other formats:

```bash
aesop bundle --format copilot-plugin   # agents/ prompts/ instructions/ skills/ for .github/
aesop bundle --format tarball          # the whole environment, every harness, as files
```

The tarball is the universal fallback: `tar xzf my-api-env.tgz -C their-repo/` drops the
complete compiled environment in place.

## Level 3 — the org registry (the standardize-and-distribute pattern)

The full enablement story: one blessed source of truth, every repo compiled from it, drift
audited.

**1. Stand up `your-org/agent-standards`** — a plain repo in canonical layout:

```
agents/security-reviewer.md       # your review standard, encoded once
skills/deploy-checklist/SKILL.md
commands/release-notes.md
instructions/error-handling.md
```

**2. Every project declares it** and pulls what it needs:

```yaml
registries: [builtin, "github:your-org/agent-standards"]
```

```bash
aesop add agent security-reviewer --from agent-standards
```

Content is **vendored and SHA-pinned** per repo — a central edit changes nobody's environment
until that repo runs `aesop update`, reads the diff, and `--apply`s it. Upgrades are PRs, not
surprises. (A prompt change is a code change.)

**3. Audit the fleet.** A scheduled job per repo:

```bash
aesop update        # exit prints pending upstream changes
aesop doctor        # exit 3 = unhealthy → page the owner, not the agent
aesop compile --check
```

**4. Org-level baseline rules** go in the registry as `instructions/` entries — each repo adds
the blocks it adopts, and `update` propagates refinements through review. Personal preferences
(your plan style, your effort defaults) stay in user-level files, *not* in the org registry:
global vs local is the [instructions split](../04-primitives.md#1-instructions); don't ship your
taste as policy.

## What to standardize vs leave free

| Standardize (org registry) | Leave per-repo / per-person |
|---|---|
| security-reviewer + review standards | pathway choice (cost profile is a team budget call) |
| safety hooks (block-dangerous-commands +) | project invariants (each repo's domain truth) |
| commit/PR conventions as commands | personal global instructions |
| baseline instruction blocks | which MCP connectors a repo actually needs |

The one metric that matters: enablement that **raises the ceiling** (faster on work people
understand) vs enablement that removes thinking. Measure adoption by review quality and incident
rate, not by seats.
