# Plugins

**The skill is the authoring format; the plugin is how you ship it.** A plugin bundles skills,
subagents, MCP servers/connectors, and hooks (and LSPs, where supported) so a teammate installs your
entire setup in one step instead of rebuilding it from memory.

## When to make one
When you want to share a skill across repos, or distribute a coherent setup (e.g. "our analytics
stack": a BigQuery skill + a `bq` MCP connector + an analytics-reviewer subagent) to a team.

## Distribution
- Install from an **official marketplace** (e.g. Anthropic's plugin marketplace for Claude Code),
  **or stand up your own company marketplace** so every engineer gets the same blessed setup.
- Codex and Claude Code both distribute skills/connectors as plugins; a connector built for one
  generally works in the other.

## Anatomy (illustrative)
```
my-plugin/
├── .claude-plugin/plugin.json     # or the host's manifest
├── skills/<skill>/SKILL.md
├── agents/<role>.md               # or .toml for Codex
├── mcp/servers.json
└── hooks/                         # e.g. a PostToolUse formatter
```

## Why it matters for the loop
A loop's quality is mostly its primitives. Packaging them as a plugin makes "good setup" portable
and versioned, so the loop behaves the same on every machine and for every teammate — which is the
whole point of treating instruction files, skills, and connectors as committed, shared artifacts.

> Verify the exact manifest format against your harness's current plugin docs — formats are evolving
> fast across Claude Code, Codex, and Copilot.
