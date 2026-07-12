# Hooks

A hook is **deterministic policy**. Instructions are probabilistic — the model usually complies;
a hook is guaranteed — the harness enforces it on every matching event, no matter what the model
decides. Use instructions for judgement, hooks for rules that must never bend.

## Format
One YAML file per hook, the canonical spec the emitters translate:

```yaml
name: <kebab-name>
description: <one sentence>
event: pre-tool | post-tool | stop | session-start
matcher: "<tool-name regex>"
deny_patterns: [...]        # pre-tool: match ⇒ block the call
action: "<command>"         # post-tool: run this ({format_command} and ${file} resolve at compile)
```

## Where they emit
| Harness | Mechanism |
|---|---|
| Claude Code | `.claude/settings.json` `hooks` (PreToolUse / PostToolUse / Stop / SessionStart) |
| Others without native hooks | git pre-commit wrapper fallback |

A hook whose action needs a formatter is skipped when the project has none configured — aesop
never invents a command.

## In this folder
- `block-dangerous-commands` — deny destructive shell (`rm -rf /`, force-push to main, `DROP
  TABLE`, permission-skip flags) regardless of what the model decides.
- `format-on-write` — run the project formatter on every file the agent writes; hard policy,
  not a prompt.
