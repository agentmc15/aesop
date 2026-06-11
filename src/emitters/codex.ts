/** Codex CLI emitter — .codex/{config.toml,agents/*.toml,prompts,skills}. AGENTS.md is emitted
 *  by the compiler core (Codex reads it natively).
 *  Target formats: docs/03-harness-matrix.md (update the doc first, then this file). */
import { goalCommand } from "./claude-code.js";
import { parseAgent, refName } from "../registry.js";
import type { CapabilityMatrix, CompileContext, EmittedFile, Emitter, Manifest } from "../types.js";

const tomlString = (s: string): string => JSON.stringify(s); // TOML basic strings share JSON escaping

function configToml(ctx: CompileContext): string {
  const m = ctx.manifest;
  const lines: string[] = [
    "# .codex/config.toml — compiled by aesop from aesop.yaml; edit the manifest, not this file.",
    "",
    `# pathway: ${ctx.profile.name} (model tier '${ctx.profile.model_tier}' — map to your configured model)`,
    `approval_policy = ${tomlString(m.primitives.permissions?.unattended === "devcontainer" ? "never" : "on-request")}`,
    `sandbox_mode = ${tomlString("workspace-write")}`,
  ];
  for (const s of m.primitives.mcp ?? []) {
    lines.push("", `[mcp_servers.${s.name}]`);
    if (s.transport === "http") {
      lines.push(`url = ${tomlString(s.url ?? "")}`);
    } else {
      const [command, ...args] = (s.command ?? "").split(" ");
      lines.push(`command = ${tomlString(command ?? "")}`);
      lines.push(`args = [${args.map(tomlString).join(", ")}]`);
      if (s.env?.length) {
        lines.push(`env = { ${s.env.map((e) => `${tomlString(e)} = ${tomlString(`\${${e}}`)}`).join(", ")} }`);
      }
    }
  }
  return lines.join("\n") + "\n";
}

export const codexEmitter: Emitter = {
  harness: "codex",

  emit(ctx: CompileContext): EmittedFile[] {
    const files: EmittedFile[] = [{ path: ".codex/config.toml", content: configToml(ctx), fence: "sidecar" }];

    for (const resolved of ctx.primitives.filter((p) => p.type === "agent")) {
      const ref = (ctx.manifest.primitives.agents ?? []).find((r) => refName(r) === resolved.name);
      const spec = parseAgent(resolved, ref);
      const content = [
        `name = ${tomlString(spec.name)}`,
        `description = ${tomlString(spec.description)}`,
        `# model tier '${spec.model}' at effort '${spec.effort}' — map to your configured model`,
        `read_only = ${spec.edits ? "false" : "true"}`,
        `instructions = """`,
        spec.prompt.replaceAll('"""', '\\"""'),
        `"""`,
      ].join("\n");
      files.push({ path: `.codex/agents/${spec.name}.toml`, content: content + "\n", fence: "sidecar" });
    }

    for (const resolved of ctx.primitives.filter((p) => p.type === "command")) {
      files.push({
        path: `.codex/prompts/${resolved.name}.md`,
        content: Object.values(resolved.files)[0]!,
        fence: "sidecar",
      });
    }

    for (const recipe of ctx.manifest.primitives.loops ?? []) {
      files.push({ path: `.codex/prompts/goal-${recipe.name}.md`, content: goalCommand(recipe), fence: "sidecar" });
    }

    for (const resolved of ctx.primitives.filter((p) => p.type === "skill")) {
      for (const [rel, content] of Object.entries(resolved.files)) {
        files.push({ path: `.codex/skills/${resolved.name}/${rel}`, content, fence: "sidecar" });
      }
    }

    return files;
  },

  importExisting(rootFiles: Record<string, string>): Partial<Manifest> {
    const agents = rootFiles["AGENTS.md"];
    if (!agents) return {};
    return { primitives: { instructions: { blocks: [{ scope: "project", content: agents }] } } };
  },

  capabilities(): CapabilityMatrix {
    return {
      native: ["instructions", "skill", "agent", "command", "mcp", "permissions", "loop", "state"],
      fallback: { hook: "no native hook events — git pre-commit wrapper emitted in Phase 6" },
      goalMode: "native", // /goal since late April 2026 (first to ship)
    };
  },
};
