# Karpathy — verified notes (June 2026)

Primary source: his own writeup of the Sequoia Ascent 2026 talk —
[karpathy.bearblog.dev/sequoia-ascent-2026](https://karpathy.bearblog.dev/sequoia-ascent-2026/).
Secondary: the multica-ai/andrej-karpathy-skills distillation; 2025 material (Software 3.0 talk,
context-engineering endorsement, nanochat, Dwarkesh interview) where it still applies.

## The claims

1. **Software 3.0.** Programming moved from explicit code (1.0) to learned weights (2.0) to
   "prompting LLMs through prompts, context, tools, examples, memory, and instructions." The
   context window is the programmable interface.
2. **The December 2025 inflection.** Generated chunks got "larger, more coherent, and more
   reliable"; he couldn't remember the last time he corrected the model. The unit of programming
   is now the **macro action** — implement this feature, refactor this subsystem, research this
   library, write tests and fix failures, compare approaches and propose a plan. The programmer
   becomes an orchestrator of agents.
3. **The verifiability law.** Traditional software automates what you can *specify*; LLMs automate
   what you can **verify**. Capability ≈ verifiability × training attention × data coverage ×
   economic value. Models are "jagged" — they spike in verifiable domains (math, code) and
   stagnate elsewhere.
4. **Vibe coding vs agentic engineering.** Vibe coding *raises the floor* (anyone can build);
   agentic engineering *raises the ceiling* (professional discipline preserving quality, security,
   correctness). "You are not allowed to introduce vulnerabilities because of vibe coding. You are
   still responsible for your software."
5. **What stays human.** Spec, design, judgment, taste, security boundaries, catching subtle
   logical errors (his MenuGen bug — correlating accounts by email — is the canonical example).
   **"You can outsource your thinking, but you can't outsource your understanding."**
6. **Agent-native infrastructure.** Products must expose CLIs, APIs, MCP servers, machine-readable
   schemas, structured logs. Docs should describe *what to copy-paste to agents*, not what humans
   should click. Focus on "sensors and actuators" — how agents observe and modify the world.
7. **Ghosts, not animals.** LLMs are statistical simulations without intrinsic motivation, with
   surprising brittleness. Empirically map where they work vs fail; design for jaggedness.
8. **Hiring.** Coding puzzles are obsolete; better: build a real project with agents, deploy it
   securely, survive ten adversarial agents trying to break it. Mastery gaps may be "much more
   extreme" than the 10x-engineer meme.

## The 11 principles (multica-ai/andrej-karpathy-skills CLAUDE.md)

Explicit assumption-stating · tradeoff communication · clarifying questions over guessing ·
simplicity bias (minimum viable code, no speculative features) · no premature abstraction ·
minimal scope · surgical editing (preserve style and existing dead code) · behavioral matching
(mirror codebase conventions) · orphan cleanup (only what *your* change orphaned) · test-first
verification · plan documentation with explicit verification checkpoints. Escape hatch: "for
trivial tasks, use judgment."

## How Aesop encodes each

| Karpathy says | Aesop encodes |
|---|---|
| automate what you can verify | `doctor` requires a working verify loop; goal recipes require measurable stopping conditions; pathway autonomy scales with verifiability |
| context window is the interface | instruction files budgeted (~250 lines), progressive-disclosure skills, compaction rules per pathway |
| agent-native infrastructure | `--json` on every command, `aesop mcp serve`, JSON Schemas for all artifacts |
| raise the ceiling | guardrails + maker/checker defaults; safety never relaxes with the pathway dial |
| can't outsource understanding | review-bandwidth caps on parallelism; explain/walkthrough commands in every emitted environment |
| 11 principles | the canonical instruction template (`registry/instructions/AGENTS.template.md`) |
| jagged ghosts | verification after generation, never trust claims without execution |

Sources: [Sequoia Ascent 2026 (Karpathy's own summary)](https://karpathy.bearblog.dev/sequoia-ascent-2026/) ·
[vibe coding → agentic engineering coverage](https://completerpabootcamp.com/blogs/andrej-karpathy-from-vibe-coding-to-agentic-engineering) ·
[karpathy-skills CLAUDE.md](https://github.com/multica-ai/andrej-karpathy-skills/blob/main/CLAUDE.md) ·
Software 3.0 (YC AI Startup School, Jun 2025) · context-engineering endorsement (X, Jun 2025) ·
nanochat + Dwarkesh interview (Oct 2025).
