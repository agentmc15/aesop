# Subagents

These are **harness-neutral role definitions**. Each adapter renders them in its own format; this
folder is the canonical source.

## Why subagents
Two reasons: (1) keep the main context clean by offloading read-heavy/parallel work, and (2) **split
the maker from the checker** — the model that wrote the code is too lenient grading its own homework.
A reviewer with different instructions, often a stronger model, catches what the author talked
itself into. The loop runs while you're not watching, so a verifier you trust is the only reason you
can walk away.

Rules: **one task per subagent**, narrowest tools it needs, read-only by default (let the main agent
edit). Subagents burn more tokens (each runs its own model + tools) — spend them where a second
opinion pays for itself (this is a key dial in the pathways).

## Per-harness format
| Harness | Location | Format |
|---|---|---|
| Claude Code | `.claude/agents/*.md` | Markdown + YAML frontmatter (`name`, `description`, `tools`, `model`); `isolation: worktree` optional |
| Codex | `.codex/agents/*.toml` | TOML (`name`, `description`, `instructions`, `model`, `reasoning_effort`) |
| Copilot | `.github/agents/*.agent.md` | Markdown + frontmatter (`name`, `description`, `tools`) |
| Antigravity | dynamic subagents / Mission Control | configured per task |

## The role catalog
| Role | Job | Model / effort | Read-only? |
|---|---|---|---|
| `explorer` | map code + call paths before changes | fast / low | yes |
| `implementer` | make the change per the spec | strong | no |
| `verify-app` | run build/test/lint + smoke check | mid | yes (runs tests) |
| `code-simplifier` | clean up the final diff, no behavior change | mid | edits diff only |
| `spec-reviewer` | review change vs spec + conventions | strong / high | yes |
| `security-reviewer` | security scan before merge | strong / high | yes |
| `researcher` | gather external/internal evidence | mid | yes |
| `critic` | challenge assumptions, find contradictions | strong / high | yes |

The neutral source for each is in this folder. The Claude Code and Codex adapters already ship
rendered versions; copy/adapt from here for other harnesses.
