/** VS Code emitter — .vscode/{settings.json,tasks.json,mcp.json}. Instructions/prompts/agents
 *  ride on the Copilot files: enable the 'copilot' harness for those; this emitter wires the
 *  workspace so VS Code actually uses them, and puts the verify loop one keypress away.
 *  Target formats: docs/03-harness-matrix.md (update the doc first, then this file). */
import { vscodeMcpJson } from "./shared.js";
import type { CapabilityMatrix, CompileContext, EmittedFile, Emitter, Manifest } from "../types.js";

export const vscodeEmitter: Emitter = {
  harness: "vscode",

  emit(ctx: CompileContext): EmittedFile[] {
    const files: EmittedFile[] = [];
    const cmds = ctx.manifest.project.commands;

    const settings = {
      "github.copilot.chat.codeGeneration.useInstructionFiles": true,
      "chat.promptFiles": true,
    };
    files.push({ path: ".vscode/settings.json", content: JSON.stringify(settings, null, 2) + "\n", fence: "sidecar" });

    const tasks = [
      { label: "aesop: test", type: "shell", command: cmds.test, group: { kind: "test", isDefault: true } },
      ...(cmds.build ? [{ label: "aesop: build", type: "shell", command: cmds.build, group: "build" }] : []),
      ...(cmds.lint ? [{ label: "aesop: lint", type: "shell", command: cmds.lint }] : []),
    ];
    files.push({
      path: ".vscode/tasks.json",
      content: JSON.stringify({ version: "2.0.0", tasks }, null, 2) + "\n",
      fence: "sidecar",
    });

    const mcp = ctx.manifest.primitives.mcp ?? [];
    if (mcp.length) files.push({ path: ".vscode/mcp.json", content: vscodeMcpJson(mcp), fence: "sidecar" });

    return files;
  },

  importExisting(): Partial<Manifest> {
    return {}; // instruction content lives in Copilot files; the copilot emitter imports those
  },

  capabilities(): CapabilityMatrix {
    return {
      native: ["mcp", "state"],
      fallback: {
        instructions: "via Copilot files — enable the 'copilot' harness; this emitter wires useInstructionFiles",
        skill: "via the 'copilot' harness (.github/skills/)",
        agent: "via the 'copilot' harness (.github/agents/)",
        command: "via the 'copilot' harness (.github/prompts/)",
        hook: "no native hooks — git pre-commit wrapper lands in Phase 6",
        permissions: "Copilot policy is per-user/org — not emitted",
        loop: "no first-party /goal — portable Ralph runner lands in Phase 6",
      },
      goalMode: "ralph",
    };
  },
};
