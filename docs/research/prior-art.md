# Prior art — what exists, what Aesop borrows, what's missing

## github/awesome-copilot
[github.com/github/awesome-copilot](https://github.com/github/awesome-copilot)

- Official GitHub collection of Copilot customizations in six categories: **agents** (MCP-integrated),
  **instructions** ("coding standards applied automatically by file pattern"), **skills**
  ("self-contained folders with instructions and bundled assets"), **plugins** (curated bundles),
  **hooks** (session-triggered automations), **agentic workflows** (AI-powered GitHub Actions in
  markdown). Plus a cookbook and a machine-readable `llms.txt`.
- Install path: `copilot plugin install <name>@awesome-copilot`.
- **Borrow:** the category taxonomy (it matches Aesop's primitives almost 1:1 — convergence
  evidence); the plugin-install UX; `llms.txt` machine-readability.
- **Missing:** Copilot-only; no manifest, no compile-to-other-harnesses, no drift sync, no
  pathways.

## affaan-m/ecc
[github.com/affaan-m/ecc](https://github.com/affaan-m/ecc)

- "Agent harness performance optimization system": **64 agents, 261 skills**, rules (common +
  per-language), hooks, scripts, MCP configs — with adapters for 12+ harnesses side by side
  (`.claude-plugin/`, `.cursor/`, `.codex/`, `.opencode/`, `.zed/`, `.vscode/`, `.gemini/`,
  `.kiro/`, `.qwen/`, `.trae/`).
- Install: Claude Code plugin (`/plugin install ecc@ecc`), `install.sh` with profile selection
  (minimal/core/full), or selective copy.
- **Borrow:** the proof that one content set can ship to many harnesses; install profiles
  (≈ pathways for content volume); rules split common/per-language.
- **Missing:** adapters are maintained *by hand, in parallel* — N copies of the truth. No
  single-source compiler, no project detection, no drift checking. Aesop's core bet is that the
  source of truth must be one manifest, with adapters generated.

## multica-ai/andrej-karpathy-skills
[github.com/multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills)

- Karpathy's coding philosophy distilled into a CLAUDE.md of 11 principles (see
  [karpathy.md](karpathy.md)). Philosophy: cautious, methodical, clarity over speed; reframes
  coding mistakes as communication failures preventable by upfront thinking.
- **Borrow:** the 11 principles are folded into the canonical instruction template.

## The agentic-harness-kit (workflow-master — Aesop's direct ancestor)

Opus 4.8's static kit: canonical `AGENTS.md` + six hand-maintained adapters, 7 skills, 8
subagents, MCP/plugin docs, three loop families (goal recipes, Ralph, orchestration), three
pathway profiles, a build-side harness (py/rs/go) and an eval harness (rag_compare).

- **Borrow (wholesale):** the canonical instruction template, the skills, the subagents, the
  profiles, the loop content, the three-hard-stops doctrine, the BLUEPRINT thesis, the
  build-with-an-agent methodology (rails first, schema-locked, one PR per phase).
- **Missing (the reason Aesop exists):** it's a kit you copy by hand. `sync-adapters.sh` is a
  shell script, not a compiler; there's no detection, no interview, no manifest, no doctor, no
  registry federation, no write-back. Aesop is the kit, productized into an application.

## The gap, in one table

| Capability | awesome-copilot | ecc | the kit | **Aesop** |
|---|---|---|---|---|
| content library | ✅ | ✅✅ | ✅ | seeds + federates the others |
| multi-harness | ❌ | ✅ (hand-kept) | ✅ (hand-kept) | ✅ compiled from one source |
| project detection / interview | ❌ | ❌ | ❌ | ✅ |
| single-source manifest | ❌ | ❌ | partial (AGENTS.md) | ✅ |
| drift sync + write-back | ❌ | ❌ | ❌ | ✅ |
| environment audit (doctor) | ❌ | ❌ | ❌ | ✅ |
| cost/accuracy pathways | ❌ | install profiles | ✅ (runtime) | ✅ (compile + runtime) |
| native goals/loops | ❌ | ❌ | ✅ (docs) | ✅ (compiled recipes) |
| eject / no lock-in | n/a | n/a | n/a | ✅ |
