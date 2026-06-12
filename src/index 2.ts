#!/usr/bin/env node
/**
 * aesop — environment compiler for AI coding agents.
 * Phase 0 skeleton: command routing locked; implementations land per docs/08-roadmap.md.
 * Library-first: the compiler is an API; this CLI and `aesop mcp serve` are thin shells.
 */

const COMMANDS: Record<string, { phase: number; summary: string }> = {
  init: { phase: 1, summary: "detect project → interview → write aesop.yaml → first compile" },
  compile: { phase: 2, summary: "manifest → native files for every selected harness (--check for CI)" },
  sync: { phase: 4, summary: "detect drift in fenced regions; --write-back lifts edits into the manifest" },
  doctor: { phase: 4, summary: "audit the environment: verify loop, MCP health, stops, secrets, budgets" },
  add: { phase: 5, summary: "add a primitive from any registered source (builtin, ecc, awesome-copilot, git)" },
  remove: { phase: 5, summary: "remove a primitive and recompile" },
  list: { phase: 5, summary: "list installed/available primitives" },
  goal: { phase: 6, summary: "author/emit goal recipes — /goal natively, Ralph runner elsewhere" },
  bundle: { phase: 7, summary: "package the environment as a claude-plugin / copilot-plugin / tarball" },
  update: { phase: 5, summary: "diff registry updates for review; --apply after review only" },
  lessons: { phase: 4, summary: "append to tasks/lessons.md; --promote lifts a lesson into a rule" },
  profile: { phase: 2, summary: "list/show/new/set pathway profiles" },
  eject: { phase: 4, summary: "strip fences and manifest; leave plain native files (no lock-in)" },
  mcp: { phase: 7, summary: "serve the CLI surface as an MCP server for in-session use by agents" },
};

function help(): string {
  const rows = Object.entries(COMMANDS)
    .map(([name, c]) => `  ${name.padEnd(9)} ${c.summary}`)
    .join("\n");
  return [
    "aesop — tells your project's story to every agent, in each agent's native tongue.",
    "",
    "Usage: aesop <command> [options]   (every command supports --json)",
    "",
    rows,
    "",
    "Docs: PLAN.md · docs/06-cli-spec.md · roadmap: docs/08-roadmap.md",
  ].join("\n");
}

const [cmd] = process.argv.slice(2);
if (!cmd || cmd === "--help" || cmd === "-h" || cmd === "help") {
  console.log(help());
  process.exit(0);
}
const known = COMMANDS[cmd];
if (!known) {
  console.error(`aesop: unknown command '${cmd}'\n\n${help()}`);
  process.exit(1);
}
// IMPLEMENT (Phase ${known.phase}): see docs/06-cli-spec.md#aesop-${cmd} and docs/08-roadmap.md.
console.error(
  `aesop ${cmd}: not yet implemented (lands in Phase ${known.phase} — docs/08-roadmap.md).`
);
process.exit(1);
