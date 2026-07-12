/** Claude Code emitter — CLAUDE.md (@AGENTS.md), .claude/{agents,commands,skills,settings.json}, .mcp.json.
 *  Target formats: docs/03-harness-matrix.md (update the doc first, then this file). */
import { stringify } from "yaml";
import { parseHook } from "../registry.js";
import { wrapInlineFence } from "../render.js";
import { resolveAgentSpec } from "./shared.js";
import type { CapabilityMatrix, CompileContext, EmittedFile, Emitter, GoalRecipe, Manifest } from "../types.js";

export function goalCommand(recipe: GoalRecipe): string {
  return [
    "---",
    `description: Pursue the '${recipe.name}' goal until its verify command passes (recipe in .aesop/goals/${recipe.name}.md).`,
    "---",
    "",
    `Work toward: ${recipe.goal}`,
    "",
    `Done means \`${recipe.verify}\` exits 0 — run it yourself after every increment; never claim`,
    `done without it. ${recipe.plan_gate === false ? "" : "Plan first and confirm the plan before executing. "}Respect the hard`,
    `stops: ${recipe.stops.max_iterations} iterations, halt after ${recipe.stops.no_progress_after} turns without measurable progress, $${recipe.stops.budget_usd} budget.`,
    `Track progress in tasks/todo.md. Prefer native \`/goal\` for unattended runs.`,
    "",
  ].join("\n");
}

const TOOL_MAP: Record<string, string> = {
  read: "Read",
  grep: "Grep",
  glob: "Glob",
  edit: "Edit, Write",
  bash: "Bash",
  search: "WebSearch",
  // mcp: omitted — MCP tools are granted via .mcp.json, not agent frontmatter
};

const MODEL_MAP: Record<string, string> = { strong: "opus", mid: "sonnet", cheap: "haiku" };

/** "git commit *" → "Bash(git commit:*)"; exact commands stay exact. */
const permRule = (cmd: string): string =>
  cmd.endsWith(" *") ? `Bash(${cmd.slice(0, -2)}:*)` : `Bash(${cmd})`;

function settingsJson(ctx: CompileContext): string {
  const m = ctx.manifest;
  const perms = m.primitives.permissions ?? {};
  const allow = [
    ...[m.project.commands.test, m.project.commands.build, m.project.commands.lint]
      .filter((c): c is string => !!c)
      .map((c) => `Bash(${c})`),
    ...(perms.mutate_allow ?? []).map(permRule),
  ];
  const ask = (perms.irreversible ?? []).map(permRule);

  const hookGroups: Record<string, { matcher: string; hooks: { type: "command"; command: string }[] }[]> = {};
  const EVENT_MAP: Record<string, string> = {
    "pre-tool": "PreToolUse",
    "post-tool": "PostToolUse",
    stop: "Stop",
    "session-start": "SessionStart",
  };
  for (const resolved of ctx.primitives.filter((p) => p.type === "hook")) {
    const hook = parseHook(resolved);
    const event = EVENT_MAP[hook.event] ?? hook.event;
    let command: string | undefined;
    if (hook.deny_patterns?.length) {
      const pattern = hook.deny_patterns.join("|");
      command = `grep -qE '${pattern}' && { echo 'blocked by aesop: ${hook.name}' >&2; exit 2; } || exit 0`;
    } else if (hook.action?.includes("{format_command}")) {
      const fmt = m.project.commands["format"];
      if (!fmt) continue; // no formatter configured — never invent one
      command = `jq -r '.tool_input.file_path // empty' | xargs -r ${fmt}`;
    } else if (hook.action) {
      command = hook.action;
    }
    if (!command) continue;
    (hookGroups[event] ??= []).push({ matcher: hook.matcher, hooks: [{ type: "command", command }] });
  }

  const settings: Record<string, unknown> = { permissions: { allow, ask } };
  if (Object.keys(hookGroups).length) settings.hooks = hookGroups;
  return JSON.stringify(settings, null, 2) + "\n";
}

export const claudeCodeEmitter: Emitter = {
  harness: "claude-code",

  emit(ctx: CompileContext): EmittedFile[] {
    const files: EmittedFile[] = [];

    files.push({
      path: "CLAUDE.md",
      content: wrapInlineFence(
        "# CLAUDE.md\n\n@AGENTS.md\n\nSingle source of truth: AGENTS.md (imported above), compiled from aesop.yaml.\nAdd rules there via aesop.yaml — not here — so every harness sees the same instructions.\n"
      ),
      fence: "inline",
    });

    for (const resolved of ctx.primitives.filter((p) => p.type === "agent")) {
      const spec = resolveAgentSpec(ctx, resolved);
      const tools = [...new Set(spec.tools.flatMap((t) => TOOL_MAP[t]?.split(", ") ?? []))];
      // YAML-serialize, never interpolate: a registry-controlled description with a newline must
      // not be able to inject extra frontmatter keys (F4).
      const fmObj: Record<string, string> = { name: spec.name, description: spec.description };
      if (tools.length) fmObj.tools = tools.join(", ");
      fmObj.model = MODEL_MAP[spec.model] ?? "sonnet";
      const fm = `---\n${stringify(fmObj, { lineWidth: 0 }).trimEnd()}\n---`;
      const readOnly = spec.edits ? "" : "\nYou are read-only: never edit, write, or execute mutating commands.\n";
      files.push({
        path: `.claude/agents/${spec.name}.md`,
        content: `${fm}\n\n${spec.prompt}\n${readOnly}`,
        fence: "sidecar",
      });
    }

    for (const resolved of ctx.primitives.filter((p) => p.type === "command")) {
      files.push({
        path: `.claude/commands/${resolved.name}.md`,
        content: Object.values(resolved.files)[0]!,
        fence: "sidecar",
      });
    }

    for (const resolved of ctx.primitives.filter((p) => p.type === "skill")) {
      for (const [rel, content] of Object.entries(resolved.files)) {
        files.push({ path: `.claude/skills/${resolved.name}/${rel}`, content, fence: "sidecar" });
      }
    }

    // Pairs with native /goal: a slash command carrying the recipe (goal, verify, stops).
    for (const recipe of ctx.manifest.primitives.loops ?? []) {
      files.push({
        path: `.claude/commands/goal-${recipe.name}.md`,
        content: goalCommand(recipe),
        fence: "sidecar",
      });
    }

    files.push({ path: ".claude/settings.json", content: settingsJson(ctx), fence: "sidecar" });

    const mcp = ctx.manifest.primitives.mcp ?? [];
    if (mcp.length) {
      const servers: Record<string, unknown> = {};
      for (const s of mcp) {
        const [command, ...args] = (s.command ?? "").split(" ");
        servers[s.name] =
          s.transport === "http"
            ? { type: "http", url: s.url }
            : { command, args, env: Object.fromEntries((s.env ?? []).map((e) => [e, `\${${e}}`])) };
      }
      files.push({ path: ".mcp.json", content: JSON.stringify({ mcpServers: servers }, null, 2) + "\n", fence: "sidecar" });
    }

    return files;
  },

  importExisting(rootFiles: Record<string, string>): Partial<Manifest> {
    const claude = rootFiles["CLAUDE.md"];
    if (!claude) return {};
    return { primitives: { instructions: { blocks: [{ scope: "project", content: claude }] } } };
  },

  capabilities(): CapabilityMatrix {
    return {
      native: ["instructions", "skill", "agent", "command", "mcp", "hook", "permissions", "loop", "state"],
      fallback: {},
      goalMode: "native", // /goal since 2.1.139 (May 2026)
    };
  },
};
