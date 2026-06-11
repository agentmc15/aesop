# Documentation hardening ✅ (2026-06-10)

User request: make documentation, how-tos, and usage guides much more robust.

## Done
- [x] docs/guides/ — 13 task-oriented user guides (Diátaxis-style, separate from the
      design docs in docs/01-08): index, getting-started tutorial, adopting-existing,
      everyday-workflow, skills-and-commands, subagents, pathways, goals-and-loops,
      mcp-hooks-permissions, registries, team-rollout, agent-driven (MCP), harnesses
      (per-harness notes ×6), troubleshooting+FAQ
- [x] docs/06-cli-spec.md rewritten as the complete AS-BUILT CLI reference — fixed drift
      from implementation (--from-existing and profile new/set were spec'd but never built;
      goal subcommands, bundle --format, list --available now documented)
- [x] docs/07 fixed (init --refresh was documented but unimplemented)
- [x] package.json: "prepare" script so `npm install -g github:agentmc15/aesop` builds dist
      (installable pre-publish — getting-started depends on it)
- [x] README: install line, getting-started pointer, full Documentation section; PLAN repo map
- [x] Verified: all internal markdown links resolve (scripted check); 44 tests green;
      compile --check clean; npm pack 158 files

## Remaining for the owner (unchanged)
- npm publish when ready; live native-/goal run
