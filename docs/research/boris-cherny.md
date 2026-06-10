# Boris Cherny — verified notes (June 2026)

Creator of Claude Code at Anthropic; author of the April 2025 "Claude Code: Best practices for
agentic coding" post. Sources: [howborisusesclaudecode.com](https://howborisusesclaudecode.com/),
the two gists below, the [Pragmatic Engineer interview](https://newsletter.pragmaticengineer.com/p/building-claude-code-with-boris-cherny),
and 2026 workflow writeups.

## The workflow (as of 2026)

- **5 parallel sessions.** Five Claude Code instances in five terminal tabs, each in its own git
  checkout/worktree — no collisions. Ships 20–30 PRs/day. Extra cloud sessions (web/mobile) for
  kick-off-and-check-later; `--teleport` moves context between local and web. A dedicated
  "analysis" worktree for investigations.
- **Plan mode first, always.** No code until the plan is right; iterate the plan, then Claude
  "one-shots the implementation almost every time." Writer/reviewer pairing: one Claude drafts
  the plan, another reviews it as a staff engineer. Stop and re-plan when execution derails.
- **CLAUDE.md as living memory.** ~100 lines; documents mistakes, conventions, style, PR
  templates. **Mistake → rule:** every correction becomes a CLAUDE.md rule so it never repeats.
  Tags `@.claude` on coworkers' PRs to fold review learnings back in (GitHub action).
- **Slash commands for every inner loop.** Anything done more than once a day becomes a command
  in `.claude/commands/`, checked into git. Most-used: commit+push+open-PR.
- **Subagents liberally** — research, exploration, verification offloaded to keep the main
  context clean; "PR-shaped" repeatable work (diff simplification, end-to-end verify).
- **Deliberately thin setup.** Few/no MCP servers, few hooks; bets on CLAUDE.md + commands +
  skills + the model. The exceptions: PostToolUse format-on-write hook; Slack MCP for pasting bug
  threads.
- **Permissions, not YOLO.** `/permissions` allowlist in `.claude/settings.json`, shared with the
  team; `--dangerously-skip-permissions` only inside no-internet containers.
- **Always a feedback loop.** Tests/typecheck/lint the agent can run itself — the agent must be
  able to verify its own work.
- **Course-correct early.** Esc to interrupt bad runs; queue follow-up messages while it works;
  `/clear` between tasks. Opus + thinking as daily driver — slower tokens, fewer steering rounds.
- **Specificity contract.** Exact files, URLs, images, acceptance criteria up front; voice
  dictation for longer, richer prompts.
- **Learning capture.** Explanatory output style; ASCII diagrams / HTML walkthroughs of
  unfamiliar code; per-project notes directories updated after PRs.

## From the April 2025 best-practices post (still canonical)

Explore → Plan → Code → Commit (read first, escalate thinking: "think" < "think hard" <
"ultrathink") · TDD with an independent subagent checking the implementation isn't overfitting
the tests · visual iteration against screenshots/mocks (2–3 rounds) · checklists/scratchpad
markdown files as working memory for big migrations · headless `claude -p` fan-out (generate task
list, fresh agent per task) · multi-Claude writer/reviewer via `git worktree add`.

## How Aesop encodes each

| Boris does | Aesop encodes |
|---|---|
| CLAUDE.md mistake→rule | `aesop lessons` + `sync --write-back`; lessons-loop skill |
| plan mode first | plan-first rules in canonical instructions; plan-gate phase in goal recipes |
| daily workflow → slash command | commands primitive; seed commands: commit-pr, fix-ci, techdebt, add-learning |
| 5 worktrees, writer/reviewer | orchestration templates: worktree-per-agent, maker/checker default at `balanced`+ |
| allowlist over YOLO | permissions primitive tiers; devcontainer recipe for unattended runs |
| hooks for hard policy | hooks primitive: format-on-write, dangerous-command block, notify-on-stop |
| thin setup | `token-lean` default; MCP/extras opt-in; Aesop itself ejectable |
| always a feedback loop | `doctor` fails environments with no runnable verify command |
| headless fan-out | Ralph runner + orchestration loop templates |

Sources: [howborisusesclaudecode.com](https://howborisusesclaudecode.com/) ·
[gist: hqman (Boris's CLAUDE.md workflow)](https://gist.github.com/hqman/e29cb6386c539d795767e8c3fd2c959b) ·
[gist: joyrexus (10+10 tips)](https://gist.github.com/joyrexus/e20ead11b3df4de46ab32b4a7269abe0) ·
[Pragmatic Engineer: Building Claude Code](https://newsletter.pragmaticengineer.com/p/building-claude-code-with-boris-cherny) ·
[workflow writeup](https://karozieminski.substack.com/p/boris-cherny-claude-code-workflow) ·
Anthropic best-practices post (Apr 2025).
