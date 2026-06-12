# The everyday workflow

Aesop's value compounds through a small daily loop: the environment stays *correct* (sync,
doctor, CI) and gets *smarter* (lessons, write-back). This guide is that loop.

## The one rule

**`aesop.yaml` is the source of truth; everything emitted is generated.** When you want to
change the agent's behavior, change the manifest and `aesop compile` — or make the change in
place and let `--write-back` lift it. Never hand-fork an emitted file; that's how six harnesses
drift apart, which is the disease Aesop exists to cure.

## Mistake → rule (the highest-leverage habit)

Boris Cherny's core practice, mechanized. The moment an agent does something wrong and you
correct it, record the correction:

```bash
aesop lessons "Don't mock the DB in integration tests; use the docker-compose harness."
```

That appends to `tasks/lessons.md` — which every emitted instruction file tells the agent to
read at session start. When a lesson proves general, promote it:

```bash
aesop lessons "All timestamps are stored UTC; convert at the edge only." --promote
```

`--promote` also adds it as an instruction block and recompiles — the rule now exists in
`AGENTS.md`, `CLAUDE.md`, Copilot instructions, Cursor rules… every harness, one command.
The repo remembers what the model forgets.

There's also `/add-learning` (a seed slash command) so the *agent* can do this mid-session when
you correct it.

## When files drift

You (or a teammate, or an agent) edited an emitted file directly. Find out and decide:

```bash
aesop sync
```

```
drift: 1 file(s):
  ~ AGENTS.md:42 (edited inside the managed region)
next: `aesop sync --accept` to regenerate, or --write-back to lift instruction edits into aesop.yaml
```

- **The edit was noise** → `aesop sync --accept` regenerates from the manifest. Anything you
  wrote *outside* the fences survives — that space is yours by contract.
- **The edit was a good rule** → `aesop sync --write-back` lifts the added lines into a manifest
  instruction block and recompiles, so the rule propagates everywhere instead of living in one
  file. (Write-back handles instruction edits; for structural files like `settings.json` it
  tells you to fold the change into `aesop.yaml` by hand.)
- **A file is `orphaned`** — the lockfile tracks it but the manifest no longer produces it
  (you removed a primitive). Delete it, or re-add the primitive.

## Weekly hygiene: doctor and update

```bash
aesop doctor
```

Run it whenever something feels off, and always after changing commands, MCP servers, or
permissions. It executes your verify loop for real — a failing test command means every loop
you run is flying blind. Exit 3 means findings; the [check table](../06-cli-spec.md#aesop-doctor)
explains each code.

```bash
aesop update          # what moved upstream in your vendored registries?
aesop update --apply  # take it — after you read the diff
```

A prompt change is a code change. `update` never applies anything by itself.

## CI: make the loop self-enforcing

```yaml
- run: npx @agentmc15/aesop compile --check   # drift inside fences fails the build (exit 3)
- run: npx @agentmc15/aesop doctor            # an unhealthy environment fails the build (exit 3)
```

With these two lines, "the agent config is wrong" becomes a red build instead of a mystery
three weeks later. (Aesop's own CI does exactly this — see `.github/workflows/ci.yml`.)

## Switching intensity per task

The pathway is in the manifest, but high-stakes work deserves a one-off boost without editing
anything:

```bash
aesop compile --pathway accuracy-max     # reviewer subagents, higher effort, bigger budgets
# …do the migration / security-sensitive change…
aesop compile                            # back to the manifest's pathway
```

See [Pathways](pathways.md) for what actually changes at each setting.

## The weekly rhythm, condensed

| When | Command | Why |
|---|---|---|
| after any correction | `aesop lessons "…" [--promote]` | mistake → rule; compounds |
| before trusting a loop | `aesop doctor` | the verify loop is load-bearing |
| when output looks off | `aesop sync` | find drift; accept or write back |
| weekly / on a schedule | `aesop update` | review upstream registry changes |
| every push (CI) | `compile --check` + `doctor` | self-enforcing environment |
| before a risky change | `compile --pathway accuracy-max` | rent the expensive brain briefly |
