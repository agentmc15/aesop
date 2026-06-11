# Getting started

Zero to a compiled agentic environment — instruction files, skills, subagents, commands, hooks,
permissions, and a runnable goal loop — in about ten minutes.

## 1. Install

```bash
# until the npm publish lands:
npm install -g github:agentmc15/aesop

# after publish:
npx aesop --help
```

Requires Node ≥ 20. Check it works:

```bash
aesop --help
```

## 2. Initialize your project

From your repo root:

```bash
aesop init
```

Aesop detects what it can — stack, package manager, build/test/lint commands, monorepo layout,
and any agent files you already have — then interviews you for the things only you know:

- **Domain invariants** — the rules an agent would otherwise guess wrong ("correlate accounts by
  persistent user ID, never email", "all money math in integer cents"). These are the highest-value
  lines in your whole setup; don't skip them.
- **Models** — your primary family, and a judge from a *different* family (enforced: the maker
  must not grade its own work).
- **Review bandwidth** — how many parallel agents you will *actually review*. This caps
  orchestration parallelism later; be honest.
- **Harnesses and pathway** — which tools you run, and where you sit on the cost/accuracy dial.

In a hurry (or in a script), skip the interview:

```bash
aesop init --yes --harness claude-code,codex --pathway token-lean
```

Either way you end with one file — `aesop.yaml` — and a summary like:

```
Wrote /path/to/repo/aesop.yaml

  project    my-api  (typescript, node20)
  test       npm test
  build      npm run build
  lint       npm run lint
  harnesses  claude-code
  pathway    token-lean
  imported   CLAUDE.md (preserved as instruction blocks)

Next: review aesop.yaml, then run `aesop compile`.
```

**Review `aesop.yaml` before compiling.** It is the single source of truth from here on;
everything else is generated from it. The [manifest reference](../07-manifest-schema.md) explains
every field.

## 3. Compile

```bash
aesop compile
```

```
compiled 25 file(s), 25 written:
  ✚ .claude/agents/explorer.md
  ✚ .claude/commands/commit-pr.md
  ✚ .claude/settings.json
  ✚ .claude/skills/verify-loop/SKILL.md
  ✚ AGENTS.md
  ✚ CLAUDE.md
  ...
```

What just happened:

- **`AGENTS.md`** — your full instruction file (doctrine + your project facts + your invariants),
  the portable standard read natively by Codex, Cursor, and Antigravity.
- **`CLAUDE.md`** — a one-line `@AGENTS.md` import, so Claude Code reads the same truth.
- **`.claude/` and friends** — subagents, slash commands, skills, settings (permission allowlist
  + hooks), all in each harness's native dialect.
- **`.aesop/lock.json`** — hashes of everything generated, so drift is detectable.

Generated files carry `<!-- aesop:begin … aesop:end -->` fences. You can write below the fence
freely — it survives every recompile. To change what's *inside* the fence, edit `aesop.yaml` and
recompile (or let [`sync --write-back`](everyday-workflow.md) lift your edit for you).

Commit all of it: the environment is part of the repo now.

```bash
git add -A && git commit -m "Add aesop-managed agent environment"
```

## 4. Check the environment is actually healthy

```bash
aesop doctor --fix
```

Doctor refuses to call an environment healthy unless the agent can *prove its own work*: it runs
your test command for real, checks MCP servers resolve, audits permissions and secrets, and
verifies the memory files exist (`--fix` creates `tasks/todo.md` and `tasks/lessons.md`). Exit
code 3 means findings — fix them before trusting any loop. The full check table is in the
[CLI reference](../06-cli-spec.md#aesop-doctor).

## 5. Open your harness and use it

Open Claude Code (or Codex, etc.) in the repo. You immediately have:

- the instructions in effect (try asking "what are this project's invariants?"),
- slash commands: `/commit-pr`, `/fix-ci`, `/add-learning`,
- subagents (`explorer`, `verify-app`) the agent can delegate to,
- skills that trigger when relevant (`verify-loop` fires before any "done" claim).

## 6. Run your first goal

A goal is a task with a *mechanical* stopping condition:

```bash
aesop goal new green-tests --goal "the full test suite passes" --verify "npm test"
aesop goal show green-tests
```

Two ways to run it:

- **Native `/goal`** (Claude Code, Codex): paste the one-liner that `goal show` prints.
- **Portable runner** (any harness, or unattended):

  ```bash
  aesop goal run green-tests
  ```

  Fresh agent each tick, verify after every tick, and three hard stops (iteration ceiling,
  no-progress detector, budget ceiling) so it can never run away. Details:
  [Goals & loops](goals-and-loops.md).

## 7. Wire CI

Two lines make the environment self-enforcing:

```yaml
- run: npx aesop compile --check   # exit 3 if any generated file drifted
- run: npx aesop doctor            # exit 3 if the environment is unhealthy
```

## Where to next

- [The everyday workflow](everyday-workflow.md) — how the environment stays correct and gets
  smarter as you work.
- [Pathways](pathways.md) — when to turn the dial up from `token-lean`.
- [Registries](registries.md) — pull skills/agents from ecc, awesome-copilot, or your org.

One thing Aesop will keep telling you, because no tool solves it: **verification is still yours,
comprehension debt compounds, and cognitive surrender is a choice.** Build the loop; stay the
engineer.
