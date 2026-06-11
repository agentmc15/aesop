/** Helpers shared by emitters. Fallback files are built here so that two harnesses emitting the
 *  same fallback produce identical bytes — the compile collision guard then dedupes them. */
import { parseAgent, refName } from "../registry.js";
import type { CompileContext, EmittedFile, McpServer } from "../types.js";

export const slugify = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "scope";

/** Harness-neutral role prompts for harnesses without first-class subagents. */
export function rolePromptFiles(ctx: CompileContext): EmittedFile[] {
  return ctx.primitives
    .filter((p) => p.type === "agent")
    .map((resolved) => {
      const ref = (ctx.manifest.primitives.agents ?? []).find((r) => refName(r) === resolved.name);
      const spec = parseAgent(resolved, ref);
      const content = [
        `# Role: ${spec.name}`,
        "",
        `> ${spec.description}`,
        `> Model tier: ${spec.model} · effort: ${spec.effort} · ${spec.edits ? "edits code" : "READ-ONLY"}`,
        "",
        "Paste this role into a separate session/tab to run it as a subagent (maker ≠ checker).",
        "",
        spec.prompt,
        "",
      ].join("\n");
      return { path: `.aesop/roles/${spec.name}.md`, content, fence: "sidecar" as const };
    });
}

/** Harness-neutral prompt files for harnesses without a native command/prompt registry. */
export function portablePromptFiles(ctx: CompileContext): EmittedFile[] {
  return ctx.primitives
    .filter((p) => p.type === "command")
    .map((resolved) => ({
      path: `.aesop/prompts/${resolved.name}.md`,
      content: Object.values(resolved.files)[0]!,
      fence: "sidecar" as const,
    }));
}

const stdioParts = (s: McpServer): { command: string; args: string[]; env: Record<string, string> } => {
  const [command, ...args] = (s.command ?? "").split(" ");
  return { command: command ?? "", args, env: Object.fromEntries((s.env ?? []).map((e) => [e, `\${${e}}`])) };
};

/** Claude/Cursor-style: { "mcpServers": { name: { command, args, env } } } */
export function mcpServersJson(servers: McpServer[]): string {
  const out: Record<string, unknown> = {};
  for (const s of servers) {
    out[s.name] = s.transport === "http" ? { type: "http", url: s.url } : stdioParts(s);
  }
  return JSON.stringify({ mcpServers: out }, null, 2) + "\n";
}

/** VS Code-style .vscode/mcp.json: { "servers": { name: { type, ... } } } */
export function vscodeMcpJson(servers: McpServer[]): string {
  const out: Record<string, unknown> = {};
  for (const s of servers) {
    out[s.name] = s.transport === "http" ? { type: "http", url: s.url } : { type: "stdio", ...stdioParts(s) };
  }
  return JSON.stringify({ servers: out }, null, 2) + "\n";
}
