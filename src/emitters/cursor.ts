/** Cursor emitter — .cursor/rules/*.mdc + .cursor/mcp.json. Cursor reads AGENTS.md natively
 *  (emitted by the core), so rules carry only what AGENTS.md can't express: path-scoped globs,
 *  skill triggers, and a slim always-on pointer.
 *  Target formats: docs/03-harness-matrix.md (update the doc first, then this file). */
import { parseFrontmatter } from "../registry.js";
import { mcpServersJson, portablePromptFiles, rolePromptFiles, slugify } from "./shared.js";
import type { CapabilityMatrix, CompileContext, EmittedFile, Emitter, Manifest } from "../types.js";

export const cursorEmitter: Emitter = {
  harness: "cursor",

  emit(ctx: CompileContext): EmittedFile[] {
    const files: EmittedFile[] = [];
    const p = ctx.manifest.project;

    // Slim always-on rule: the verify loop + where the rest lives. AGENTS.md carries the doctrine.
    const core = [
      "---",
      "description: Project ground rules (compiled by aesop — edit aesop.yaml, not this file)",
      "alwaysApply: true",
      "---",
      "",
      "Follow AGENTS.md at the repo root — it is the canonical instruction file.",
      `Verify loop: \`${p.commands.test}\`${p.commands.lint ? ` · lint: \`${p.commands.lint}\`` : ""}. Run it before claiming done.`,
      `Durable notes live in \`${ctx.manifest.state?.dir ?? "tasks/"}\` (todo.md, lessons.md) — read at session start.`,
      "",
    ].join("\n");
    files.push({ path: ".cursor/rules/00-aesop.mdc", content: core, fence: "sidecar" });

    for (const block of ctx.manifest.primitives.instructions?.blocks ?? []) {
      if (!block.scope.startsWith("path:")) continue;
      const glob = block.scope.slice("path:".length);
      files.push({
        path: `.cursor/rules/scoped-${slugify(glob)}.mdc`,
        content: `---\ndescription: Scoped rules for ${glob}\nglobs: ${glob}\nalwaysApply: false\n---\n\n${block.content.trimEnd()}\n`,
        fence: "sidecar",
      });
    }

    // Skills → agent-requested rules: the description is the trigger (matrix-documented fallback).
    for (const resolved of ctx.primitives.filter((s) => s.type === "skill")) {
      const skillMd = resolved.files["SKILL.md"];
      if (!skillMd) continue;
      const { data, body } = parseFrontmatter(skillMd);
      files.push({
        path: `.cursor/rules/skill-${resolved.name}.mdc`,
        content: `---\ndescription: ${(data.description as string) ?? resolved.name}\nalwaysApply: false\n---\n\n${body.trim()}\n`,
        fence: "sidecar",
      });
    }

    files.push(...rolePromptFiles(ctx), ...portablePromptFiles(ctx));

    const mcp = ctx.manifest.primitives.mcp ?? [];
    if (mcp.length) files.push({ path: ".cursor/mcp.json", content: mcpServersJson(mcp), fence: "sidecar" });

    return files;
  },

  importExisting(rootFiles: Record<string, string>): Partial<Manifest> {
    const blocks = Object.entries(rootFiles)
      .filter(([path]) => path.startsWith(".cursor/rules/") && path.endsWith(".mdc"))
      .map(([, content]) => ({ scope: "project" as const, content }));
    return blocks.length ? { primitives: { instructions: { blocks } } } : {};
  },

  capabilities(): CapabilityMatrix {
    return {
      native: ["instructions", "mcp", "state"],
      fallback: {
        skill: "no native skills — emitted as agent-requested rules (.mdc with description trigger)",
        agent: "no first-class subagents — role prompts in .aesop/roles/ (one session per role)",
        command: "no native prompt registry — portable prompts in .aesop/prompts/",
        hook: "no native hooks — git pre-commit wrapper lands in Phase 6",
        permissions: "allowlist lives in app settings, not a repo file — not emitted",
        loop: "no first-party /goal — portable Ralph runner lands in Phase 6",
      },
      goalMode: "ralph",
    };
  },
};
