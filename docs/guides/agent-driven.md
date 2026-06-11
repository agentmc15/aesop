# Agent-driven Aesop (`aesop mcp serve`)

Agents will run Aesop more often than humans will. Two ways they do it.

## Way 1 — the CLI with `--json`

Every command emits machine output with `--json` and meaningful exit codes (`0` ok, `2`
validation, `3` findings). An agent with shell access can already:

```bash
aesop doctor --json          # structured findings to fix
aesop sync --json            # structured drift to resolve
aesop goal run nightly --json
```

## Way 2 — the MCP server

`aesop mcp serve` exposes the surface as MCP tools over stdio, so harnesses without shell access
— or with Bash locked down — can still drive Aesop natively.

Register it:

```jsonc
// .mcp.json (Claude Code) — yes, aesop can emit the file that registers aesop
{ "mcpServers": { "aesop": { "command": "aesop", "args": ["mcp", "serve"] } } }
```

```yaml
# or in aesop.yaml, so every harness gets it:
primitives:
  mcp:
    - name: aesop
      transport: stdio
      command: aesop mcp serve
      trust: write
```

Tools exposed (each takes an optional `cwd`):

| Tool | Does |
|---|---|
| `compile` | recompile; `check: true` reports drift without writing |
| `sync` | drift report; `accept` / `writeBack` options |
| `doctor` | the 8-point audit; `fix: true` creates the state dir |
| `add` | install a primitive from any declared registry |
| `list` | installed primitives; `available: true` browses registries |
| `lessons` | record a mistake→rule lesson; `promote: true` lifts it into instructions |
| `goal_list` / `goal_run` | enumerate and execute goal recipes |

## What this unlocks

- **Self-repair:** the agent hits a missing skill mid-task → `add` it → keep working, without
  leaving its loop or asking you to run a command.
- **Self-improvement:** you correct the agent → it calls `lessons` with `promote: true` → the
  rule exists in every harness's instructions before the next session starts.
- **Environment-aware sessions:** a session can open with `doctor` and refuse to do risky work
  in an unhealthy environment — the agent applying Aesop's own standard to itself.

## Boundaries worth keeping

The MCP surface deliberately exposes no `eject`, no `update --apply`, and no `bundle`:
destructive or outward-facing actions stay human-initiated. And everything the agent changes
through MCP flows through the same machinery as your edits — manifest validation, fences,
lockfile — so `git diff` after a session shows you exactly what the agent did to its own
environment. Review it like any other diff; that's the contract.
