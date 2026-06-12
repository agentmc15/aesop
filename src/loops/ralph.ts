/** The portable Ralph runner: a fresh agent invocation per tick with a FIXED prompt (context
 *  resets to the anchor files — tasks/todo.md, lessons.md — instead of growing), verify after
 *  every tick, and the three hard stops. Works with any agent CLI that reads $AESOP_PROMPT.
 *
 *  Progress is measured through the verification lens: if the verify command's output is
 *  identical for N consecutive ticks, nothing is progressing — halt. Recipes should verify
 *  with something that prints a progress signal (test counts, error counts). */
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { sha256 } from "../registry.js";
import type { GoalRecipe } from "../types.js";

const exec = promisify(execFile);

export interface RalphConfig {
  recipe: GoalRecipe;
  /** Shell command for one agent tick; receives AESOP_PROMPT / AESOP_GOAL / AESOP_VERIFY / AESOP_ITERATION. */
  agentCommand: string;
  prompt: string;
  /** Used for the budget stop when the agent's output carries no cost JSON. */
  estCostPerIterationUsd?: number;
  /** Per-tick timeout, ms. */
  tickTimeoutMs?: number;
}

export interface RalphResult {
  status: "verified" | "max_iterations" | "no_progress" | "budget";
  iterations: number;
  costUsd: number;
}

interface RunOutput {
  ok: boolean;
  output: string;
}

async function sh(command: string, cwd: string, env: Record<string, string>, timeout: number): Promise<RunOutput> {
  try {
    // The loop command inherits the full environment (the default agent, `claude -p`, needs its
    // API key). A recipe's verify/agent command therefore runs with the user's secrets in scope —
    // only run recipes from an aesop.yaml you trust (F8). MCP callers cannot supply the command (F2).
    const { stdout, stderr } = await exec("sh", ["-c", command], {
      cwd,
      env: { ...process.env, ...env },
      timeout,
      maxBuffer: 16 * 1024 * 1024,
    });
    return { ok: true, output: stdout + stderr };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string };
    return { ok: false, output: (err.stdout ?? "") + (err.stderr ?? "") };
  }
}

/** Last JSON object in the output that carries a cost field (claude -p --output-format json does). */
export function parseCost(output: string): number | undefined {
  let cost: number | undefined;
  for (const line of output.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      const obj = JSON.parse(trimmed) as { total_cost_usd?: number; cost_usd?: number };
      const c = obj.total_cost_usd ?? obj.cost_usd;
      if (typeof c === "number") cost = c;
    } catch {
      // not JSON — fine
    }
  }
  return cost;
}

export async function runRalph(
  cfg: RalphConfig,
  opts: { cwd: string; onTick?: (state: { iteration: number; costUsd: number; verified: boolean }) => void }
): Promise<RalphResult> {
  const { stops } = cfg.recipe;
  const est = cfg.estCostPerIterationUsd ?? 0.25;
  const tickTimeout = cfg.tickTimeoutMs ?? 600_000;
  const statePath = join(opts.cwd, ".aesop", "goals", `${cfg.recipe.name}.state.json`);

  const verify = () => sh(cfg.recipe.verify, opts.cwd, {}, 120_000);

  // Maybe the goal is already met — verify before spending anything.
  let v = await verify();
  if (v.ok) return { status: "verified", iterations: 0, costUsd: 0 };

  let costUsd = 0;
  const verifyHashes: string[] = [];

  for (let iteration = 1; iteration <= stops.max_iterations; iteration++) {
    const agent = await sh(
      cfg.agentCommand,
      opts.cwd,
      {
        AESOP_PROMPT: cfg.prompt,
        AESOP_GOAL: cfg.recipe.goal,
        AESOP_VERIFY: cfg.recipe.verify,
        AESOP_ITERATION: String(iteration),
      },
      tickTimeout
    );
    costUsd += parseCost(agent.output) ?? est;

    v = await verify();
    await mkdir(dirname(statePath), { recursive: true });
    await writeFile(
      statePath,
      JSON.stringify({ goal: cfg.recipe.name, iteration, costUsd, verified: v.ok }, null, 2) + "\n",
      "utf8"
    );
    opts.onTick?.({ iteration, costUsd, verified: v.ok });

    if (v.ok) return { status: "verified", iterations: iteration, costUsd };
    if (costUsd >= stops.budget_usd) return { status: "budget", iterations: iteration, costUsd };

    const h = sha256(v.output + (v.ok ? "0" : "1"));
    verifyHashes.push(h);
    const k = stops.no_progress_after;
    if (verifyHashes.length >= k && verifyHashes.slice(-k).every((x) => x === h)) {
      return { status: "no_progress", iterations: iteration, costUsd };
    }
  }
  return { status: "max_iterations", iterations: stops.max_iterations, costUsd };
}
