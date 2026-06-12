/** Builtin registry resolution: primitive name → canonical files + content hash.
 *  Federation (ecc, awesome-copilot, git URLs) lands in Phase 5 behind the same interface. */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { AesopError } from "./manifest.js";
import { safeNameOr } from "./safety.js";
import type { AgentRef, Effort, PrimitiveRef, PrimitiveType, ResolvedPrimitive } from "./types.js";

const REGISTRY_ROOT = fileURLToPath(new URL("../registry", import.meta.url));

export function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function hashFiles(files: Record<string, string>): string {
  const h = createHash("sha256");
  for (const path of Object.keys(files).sort()) {
    h.update(path).update("\0").update(files[path]!).update("\0");
  }
  return h.digest("hex");
}

function readDirRecursive(dir: string, prefix = ""): Record<string, string> {
  const files: Record<string, string> = {};
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    const rel = prefix ? `${prefix}/${entry}` : entry;
    if (statSync(full).isDirectory()) Object.assign(files, readDirRecursive(full, rel));
    else files[rel] = readFileSync(full, "utf8");
  }
  return files;
}

export const refName = (ref: PrimitiveRef | AgentRef): string => (typeof ref === "string" ? ref : ref.name);
export const refSource = (ref: PrimitiveRef | AgentRef): string => {
  if (typeof ref === "string") {
    const at = ref.indexOf("@");
    return at === -1 ? "builtin" : ref.slice(at + 1);
  }
  return ref.from ?? "builtin";
};

/** Resolve a primitive from builtin or from the project's vendored registries (.aesop/vendor/,
 *  written by `aesop add`). Vendored content is already canonical — federation normalizes on
 *  import, not on every compile. */
export function resolvePrimitive(type: PrimitiveType, ref: PrimitiveRef | AgentRef, cwd: string): ResolvedPrimitive {
  const source = refSource(ref);
  if (source === "builtin") return resolveBuiltin(type, ref);

  const name = refName(ref).split("@")[0]!;
  const typeDir = { skill: "skills", agent: "agents", command: "commands", instructions: "instructions" }[
    type as "skill" | "agent" | "command" | "instructions"
  ];
  if (!typeDir) throw new AesopError(2, `primitive type '${type}' is not registry-resolved`);
  const base = join(cwd, ".aesop", "vendor", source, typeDir);
  const path = type === "skill" ? join(base, name) : join(base, `${name}.md`);
  if (!existsSync(path)) {
    throw new AesopError(2, `${type} '${name}' from registry '${source}' is not vendored — run \`aesop add ${type} ${name} --from ${source}\``);
  }
  const files = type === "skill" ? readDirRecursive(path) : { [`${name}.md`]: readFileSync(path, "utf8") };
  return { type, name, registry: source, sha: hashFiles(files), files };
}

export function resolveBuiltin(type: PrimitiveType, ref: PrimitiveRef | AgentRef): ResolvedPrimitive {
  const source = refSource(ref);
  if (source !== "builtin") {
    throw new AesopError(2, `registry '${source}' for ${type} '${refName(ref)}' requires vendoring — use resolvePrimitive`);
  }
  const name = refName(ref).split("@")[0]!;
  let files: Record<string, string>;
  const fail = (where: string): never => {
    throw new AesopError(2, `unknown ${type} '${name}' (no ${where} in the builtin registry)`);
  };
  switch (type) {
    case "skill": {
      const dir = join(REGISTRY_ROOT, "skills", name);
      if (!existsSync(join(dir, "SKILL.md"))) fail(`skills/${name}/SKILL.md`);
      files = readDirRecursive(dir);
      break;
    }
    case "agent": {
      const path = join(REGISTRY_ROOT, "agents", `${name}.md`);
      if (!existsSync(path)) fail(`agents/${name}.md`);
      files = { [`${name}.md`]: readFileSync(path, "utf8") };
      break;
    }
    case "command": {
      const path = join(REGISTRY_ROOT, "commands", `${name}.md`);
      if (!existsSync(path)) fail(`commands/${name}.md`);
      files = { [`${name}.md`]: readFileSync(path, "utf8") };
      break;
    }
    case "hook": {
      const path = join(REGISTRY_ROOT, "hooks", `${name}.yaml`);
      if (!existsSync(path)) fail(`hooks/${name}.yaml`);
      files = { [`${name}.yaml`]: readFileSync(path, "utf8") };
      break;
    }
    case "instructions": {
      const path = join(REGISTRY_ROOT, "instructions", `${name}.md`);
      if (!existsSync(path)) fail(`instructions/${name}.md`);
      files = { [`${name}.md`]: readFileSync(path, "utf8") };
      break;
    }
    default:
      throw new AesopError(2, `primitive type '${type}' is not registry-resolved`);
  }
  return { type, name, registry: "builtin", sha: hashFiles(files), files };
}

// --- Canonical-format parsers used by emitters ---

export interface Frontmatter {
  data: Record<string, unknown>;
  body: string;
}

export function parseFrontmatter(content: string): Frontmatter {
  const m = content.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { data: {}, body: content };
  return { data: (parse(m[1]!) as Record<string, unknown>) ?? {}, body: content.slice(m[0].length) };
}

export interface AgentSpec {
  name: string;
  description: string;
  tools: string[];
  model: "strong" | "mid" | "cheap";
  effort: Effort;
  edits: boolean;
  prompt: string;
}

export function parseAgent(resolved: ResolvedPrimitive, override?: AgentRef): AgentSpec {
  const file = Object.values(resolved.files)[0]!;
  const { data, body } = parseFrontmatter(file);
  const o = typeof override === "object" ? override : undefined;
  return {
    // The frontmatter `name` becomes a filename in every harness — registry content cannot be
    // trusted to keep it inside the project (F1). Fall back to the (already-safe) ref name rather
    // than let a hostile frontmatter break compile; assertWithinRepo is the hard backstop.
    name: safeNameOr(data.name as string | undefined, resolved.name),
    description: (data.description as string) ?? "",
    tools: o?.tools ?? ((data.tools as string[]) ?? ["read"]),
    model: o?.model ?? ((data.model as AgentSpec["model"]) ?? "mid"),
    effort: o?.effort ?? ((data.effort as Effort) ?? "medium"),
    edits: (data.edits as boolean) ?? false,
    prompt: body.trim(),
  };
}

export interface HookSpec {
  name: string;
  description: string;
  event: "pre-tool" | "post-tool" | "stop" | "session-start";
  matcher: string;
  action?: string;
  deny_patterns?: string[];
}

export function parseHook(resolved: ResolvedPrimitive): HookSpec {
  return parse(Object.values(resolved.files)[0]!) as HookSpec;
}
