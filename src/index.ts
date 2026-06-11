#!/usr/bin/env node
/**
 * aesop — environment compiler for AI coding agents.
 * Library-first: commands live in src/commands/ and throw AesopError; only this shell exits.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { AesopError } from "./manifest.js";
import { runInit, initSummary } from "./commands/init.js";
import { runCompile, compileSummary } from "./commands/compile.js";
import { runSync, syncSummary } from "./commands/sync.js";
import { runDoctor, doctorSummary } from "./commands/doctor.js";
import { runLessons } from "./commands/lessons.js";
import { runEject } from "./commands/eject.js";
import { runAdd, runRemove, runList } from "./commands/add.js";
import { runUpdate, updateSummary } from "./commands/update.js";
import { goalList, goalNew, goalRun, goalRunSummary, goalShow } from "./commands/goal.js";
import { listProfiles } from "./profile.js";

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
      check: { type: "boolean" },
      verbose: { type: "boolean" },
      accept: { type: "boolean" },
      "write-back": { type: "boolean" },
      fix: { type: "boolean" },
      matrix: { type: "boolean" },
      promote: { type: "boolean" },
      apply: { type: "boolean" },
      available: { type: "boolean" },
      from: { type: "string" },
      goal: { type: "string" },
      verify: { type: "string" },
      agent: { type: "string" },
      "max-iterations": { type: "string" },
      "no-progress-after": { type: "string" },
      "budget-usd": { type: "string" },
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
    case "compile": {
      const result = await runCompile({
        cwd: values.cwd ?? process.cwd(),
        ...(values.check ? { check: true } : {}),
        ...(values.verbose ? { verbose: true } : {}),
        ...(values.harness ? { harness: values.harness } : {}),
        ...(values.pathway ? { pathway: values.pathway } : {}),
      });
      console.log(values.json ? JSON.stringify(result, null, 2) : compileSummary(result, !!values.check));
      return values.check && result.drift.length ? 3 : 0;
    }
    case "sync": {
      const result = await runSync({
        cwd: values.cwd ?? process.cwd(),
        ...(values.accept ? { accept: true } : {}),
        ...(values["write-back"] ? { writeBack: true } : {}),
      });
      console.log(values.json ? JSON.stringify(result, null, 2) : syncSummary(result, { cwd: "", accept: values.accept ?? false, writeBack: values["write-back"] ?? false }));
      return result.drift.length && !values.accept && !values["write-back"] ? 3 : 0;
    }
    case "doctor": {
      const result = await runDoctor({
        cwd: values.cwd ?? process.cwd(),
        ...(values.fix ? { fix: true } : {}),
        ...(values.matrix ? { matrix: true } : {}),
      });
      console.log(values.json ? JSON.stringify(result, null, 2) : doctorSummary(result));
      return result.findings.length ? 3 : 0;
    }
    case "goal": {
      const cwd = values.cwd ?? process.cwd();
      const [, sub, name] = positionals;
      if (sub === "list" || !sub) {
        const lines = await goalList(cwd);
        console.log(values.json ? JSON.stringify(lines, null, 2) : lines.length ? lines.map((l) => `  ${l}`).join("\n") : "  (no goal recipes — aesop goal new <name> --goal \"…\" --verify \"…\")");
        return 0;
      }
      if (sub === "show" && name) {
        console.log(await goalShow(cwd, name));
        return 0;
      }
      if (sub === "new" && name) {
        const recipe = await goalNew({
          cwd,
          name,
          goal: values.goal ?? "",
          verify: values.verify ?? "",
          ...(values["max-iterations"] ? { maxIterations: Number(values["max-iterations"]) } : {}),
          ...(values["no-progress-after"] ? { noProgressAfter: Number(values["no-progress-after"]) } : {}),
          ...(values["budget-usd"] ? { budgetUsd: Number(values["budget-usd"]) } : {}),
        });
        console.log(values.json ? JSON.stringify(recipe, null, 2) : `recipe '${name}' added and compiled — \`aesop goal show ${name}\` for the /goal text, \`aesop goal run ${name}\` for the portable loop.`);
        return 0;
      }
      if (sub === "run" && name) {
        const result = await goalRun({
          cwd,
          name,
          ...(values.agent ? { agent: values.agent } : {}),
          onTick: (s) => console.error(`  tick ${s.iteration}: ${s.verified ? "VERIFIED" : "not yet"} (≈$${s.costUsd.toFixed(2)})`),
        });
        console.log(values.json ? JSON.stringify(result, null, 2) : goalRunSummary(result, name));
        return result.status === "verified" ? 0 : 3;
      }
      console.error("usage: aesop goal [list | show <name> | new <name> --goal … --verify … | run <name> [--agent <cmd>]]");
      return 1;
    }
    case "add": {
      const [, type, name] = positionals;
      if (!type || !name) {
        console.error("usage: aesop add <skill|agent|command|instructions> <name> [--from <registry>]");
        return 1;
      }
      const result = await runAdd({ cwd: values.cwd ?? process.cwd(), type, name, ...(values.from ? { from: values.from } : {}) });
      console.log(values.json ? JSON.stringify(result, null, 2) : `added ${type} '${name}' from ${result.registry}; recompiled.`);
      return 0;
    }
    case "remove": {
      const [, type, name] = positionals;
      if (!type || !name) {
        console.error("usage: aesop remove <skill|agent|command|instructions> <name>");
        return 1;
      }
      const result = await runRemove({ cwd: values.cwd ?? process.cwd(), type, name });
      console.log(
        values.json
          ? JSON.stringify(result, null, 2)
          : `removed ${type} '${name}'; recompiled.${result.deleted.length ? `\ndeleted orphans:\n${result.deleted.map((d) => `  ✗ ${d}`).join("\n")}` : ""}`
      );
      return 0;
    }
    case "list": {
      const lines = await runList({
        cwd: values.cwd ?? process.cwd(),
        ...(positionals[1] ? { type: positionals[1] } : {}),
        ...(values.available ? { available: true } : {}),
      });
      console.log(values.json ? JSON.stringify(lines, null, 2) : lines.length ? lines.map((l) => `  ${l}`).join("\n") : "  (none)");
      return 0;
    }
    case "update": {
      const result = await runUpdate({ cwd: values.cwd ?? process.cwd(), ...(values.apply ? { apply: true } : {}) });
      console.log(values.json ? JSON.stringify(result, null, 2) : updateSummary(result));
      return 0;
    }
    case "lessons": {
      const result = await runLessons({
        cwd: values.cwd ?? process.cwd(),
        text: positionals.slice(1).join(" "),
        ...(values.promote ? { promote: true } : {}),
      });
      console.log(values.json ? JSON.stringify(result, null, 2) : `recorded in ${result.file}${result.promoted ? " and promoted to an instruction rule (recompiled)" : ""}`);
      return 0;
    }
    case "eject": {
      const result = await runEject({ cwd: values.cwd ?? process.cwd(), ...(values.force ? { force: true } : {}) });
      console.log(values.json ? JSON.stringify(result, null, 2) : `ejected: removed aesop.yaml and .aesop/; unfenced ${result.unfenced.length} file(s). The native files are yours.`);
      return 0;
    }
    case "profile": {
      const sub = positionals[1] ?? "list";
      const root = values.cwd ?? process.cwd();
      if (sub === "list") {
        const profiles = listProfiles(root);
        console.log(
          values.json
            ? JSON.stringify(profiles, null, 2)
            : profiles.map((p) => `  ${p.name.padEnd(14)} (${p.source})`).join("\n")
        );
        return 0;
      }
      if (sub === "show" && positionals[2]) {
        const dir = fileURLToPath(new URL("../profiles", import.meta.url));
        console.log(readFileSync(join(dir, `${positionals[2]}.yaml`), "utf8"));
        return 0;
      }
      console.error("usage: aesop profile [list | show <name>]   (new/set land in Phase 4)");
      return 1;
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
