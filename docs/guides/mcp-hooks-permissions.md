# MCP, hooks & permissions

Three primitives that share a theme: **what the agent may touch, and what holds even when the
model doesn't comply.** Instructions are probabilistic; these are structural.

## MCP servers — let the loop touch real tools

A loop that only sees the filesystem is a tiny loop. MCP connects the agent to your issue
tracker, database, staging API, Slack. Declared once in the manifest, emitted to every harness's
config dialect:

```yaml
primitives:
  mcp:
    - name: github
      transport: stdio
      command: npx -y @modelcontextprotocol/server-github
      env: [GITHUB_TOKEN]          # env var NAMES only — values never enter any file
      scopes: ["repo:read"]
      trust: write                 # read | write | irreversible
```

Emits to `.mcp.json` (Claude Code), `.vscode/mcp.json` (VS Code/Copilot), `.cursor/mcp.json`,
`.codex/config.toml [mcp_servers]`. Antigravity configures MCP in app settings — Aesop flags
that as an explicit fallback rather than emitting a file that does nothing.

Rules baked in:

- **Secrets:** the manifest carries env-var *names*; emitted configs reference `${GITHUB_TOKEN}`.
  `doctor` scans every managed file for committed credentials and flags them `file:line`.
- **Trust feeds permissions:** mark a server `irreversible` and its use belongs behind the human
  gate (tier 3 below).
- **Thin by default.** `init` starts you with zero MCP servers — Boris's posture: bet on
  instructions + commands + the model; add a connector when a workflow actually needs it.
  `doctor` checks each declared server's binary resolves, so dead connectors can't silently
  drain capability.

## Hooks — hard policy

A hook is a check that holds *even if the model ignores every instruction*. LLM compliance is
probabilistic; hooks are guaranteed.

```yaml
primitives:
  hooks:
    - block-dangerous-commands     # seed: denies rm -rf /, force-push to main, DROP TABLE, …
    - format-on-write              # seed: runs your formatter on every file the agent writes
```

On Claude Code these compile into `settings.json` `PreToolUse`/`PostToolUse` entries (the
dangerous-command block makes the tool call fail with exit 2 — the agent sees "blocked by
aesop"). `format-on-write` only emits if `project.commands.format` exists — Aesop never invents
a formatter. Harnesses without native hooks get an explicit fallback note (`compile --verbose`
shows every gap); a git pre-commit fallback is on the roadmap.

Authoring your own: drop a YAML next to the seeds in a registry you control —

```yaml
# hooks/no-env-edits.yaml
name: no-env-edits
description: Deny edits to .env files regardless of what the model decides.
event: pre-tool
matcher: "Write|Edit"
deny_patterns:
  - "\\.env"
```

## Permissions — three tiers, every harness

The canonical model: **read is free · mutate is policy-checked · irreversible needs a human.**

```yaml
primitives:
  permissions:
    mutate_allow:                  # tier 2: pre-approved, no prompt
      - "npm *"
      - "git commit *"
      - git push origin HEAD
    irreversible:                  # tier 3: always ask a human
      - git push origin main
      - npm publish
      - db:migrate up
    unattended: none               # devcontainer = the ONLY sanctioned skip-permissions context
```

On Claude Code this becomes `settings.json` `permissions.allow` / `ask` rules
(`Bash(git commit:*)` style — your build/test/lint commands are allowed automatically, since the
agent must be able to verify its own work). On Codex it maps to approval/sandbox policy. On
Antigravity the tiers render into `GUARDRAILS.md` as binding prose. Cursor/Copilot keep
allowlists in app/org settings — flagged as fallbacks, not silently skipped.

**About YOLO mode:** `--dangerously-skip-permissions` is sanctioned only inside a no-internet
container. Set `unattended: devcontainer` if you do that; otherwise `doctor` flags any
appearance of the flag in your scripts. Speed is never an excuse for an open blast radius.

## How the three compose

A request to "clean up old feature flags and deploy":

1. The agent explores freely (tier 1 reads).
2. Edits and `npm test` run unprompted (tier 2 allowlist) — but `format-on-write` formats every
   touched file and `block-dangerous-commands` would veto a stray `git push --force`.
3. The Slack MCP posts the summary (declared server, `write` trust).
4. `deploy` hits tier 3 and waits for you. Generation is safe; application is irreversible.
