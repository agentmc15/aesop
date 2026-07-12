/** Shared rendering: the canonical AGENTS.md, goal recipes, and fence handling for managed files. */
import { AesopError } from "./manifest.js";
import { sha256 } from "./registry.js";
import type { CompileContext, GoalRecipe, Manifest, Profile } from "./types.js";

// --- Fences ---

const FENCE_END = "<!-- aesop:end -->";
const fenceBegin = (hash: string) => `<!-- aesop:begin v1 sha256:${hash} -->`;
const FENCE_RE = /<!-- aesop:begin v1 sha256:[0-9a-f]{64} -->[\s\S]*?<!-- aesop:end -->/;
const PRESERVED_MARKER =
  "<!-- aesop: pre-existing content below — review and fold into aesop.yaml, then delete -->";

export function wrapInlineFence(content: string): string {
  const inner = content.endsWith("\n") ? content : content + "\n";
  return `${fenceBegin(sha256(inner))}\n${inner}${FENCE_END}\n`;
}

/** Extract the generated region's actual vs declared hash; null if no fence present. */
export function fenceDrift(fileContent: string): { drifted: boolean } | null {
  const m = fileContent.match(/<!-- aesop:begin v1 sha256:([0-9a-f]{64}) -->\n([\s\S]*?)<!-- aesop:end -->/);
  if (!m) return null;
  return { drifted: sha256(m[2]!) !== m[1]! };
}

/**
 * Merge generated (already-fenced) content with what's on disk:
 * - fence present → replace the fenced region, keep everything outside byte-for-byte
 * - no fence (pre-existing unmanaged file) → generated on top, old content preserved below a marker
 * - no existing file → generated as-is
 */
export function mergeWithExisting(generatedFenced: string, existing: string | undefined): string {
  if (existing === undefined) return generatedFenced;
  if (FENCE_RE.test(existing)) return existing.replace(FENCE_RE, generatedFenced.trimEnd());
  const old = existing.trimEnd();
  if (!old) return generatedFenced;
  return `${generatedFenced}\n${PRESERVED_MARKER}\n\n${old}\n`;
}

// --- AGENTS.md (the portable standard; emitted once by the compiler core) ---

export function renderProjectBlock(manifest: Manifest, profile: Profile): string {
  const p = manifest.project;
  const lines: string[] = [];
  if (p.stack?.length) lines.push(`- **Stack:** ${p.stack.join(", ")}`);
  if (p.commands.build) lines.push(`- **Build:** \`${p.commands.build}\``);
  lines.push(`- **Test:** \`${p.commands.test}\``);
  if (p.commands.lint) lines.push(`- **Lint:** \`${p.commands.lint}\``);
  if (p.monorepo) lines.push(`- **Monorepo packages:** ${p.monorepo.packages.join(", ")}`);
  if (p.invariants?.length) {
    lines.push(`- **Conventions (load-bearing — never violate):**`);
    for (const inv of p.invariants) lines.push(`  - ${inv}`);
  }
  if (p.models?.primary) {
    const judge = p.models.judge ? `; judge: ${p.models.judge.family} (different family, by design)` : "";
    lines.push(`- **Models:** primary: ${p.models.primary.family}${judge}`);
  }
  lines.push(
    `- **Pathway:** ${profile.name} (effort ${profile.reasoning_effort}; stops: ${profile.stops.max_iterations} iterations / ` +
      `${profile.stops.no_progress_after} no-progress / $${profile.stops.budget_usd})`
  );
  if (p.review_bandwidth) lines.push(`- **Review bandwidth:** at most ${p.review_bandwidth} parallel agents`);
  lines.push(`- **Notes directory:** \`${manifest.state?.dir ?? "tasks/"}\` (todo.md, lessons.md) — read at session start.`);
  return lines.join("\n");
}

export function renderAgentsMd(ctx: CompileContext, opts?: { excludePathBlocks?: boolean }): string {
  const template = ctx.primitives.find((p) => p.type === "instructions");
  if (!template) throw new AesopError(2, "instructions template missing from resolved primitives (this is a bug in aesop)");
  const body = Object.values(template.files)[0]!;

  const blocks = ctx.manifest.primitives.instructions?.blocks ?? [];
  const sections: string[] = [];
  const projectBlocks = blocks.filter((b) => b.scope === "project");
  if (projectBlocks.length) {
    sections.push(projectBlocks.map((b) => b.content.trimEnd()).join("\n\n"), "---");
  }
  // Excluded when the harness expresses path scoping natively (Copilot applyTo, Cursor globs).
  const pathBlocks = opts?.excludePathBlocks ? [] : blocks.filter((b) => b.scope.startsWith("path:"));
  if (pathBlocks.length) {
    const scoped = pathBlocks
      .map((b) => `### \`${b.scope.slice("path:".length)}\`\n\n${b.content.trimEnd()}`)
      .join("\n\n");
    sections.push(`## Scoped rules (apply within the matching paths)\n\n${scoped}`, "---");
  }

  const projectSection = `## Project\n\n${renderProjectBlock(ctx.manifest, ctx.profile)}`;
  const prefix = sections.length ? sections.join("\n\n") + "\n\n" : "";
  return body.replace(/## Project\n\n\{\{PROJECT_BLOCK\}\}\n?/, prefix + projectSection + "\n");
}

// --- Goal recipes (the loops primitive) ---

/** The fixed Ralph prompt: re-fed verbatim every tick; context resets to anchor files. */
export function ralphPrompt(recipe: GoalRecipe, manifest: Manifest): string {
  const state = manifest.state?.dir ?? "tasks/";
  return [
    `Work toward this goal: ${recipe.goal}`,
    ``,
    `The success criterion is mechanical: \`${recipe.verify}\` exits 0. Nothing else counts as done.`,
    ``,
    `Each session: read ${state}todo.md and ${state}lessons.md first, then make the SMALLEST`,
    `verifiable increment toward the goal, run \`${recipe.verify}\` yourself, and update`,
    `${state}todo.md with what you did and what remains. Surgical changes only; follow AGENTS.md.`,
    `If you discover a rule the hard way, append it to ${state}lessons.md.`,
    ``,
    `You have no memory of previous sessions — the ${state} files are your memory. Trust them.`,
  ].join("\n");
}

export function renderRalphConfig(recipe: GoalRecipe, manifest: Manifest): string {
  return (
    JSON.stringify(
      {
        name: recipe.name,
        goal: recipe.goal,
        verify: recipe.verify,
        prompt: ralphPrompt(recipe, manifest),
        stops: recipe.stops,
        est_cost_per_iteration_usd: 0.25,
        agent_command: 'claude -p "$AESOP_PROMPT" --output-format json',
      },
      null,
      2
    ) + "\n"
  );
}

const goalInvocation = (recipe: GoalRecipe): string =>
  `/goal ${recipe.goal} — verified when \`${recipe.verify}\` exits 0. ` +
  `Stop after ${recipe.stops.max_iterations} iterations, ${recipe.stops.no_progress_after} no-progress turns, or $${recipe.stops.budget_usd}.`;

export function renderGoalDoc(recipe: GoalRecipe, manifest: Manifest): string {
  return [
    `# Goal: ${recipe.name}`,
    ``,
    `- **Goal:** ${recipe.goal}`,
    `- **Verify (the stopping condition):** \`${recipe.verify}\` — exits 0 ⇒ done. "Done" is a claim; this is the proof.`,
    `- **Plan gate:** ${recipe.plan_gate === false ? "off" : "on — agree on a plan before execution"}`,
    `- **Hard stops:** ${recipe.stops.max_iterations} iterations · ${recipe.stops.no_progress_after} no-progress · $${recipe.stops.budget_usd}`,
    ``,
    `## Native /goal (Claude Code ≥2.1.139, Codex CLI)`,
    ``,
    `Paste:`,
    ``,
    "```",
    goalInvocation(recipe),
    "```",
    ``,
    `## Portable Ralph runner (any harness)`,
    ``,
    "```bash",
    `aesop goal run ${recipe.name}            # default agent: claude -p`,
    `aesop goal run ${recipe.name} --agent '<any agent CLI reading $AESOP_PROMPT>'`,
    "```",
    ``,
    `Fresh agent each tick, fixed prompt, verify after every tick, all three stops enforced.`,
    `Progress is measured through the verify command's output — make \`${recipe.verify}\` print a`,
    `progress signal (test counts, error counts) so the no-progress detector can see movement.`,
    ``,
    `## Schedule it (discovery loops)`,
    ``,
    "```cron",
    `0 7 * * 1-5  cd $(pwd) && aesop goal run ${recipe.name} --json >> .aesop/goals/${recipe.name}.runs.jsonl`,
    "```",
    ``,
  ].join("\n");
}

/** The mayor/worker pattern with the project's review bandwidth baked in. */
export function renderOrchestrationDoc(manifest: Manifest): string {
  const n = manifest.project.review_bandwidth ?? 2;
  return [
    `# Orchestration — parallel agents without collisions`,
    ``,
    `**max_parallel = ${n}** (your stated review bandwidth, from aesop.yaml). Worktrees make`,
    `parallelism technically free; your capacity to review is the real ceiling. Raise`,
    `\`project.review_bandwidth\` only when you can actually read what ships.`,
    ``,
    `## Worktree per agent (non-negotiable for parallelism)`,
    ``,
    "```bash",
    ...Array.from({ length: n }, (_, i) => `git worktree add ../$(basename $(pwd))-agent-${i + 1} -b agent-${i + 1}`),
    "```",
    ``,
    `One agent per worktree, one task per agent. The mechanical collisions go away; review`,
    `bandwidth doesn't.`,
    ``,
    `## Mayor / workers`,
    ``,
    `1. The mayor (you, or a scheduled triage loop) maintains the work list in \`${manifest.state?.dir ?? "tasks/"}todo.md\`.`,
    `2. Each worker runs one goal recipe in its own worktree (\`aesop goal run <name>\` or native /goal).`,
    `3. Pair every maker with a checker: the reviewer subagent (or a second session) reviews the`,
    `   diff before merge — the author is too lenient grading its own homework.`,
    `4. State lives in git + \`${manifest.state?.dir ?? "tasks/"}\`: a crashed loop resumes from disk, not from memory.`,
    ``,
  ].join("\n");
}
