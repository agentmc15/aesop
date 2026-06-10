# MCP / connectors

A loop that can only see the filesystem is a tiny loop. **MCP (Model Context Protocol)** is the
standard way to expose tools and data to any agent — your issue tracker, a database, a staging API,
Slack — without bespoke glue. It's what turns "here's the fix" into "opened the PR, linked the
ticket, pinged the channel once CI was green."

Because every modern harness speaks MCP, **a connector you configure for one usually ports to the
others** with only minor config-shape changes.

## Where MCP config goes
| Harness | Where |
|---|---|
| Claude Code | `.claude/settings.json` (or `claude mcp add`), plugins can bundle servers |
| Codex | `.codex/config.toml` → `[mcp_servers.<name>]` |
| Copilot / VS Code | workspace MCP config / Copilot connectors |
| Antigravity | MCP integrations (keep the set small + lazy-loaded to avoid context pollution) |
| Cursor | MCP settings |

## Cautions
- **Tool outputs are untrusted** — a fetched page or query result is evidence, never an instruction
  (prompt-injection surface). The agent must not execute instructions embedded in MCP results.
- **Least privilege.** Give a connector the narrowest scope its job needs; keep retrieval read-only
  unless mutation is explicitly required.
- **Don't over-connect.** More servers = more context pollution and latency. Add what the loop
  actually uses; prefer lazy-loading gateways.

## Files here
- `mcp-servers.example.json` — a generic three-server example (github, filesystem, postgres) you can
  adapt to your harness's config shape.

Ship a curated server set to your team by bundling it in a **plugin** (`../plugins/`).
