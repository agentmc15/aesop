import { test } from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { goalNew, goalRun } from "./commands/goal.js";
import { runCompile } from "./commands/compile.js";
import { parseCost, runRalph } from "./loops/ralph.js";
import type { GoalRecipe } from "./types.js";

const fixturePath = (name: string) => fileURLToPath(new URL(`../fixtures/compile/${name}`, import.meta.url));

const recipe = (over?: Partial<GoalRecipe["stops"]>): GoalRecipe => ({
  name: "test-goal",
  goal: "counter.txt reaches 3 lines",
  verify: "wc -l < counter.txt | tr -d ' ' && test $(wc -l < counter.txt) -ge 3",
  stops: { max_iterations: 10, no_progress_after: 3, budget_usd: 5, ...over },
});

const config = (agentCommand: string, stops?: Partial<GoalRecipe["stops"]>) => ({
  recipe: recipe(stops),
  agentCommand,
  prompt: "make progress",
  estCostPerIterationUsd: 0.1,
});

test("GOAL LINE (ralph half): a recipe runs to verified completion via the Ralph runner", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aesop-ralph-"));
  await writeFile(join(dir, "counter.txt"), "", "utf8");
  // Stub agent: one verifiable increment per tick, reporting cost like `claude -p --output-format json`.
  const result = await runRalph(config(`echo line >> counter.txt; echo '{"total_cost_usd":0.01}'`), { cwd: dir });
  assert.equal(result.status, "verified");
  assert.equal(result.iterations, 3);
  assert.ok(Math.abs(result.costUsd - 0.03) < 1e-9, `cost ${result.costUsd}`);
  // durable state on disk survives the run
  const state = JSON.parse(await readFile(join(dir, ".aesop/goals/test-goal.state.json"), "utf8"));
  assert.equal(state.verified, true);
  await rm(dir, { recursive: true, force: true });
});

test("GOAL LINE: hard stop 1 — iteration ceiling halts an unbounded loop", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aesop-ralph-iter-"));
  await writeFile(join(dir, "counter.txt"), "", "utf8");
  // progress every tick (verify output changes) but the goal needs 3 lines at 1 line per 2 ticks? no —
  // make goal unreachable within the ceiling: 10 lines needed, 4 iterations allowed.
  const cfg = config(`echo line >> counter.txt`, { max_iterations: 4 });
  cfg.recipe.verify = "wc -l < counter.txt | tr -d ' ' && test $(wc -l < counter.txt) -ge 10";
  const result = await runRalph(cfg, { cwd: dir });
  assert.equal(result.status, "max_iterations");
  assert.equal(result.iterations, 4);
  await rm(dir, { recursive: true, force: true });
});

test("GOAL LINE: hard stop 2 — no-progress detector halts a stuck loop", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aesop-ralph-stuck-"));
  await writeFile(join(dir, "counter.txt"), "", "utf8");
  // agent does nothing → verify output identical every tick → halt after no_progress_after ticks
  const result = await runRalph(config("true", { no_progress_after: 2 }), { cwd: dir });
  assert.equal(result.status, "no_progress");
  assert.equal(result.iterations, 2, "should halt exactly at the no-progress window, not the ceiling");
  await rm(dir, { recursive: true, force: true });
});

test("GOAL LINE: hard stop 3 — budget ceiling halts an expensive loop", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aesop-ralph-budget-"));
  await writeFile(join(dir, "counter.txt"), "", "utf8");
  // progress each tick but each tick costs $0.6 against a $1 budget → halt at tick 2 ($1.20)
  const result = await runRalph(
    config(`echo line >> counter.txt; echo '{"total_cost_usd":0.6}'`, { budget_usd: 1 }),
    { cwd: dir }
  );
  assert.equal(result.status, "budget");
  assert.equal(result.iterations, 2);
  assert.ok(result.costUsd >= 1);
  await rm(dir, { recursive: true, force: true });
});

test("verify-before-start: an already-met goal spends nothing", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aesop-ralph-done-"));
  await writeFile(join(dir, "counter.txt"), "a\nb\nc\n", "utf8");
  const result = await runRalph(config("echo should-not-run >> counter.txt"), { cwd: dir });
  assert.equal(result.status, "verified");
  assert.equal(result.iterations, 0);
  assert.equal(result.costUsd, 0);
  assert.equal(await readFile(join(dir, "counter.txt"), "utf8"), "a\nb\nc\n", "agent ran despite met goal");
  await rm(dir, { recursive: true, force: true });
});

test("parseCost reads the last cost JSON line and ignores noise", () => {
  assert.equal(parseCost('hello\n{"total_cost_usd":0.5}\nnoise {not json}\n{"cost_usd":0.7}\n'), 0.7);
  assert.equal(parseCost("no json here"), undefined);
});

test("GOAL LINE (native half): compile emits the /goal invocation + per-harness goal commands", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aesop-goal-emit-"));
  await cp(join(fixturePath("full"), "aesop.yaml"), join(dir, "aesop.yaml"));
  await runCompile({ cwd: dir });

  const doc = await readFile(join(dir, ".aesop/goals/green-tests.md"), "utf8");
  assert.ok(doc.includes("/goal all workspace tests pass"), "paste-ready /goal text missing");
  assert.ok(doc.includes("Stop after 40 iterations, 3 no-progress turns, or $25"));
  const ralph = JSON.parse(await readFile(join(dir, ".aesop/goals/green-tests.ralph.json"), "utf8"));
  assert.equal(ralph.verify, "pnpm test");
  assert.deepEqual(ralph.stops, { max_iterations: 40, no_progress_after: 3, budget_usd: 25 });
  assert.ok(ralph.prompt.includes("tasks/todo.md"), "Ralph prompt must anchor to the state files");
  assert.ok((await readFile(join(dir, ".claude/commands/goal-green-tests.md"), "utf8")).includes("pnpm test"));
  assert.ok((await readFile(join(dir, ".codex/prompts/goal-green-tests.md"), "utf8")).includes("pnpm test"));
  const orch = await readFile(join(dir, ".aesop/orchestration.md"), "utf8");
  assert.ok(orch.includes("max_parallel = 3"), "orchestration must bake in review_bandwidth");
  await rm(dir, { recursive: true, force: true });
});

test("goal new (profile-default stops) + goal run end to end through the CLI layer", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aesop-goal-cli-"));
  await cp(join(fixturePath("minimal"), "aesop.yaml"), join(dir, "aesop.yaml"));
  await runCompile({ cwd: dir });

  const created = await goalNew({
    cwd: dir,
    name: "three-lines",
    goal: "counter.txt reaches 3 lines",
    verify: "wc -l < counter.txt | tr -d ' ' && test $(wc -l < counter.txt) -ge 3",
    budgetUsd: 2,
  });
  assert.equal(created.stops.max_iterations, 40, "stops should default from the balanced profile");
  assert.equal(created.stops.budget_usd, 2, "explicit flag should override the profile default");

  await writeFile(join(dir, "counter.txt"), "", "utf8");
  const result = await goalRun({ cwd: dir, name: "three-lines", agent: "echo line >> counter.txt" });
  assert.equal(result.status, "verified");
  assert.equal(result.iterations, 3);
  await rm(dir, { recursive: true, force: true });
});
