/** `aesop goal` — author and run goal recipes. list / show / new / run.
 *  Native /goal where the harness has one; the Ralph runner everywhere. */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import { runCompile } from "./compile.js";
import { runRalph, type RalphResult } from "../loops/ralph.js";
import { serializeManifest, validateManifest, AesopError } from "../manifest.js";
import { loadProfile } from "../profile.js";
import { ralphPrompt, renderGoalDoc } from "../render.js";
import type { GoalRecipe, Manifest } from "../types.js";

async function loadManifest(cwd: string): Promise<Manifest> {
  const raw = await readFile(join(cwd, "aesop.yaml"), "utf8").catch(() => {
    throw new AesopError(1, `no aesop.yaml in ${cwd} — run \`aesop init\` first`);
  });
  return parse(raw) as Manifest;
}

function findRecipe(manifest: Manifest, name: string): GoalRecipe {
  const recipe = (manifest.primitives.loops ?? []).find((l) => l.name === name);
  if (!recipe) {
    const known = (manifest.primitives.loops ?? []).map((l) => l.name).join(", ") || "(none)";
    throw new AesopError(1, `no goal recipe '${name}' in aesop.yaml (have: ${known}) — \`aesop goal new ${name} --goal "…" --verify "…"\``);
  }
  return recipe;
}

export async function goalList(cwd: string): Promise<string[]> {
  const manifest = await loadManifest(cwd);
  return (manifest.primitives.loops ?? []).map(
    (l) => `${l.name.padEnd(20)} verify: ${l.verify}  stops: ${l.stops.max_iterations}/${l.stops.no_progress_after}/$${l.stops.budget_usd}`
  );
}

export async function goalShow(cwd: string, name: string): Promise<string> {
  const manifest = await loadManifest(cwd);
  return renderGoalDoc(findRecipe(manifest, name), manifest);
}

export interface GoalNewOptions {
  cwd: string;
  name: string;
  goal: string;
  verify: string;
  maxIterations?: number;
  noProgressAfter?: number;
  budgetUsd?: number;
}

export async function goalNew(opts: GoalNewOptions): Promise<GoalRecipe> {
  if (!opts.goal || !opts.verify) {
    throw new AesopError(1, 'usage: aesop goal new <name> --goal "<end state>" --verify "<command that exits 0 when done>"');
  }
  const manifest = await loadManifest(opts.cwd);
  // Stop defaults come from the active pathway — the dial sets the budget, the recipe can tighten it.
  const profile = loadProfile(manifest.pathway.profile, opts.cwd, manifest.pathway.overrides);
  const recipe: GoalRecipe = {
    name: opts.name,
    goal: opts.goal,
    verify: opts.verify,
    plan_gate: true,
    stops: {
      max_iterations: opts.maxIterations ?? profile.stops.max_iterations,
      no_progress_after: opts.noProgressAfter ?? profile.stops.no_progress_after,
      budget_usd: opts.budgetUsd ?? profile.stops.budget_usd,
    },
  };
  const loops = (manifest.primitives.loops ??= []);
  if (loops.some((l) => l.name === opts.name)) throw new AesopError(1, `goal recipe '${opts.name}' already exists`);
  loops.push(recipe);
  const { valid, errors } = validateManifest(manifest);
  if (!valid) throw new AesopError(2, `recipe failed validation:\n  - ${errors.join("\n  - ")}`);
  await writeFile(join(opts.cwd, "aesop.yaml"), serializeManifest(manifest, `updated by \`aesop goal new ${opts.name}\``), "utf8");
  await runCompile({ cwd: opts.cwd });
  return recipe;
}

export async function goalRun(opts: { cwd: string; name: string; agent?: string; onTick?: Parameters<typeof runRalph>[1]["onTick"] }): Promise<RalphResult> {
  const manifest = await loadManifest(opts.cwd);
  const recipe = findRecipe(manifest, opts.name);
  // Prefer the compiled ralph.json (carries any hand-tuned agent_command); fall back to manifest.
  let agentCommand = 'claude -p "$AESOP_PROMPT" --output-format json';
  let est = 0.25;
  try {
    const cfg = JSON.parse(await readFile(join(opts.cwd, ".aesop", "goals", `${recipe.name}.ralph.json`), "utf8")) as {
      agent_command?: string;
      est_cost_per_iteration_usd?: number;
    };
    if (cfg.agent_command) agentCommand = cfg.agent_command;
    if (typeof cfg.est_cost_per_iteration_usd === "number") est = cfg.est_cost_per_iteration_usd;
  } catch {
    // not compiled yet — defaults are fine
  }
  if (opts.agent) agentCommand = opts.agent;

  return runRalph(
    {
      recipe,
      agentCommand,
      prompt: ralphPrompt(recipe, manifest),
      estCostPerIterationUsd: est,
    },
    { cwd: opts.cwd, ...(opts.onTick ? { onTick: opts.onTick } : {}) }
  );
}

export function goalRunSummary(result: RalphResult, name: string): string {
  const head =
    result.status === "verified"
      ? `✓ goal '${name}' VERIFIED in ${result.iterations} iteration(s)`
      : `✗ goal '${name}' halted: ${result.status.replace("_", "-")} after ${result.iterations} iteration(s)`;
  return `${head} (cost ≈ $${result.costUsd.toFixed(2)})${result.status === "verified" ? "" : "\nthe loop stopped honestly — review .aesop/goals/" + name + ".state.json and tasks/todo.md before raising the stops"}`;
}
