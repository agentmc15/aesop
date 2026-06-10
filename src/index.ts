#!/usr/bin/env node
/**
 * aesop — environment compiler for AI coding agents.
 * Library-first: commands live in src/commands/ and throw AesopError; only this shell exits.
 */
import { parseArgs } from "node:util";
import { AesopError } from "./manifest.js";
import { runInit, initSummary } from "./commands/init.js";

const COMMANDS: Record<string, { phase: number; summary: string }> = {
  init: { phase: 1, summary: "detect project → interview → write aesop.yaml (--yes, --force, --harness a,b, --pathway p)" },
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

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      yes: { type: "boolean", short: "y" },
      force: { type: "boolean" },
      json: { type: "boolean" },
      help: { type: "boolean", short: "h" },
      harness: { type: "string" },
      pathway: { type: "string" },
      cwd: { type: "string" },
    },
    allowPositionals: true,
  });

  const cmd = positionals[0];
  if (!cmd || values.help || cmd === "help") {
    console.log(help());
    return 0;
  }

  const known = COMMANDS[cmd];
  if (!known) {
    console.error(`aesop: unknown command '${cmd}'\n\n${help()}`);
    return 1;
  }

  switch (cmd) {
    case "init": {
      const result = await runInit({
        cwd: values.cwd ?? process.cwd(),
        ...(values.yes ? { yes: true } : {}),
        ...(values.force ? { force: true } : {}),
        ...(values.json ? { json: true } : {}),
        ...(values.harness ? { harness: values.harness } : {}),
        ...(values.pathway ? { pathway: values.pathway } : {}),
      });
      console.log(values.json ? JSON.stringify({ path: result.path, manifest: result.manifest }, null, 2) : initSummary(result));
      return 0;
    }
    default:
      console.error(`aesop ${cmd}: not yet implemented (lands in Phase ${known.phase} — docs/08-roadmap.md).`);
      return 1;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((e: unknown) => {
    if (e instanceof AesopError) {
      console.error(`aesop: ${e.message}`);
      process.exit(e.exitCode);
    }
    console.error(e);
    process.exit(1);
  });
