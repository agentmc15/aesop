/** GitHub Copilot emitter (CLI + VS Code agent mode) — .github/{copilot-instructions.md,
 *  instructions/*.instructions.md (applyTo), prompts/*.prompt.md, agents/*.md, skills/}, .vscode/mcp.json.
 *  Target formats: docs/03-harness-matrix.md (update the doc first, then this file). */
import { parseAgent, refName } from "../registry.js";
import { renderAgentsMd } from "../render.js";
import { slugify, vscodeMcpJson } from "./shared.js";
import type { CapabilityMatrix, CompileContext, EmittedFile, Emitter, Manifest } from "../types.js";

export const copilotEmitter: Emitter = {
  harness: "copilot",

  emit(ctx: CompileContext): EmittedFile[] {
    const files: EmittedFile[] = [];

    // Copilot's canonical instruction home. Path-scoped blocks are excluded here because Copilot
    // expresses them natively below — the one harness-native path-scoping in the matrix.
    files.push({
      path: ".github/copilot-instructions.md",
      content: renderAgentsMd(ctx, { excludePathBlocks: true }),
      fence: "sidecar",
    });

    for (const block of ctx.manifest.primitives.instructions?.blocks ?? []) {
      if (!block.scope.startsWith("path:")) continue;
      const glob = block.scope.slice("path:".length);
      files.push({
        path: `.github/instructions/${slugify(glob)}.instructions.md`,
        content: `---\napplyTo: "${glob}"\n---\n\n${block.content.trimEnd()}\n`,
        fence: "sidecar",
      });
    }

    for (const resolved of ctx.primitives.filter((p) => p.type === "command")) {
      files.push({
        path: `.github/prompts/${resolved.name}.prompt.md`,
        content: Object.values(resolved.files)[0]!,
        fence: "sidecar",
      });
    }

    for (const resolved of ctx.primitives.filter((p) => p.type === "agent")) {
      const ref = (ctx.manifest.primitives.agents ?? []).find((r) => refName(r) === resolved.name);
      const spec = parseAgent(resolved, ref);
      const readOnly = spec.edits ? "" : "\nYou are read-only: never edit, write, or execute mutating commands.\n";
      files.push({
        path: `.github/agents/${spec.name}.md`,
        content: `---\nname: ${spec.name}\ndescription: ${spec.description}\n---\n\n${spec.prompt}\n${readOnly}`,
        fence: "sidecar",
      });
    }

    for (const resolved of ctx.primitives.filter((p) => p.type === "skill")) {
      for (const [rel, content] of Object.entries(resolved.files)) {
        files.push({ path: `.github/skills/${resolved.name}/${rel}`, content, fence: "sidecar" });
      }
    }

    const mcp = ctx.manifest.primitives.mcp ?? [];
    if (mcp.length) files.push({ path: ".vscode/mcp.json", content: vscodeMcpJson(mcp), fence: "sidecar" });

    return files;
  },

  importExisting(rootFiles: Record<string, string>): Partial<Manifest> {
    const instr = rootFiles[".github/copilot-instructions.md"];
    if (!instr) return {};
    return { primitives: { instructions: { blocks: [{ scope: "project", content: instr }] } } };
  },

  capabilities(): CapabilityMatrix {
    return {
      native: ["instructions", "skill", "agent", "command", "mcp", "state"],
      fallback: {
        hook: "Copilot hook format not pinned in the matrix yet — git pre-commit wrapper lands in Phase 6",
        permissions: "tool allowlisting is per-user/org Copilot policy, not a repo file — not emitted",
        loop: "no first-party /goal — use the portable Ralph runner: `aesop goal run <name>` (.aesop/goals/)",
      },
      goalMode: "ralph",
    };
  },
};
