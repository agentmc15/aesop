/** Shared rendering: the canonical AGENTS.md, and fence handling for managed files. */
import { sha256 } from "./registry.js";
import type { CompileContext, Manifest, Profile } from "./types.js";

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
  if (!template) throw new Error("instructions template missing from resolved primitives");
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
