/** Registry federation: fetch foreign registries, normalize their formats into canonical
 *  primitives, vendor the result into the project (.aesop/vendor/ — tracked, reviewable,
 *  SHA-pinned). Registry content is untrusted input: it is normalized, schema-shaped, and
 *  review-gated; never auto-applied. */
import { execFile } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { promisify } from "node:util";
import { stringify } from "yaml";
import { AesopError } from "./manifest.js";
import { parseFrontmatter } from "./registry.js";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);
const BUILTIN_ROOT = fileURLToPath(new URL("../registry", import.meta.url));

// --- Providers ---

export interface FetchedRegistry {
  name: string;
  source: string;
  rootDir: string;
  /** Upstream git SHA, or "local" for path registries. */
  sha: string;
}

export function registryName(source: string): string {
  if (source === "builtin") return "builtin";
  const tail = source.replace(/\/+$/, "").split("/").pop() ?? source;
  return tail.replace(/\.git$/, "");
}

export async function fetchRegistry(source: string, cwd: string): Promise<FetchedRegistry> {
  const name = registryName(source);
  if (source === "builtin") return { name, source, rootDir: BUILTIN_ROOT, sha: "builtin" };
  if (source.startsWith("path:")) {
    const rootDir = source.slice("path:".length);
    if (!existsSync(rootDir)) throw new AesopError(1, `registry '${name}': path not found: ${rootDir}`);
    return { name, source, rootDir, sha: "local" };
  }
  if (source.startsWith("github:") || source.startsWith("http")) {
    const url = source.startsWith("github:") ? `https://github.com/${source.slice("github:".length)}.git` : source;
    const cacheDir = join(cwd, ".aesop", "cache", name);
    try {
      if (existsSync(cacheDir)) {
        await exec("git", ["-C", cacheDir, "pull", "--ff-only", "--quiet"], { timeout: 60_000 });
      } else {
        await mkdir(dirname(cacheDir), { recursive: true });
        await exec("git", ["clone", "--depth", "1", "--quiet", url, cacheDir], { timeout: 120_000 });
      }
    } catch (e) {
      throw new AesopError(1, `registry '${name}': fetch failed (${url}): ${(e as Error).message.split("\n")[0]}`);
    }
    const { stdout } = await exec("git", ["-C", cacheDir, "rev-parse", "HEAD"]);
    return { name, source, rootDir: cacheDir, sha: stdout.trim() };
  }
  throw new AesopError(2, `unsupported registry source '${source}'`);
}

// --- Importers: foreign format → canonical files ---

export type ImportableType = "agent" | "skill" | "command" | "instructions";

export interface ImportedPrimitive {
  type: ImportableType;
  name: string;
  /** Canonical files, relative to the primitive's vendor dir. */
  files: Record<string, string>;
  /** For instructions: the block scope extracted from applyTo (default "project"). */
  scope?: string;
  foundAt: string;
}

const CLAUDE_TOOL_MAP: Record<string, string> = {
  read: "read",
  grep: "grep",
  glob: "glob",
  edit: "edit",
  write: "edit",
  bash: "bash",
  websearch: "search",
  webfetch: "search",
};
const CLAUDE_MODEL_MAP: Record<string, string> = { opus: "strong", sonnet: "mid", haiku: "cheap" };

/** Claude-format agents (tools as comma string, model opus/sonnet/haiku) → canonical frontmatter. */
function normalizeAgent(name: string, content: string): string {
  const { data, body } = parseFrontmatter(content);
  const isClaudeFormat = typeof data.tools === "string" || ["opus", "sonnet", "haiku"].includes(data.model as string);
  if (!isClaudeFormat && Array.isArray(data.tools)) return content; // already canonical

  const rawTools = typeof data.tools === "string" ? data.tools.split(",") : ((data.tools as string[]) ?? ["read"]);
  const tools = [...new Set(rawTools.map((t) => CLAUDE_TOOL_MAP[t.trim().toLowerCase()]).filter((t): t is string => !!t))];
  const model = CLAUDE_MODEL_MAP[data.model as string] ?? (data.model as string) ?? "mid";
  const edits = tools.includes("edit") || tools.includes("bash");
  const fm = stringify({
    name: (data.name as string) ?? name,
    description: (data.description as string) ?? "",
    tools: tools.length ? tools : ["read"],
    model,
    effort: model === "strong" ? "high" : "medium",
    edits,
  }).trimEnd();
  return `---\n${fm}\n---\n\n${body.trim()}\n`;
}

/** awesome-copilot .instructions.md (applyTo frontmatter) or plain rules → canonical block file. */
function normalizeInstructions(name: string, content: string): { file: string; scope: string } {
  const { data, body } = parseFrontmatter(content);
  const applyTo = data.applyTo as string | undefined;
  const scope = applyTo ? `path:${applyTo}` : "project";
  const fm = stringify({ name, scope, ...(data.description ? { description: data.description } : {}) }).trimEnd();
  return { file: `---\n${fm}\n---\n\n${body.trim()}\n`, scope };
}

function firstExisting(root: string, candidates: string[]): string | undefined {
  for (const rel of candidates) {
    if (rel.includes("*")) {
      // one wildcard segment (ecc domain nesting: skills/<domain>/<name>/)
      const [before, after] = rel.split("*", 2);
      const base = join(root, before ?? "");
      if (!existsSync(base)) continue;
      for (const entry of readdirSync(base).sort()) {
        const candidate = join(base, entry + (after ?? ""));
        if (existsSync(candidate)) return candidate;
      }
    } else if (existsSync(join(root, rel))) {
      return join(root, rel);
    }
  }
  return undefined;
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

export async function importPrimitive(reg: FetchedRegistry, type: ImportableType, name: string): Promise<ImportedPrimitive> {
  const root = reg.rootDir;
  const fail = (): never => {
    throw new AesopError(1, `${type} '${name}' not found in registry '${reg.name}' (${reg.source})`);
  };

  switch (type) {
    case "agent": {
      const path = firstExisting(root, [`registry/agents/${name}.md`, `agents/${name}.md`]) ?? fail();
      return { type, name, files: { [`${name}.md`]: normalizeAgent(name, await readFile(path, "utf8")) }, foundAt: path };
    }
    case "command": {
      const path =
        firstExisting(root, [
          `registry/commands/${name}.md`,
          `commands/${name}.md`,
          `prompts/${name}.prompt.md`,
          `prompts/${name}.md`,
        ]) ?? fail();
      return { type, name, files: { [`${name}.md`]: await readFile(path, "utf8") }, foundAt: path };
    }
    case "skill": {
      const dir = firstExisting(root, [`registry/skills/${name}`, `skills/${name}`, `skills/*/${name}`]) ?? fail();
      if (!existsSync(join(dir, "SKILL.md"))) fail();
      return { type, name, files: readDirRecursive(dir), foundAt: dir };
    }
    case "instructions": {
      const path =
        firstExisting(root, [
          `registry/instructions/${name}.md`,
          `instructions/${name}.instructions.md`,
          `instructions/${name}.md`,
          `rules/common/${name}.md`,
          `rules/${name}.md`,
          `rules/*/${name}.md`,
        ]) ?? fail();
      const { file, scope } = normalizeInstructions(name, await readFile(path, "utf8"));
      return { type, name, files: { [`${name}.md`]: file }, scope, foundAt: path };
    }
  }
}

// --- Vendoring ---

const TYPE_DIRS: Record<ImportableType, string> = {
  agent: "agents",
  skill: "skills",
  command: "commands",
  instructions: "instructions",
};

export function vendorDir(cwd: string, registry: string, type: ImportableType, name: string): string {
  const base = join(cwd, ".aesop", "vendor", registry, TYPE_DIRS[type]);
  return type === "skill" ? join(base, name) : base;
}

export async function writeVendored(cwd: string, registry: string, imported: ImportedPrimitive, sha: string, source: string): Promise<void> {
  const dir = vendorDir(cwd, registry, imported.type, imported.name);
  for (const [rel, content] of Object.entries(imported.files)) {
    const abs = join(dir, rel);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, content, "utf8");
  }
  const metaPath = join(cwd, ".aesop", "vendor", registry, ".meta.json");
  const meta = JSON.parse(await readFile(metaPath, "utf8").catch(() => "{}")) as {
    source?: string;
    sha?: string;
    primitives?: Record<string, string>;
  };
  meta.source = source;
  meta.sha = sha;
  (meta.primitives ??= {})[`${imported.type}:${imported.name}`] = imported.foundAt;
  await writeFile(metaPath, JSON.stringify(meta, null, 2) + "\n", "utf8");
}

export interface VendorMeta {
  registry: string;
  source: string;
  sha: string;
  primitives: { type: ImportableType; name: string }[];
}

export async function readVendorMetas(cwd: string): Promise<VendorMeta[]> {
  const vendorRoot = join(cwd, ".aesop", "vendor");
  if (!existsSync(vendorRoot)) return [];
  const metas: VendorMeta[] = [];
  for (const registry of readdirSync(vendorRoot).sort()) {
    const metaPath = join(vendorRoot, registry, ".meta.json");
    if (!existsSync(metaPath)) continue;
    const raw = JSON.parse(await readFile(metaPath, "utf8")) as { source: string; sha: string; primitives?: Record<string, string> };
    metas.push({
      registry,
      source: raw.source,
      sha: raw.sha,
      primitives: Object.keys(raw.primitives ?? {}).map((k) => {
        const [type, ...rest] = k.split(":");
        return { type: type as ImportableType, name: rest.join(":") };
      }),
    });
  }
  return metas;
}

export const PROVENANCE_MARKER = (registry: string, name: string): string =>
  `<!-- aesop:from ${registry}/instructions/${name} -->`;
