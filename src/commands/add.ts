/** `aesop add/remove/list` — manage primitives across federated registries.
 *  add: fetch → normalize → vendor → manifest edit → validate → recompile.
 *  remove: manifest edit → recompile → delete the files that became orphaned. */
import { existsSync, readdirSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runCompile } from "./compile.js";
import {
  fetchRegistry,
  importPrimitive,
  registryName,
  writeVendored,
  PROVENANCE_MARKER,
  type ImportableType,
} from "../federation.js";
import { loadManifest, serializeManifest, validateManifest, AesopError } from "../manifest.js";
import { refName } from "../registry.js";
import type { AgentRef, Manifest, PrimitiveRef } from "../types.js";

const ADDABLE: ImportableType[] = ["agent", "skill", "command", "instructions"];

async function saveManifest(cwd: string, manifest: Manifest, note: string): Promise<void> {
  const { valid, errors } = validateManifest(manifest);
  if (!valid) throw new AesopError(2, `edit produced an invalid manifest:\n  - ${errors.join("\n  - ")}`);
  await writeFile(join(cwd, "aesop.yaml"), serializeManifest(manifest, note), "utf8");
}

export interface AddOptions {
  cwd: string;
  type: string;
  name: string;
  from?: string;
}

export async function runAdd(opts: AddOptions): Promise<{ registry: string; recompiled: boolean }> {
  const type = opts.type as ImportableType;
  if (!ADDABLE.includes(type)) {
    throw new AesopError(1, `cannot add type '${opts.type}' — addable: ${ADDABLE.join(", ")} (mcp/hooks/loops are authored in aesop.yaml directly)`);
  }
  const manifest = await loadManifest(opts.cwd);
  const sources = manifest.registries ?? ["builtin"];

  // --from pins a registry by short name; otherwise search declared order.
  const searchOrder = opts.from
    ? sources.filter((s) => registryName(s) === opts.from)
    : sources;
  if (opts.from && !searchOrder.length) {
    throw new AesopError(1, `registry '${opts.from}' is not declared in aesop.yaml (registries: ${sources.map(registryName).join(", ")})`);
  }

  const failures: string[] = [];
  for (const source of searchOrder) {
    const reg = await fetchRegistry(source, opts.cwd);
    try {
      const imported = await importPrimitive(reg, type, opts.name);

      if (reg.name === "builtin") {
        // builtin needs no vendoring — plain name reference resolves from the package registry
        addRef(manifest, type, opts.name, undefined, imported.scope, imported.files);
      } else {
        await writeVendored(opts.cwd, reg.name, imported, reg.sha, reg.source);
        addRef(manifest, type, opts.name, reg.name, imported.scope, imported.files);
      }
      await saveManifest(opts.cwd, manifest, `updated by \`aesop add ${type} ${opts.name}${opts.from ? ` --from ${opts.from}` : ""}\``);
      await runCompile({ cwd: opts.cwd });
      return { registry: reg.name, recompiled: true };
    } catch (e) {
      failures.push(`${reg.name}: ${(e as Error).message.split("\n")[0]}`);
    }
  }
  throw new AesopError(1, `${type} '${opts.name}' not found in any registry:\n  - ${failures.join("\n  - ")}`);
}

function addRef(manifest: Manifest, type: ImportableType, name: string, from: string | undefined, scope?: string, files?: Record<string, string>): void {
  const p = manifest.primitives;
  const ref: PrimitiveRef | AgentRef = from ? { name, from } : name;
  switch (type) {
    case "agent": {
      const list = (p.agents ??= []);
      if (!list.some((r) => refName(r) === name)) list.push(ref as AgentRef);
      break;
    }
    case "skill": {
      const list = (p.skills ??= []);
      if (!list.some((r) => refName(r) === name)) list.push(ref);
      break;
    }
    case "command": {
      const list = (p.commands ??= []);
      if (!list.some((r) => refName(r) === name)) list.push(ref);
      break;
    }
    case "instructions": {
      // Imports become manifest blocks with a provenance marker so `update` can find them.
      const body = Object.values(files ?? {})[0] ?? "";
      const content = body.replace(/^---\n[\s\S]*?\n---\n+/, ""); // strip canonical frontmatter; scope rides the block
      const instructions = (p.instructions ??= {});
      const blocks = (instructions.blocks ??= []);
      const marker = PROVENANCE_MARKER(from ?? "builtin", name);
      const block = { scope: (scope ?? "project") as "project", content: `${marker}\n${content.trim()}\n` };
      const idx = blocks.findIndex((b) => b.content.startsWith(marker));
      if (idx === -1) blocks.push(block);
      else blocks[idx] = block;
      break;
    }
  }
}

export async function runRemove(opts: { cwd: string; type: string; name: string }): Promise<{ deleted: string[] }> {
  const manifest = await loadManifest(opts.cwd);
  const p = manifest.primitives;
  const drop = <T extends PrimitiveRef | AgentRef>(list: T[] | undefined): T[] =>
    (list ?? []).filter((r) => refName(r) !== opts.name);
  if (opts.type === "agent") p.agents = drop(p.agents);
  else if (opts.type === "skill") p.skills = drop(p.skills);
  else if (opts.type === "command") p.commands = drop(p.commands);
  else if (opts.type === "instructions") {
    if (p.instructions?.blocks) {
      p.instructions.blocks = p.instructions.blocks.filter((b) => !b.content.includes(`/instructions/${opts.name} -->`));
    }
  } else throw new AesopError(1, `cannot remove type '${opts.type}'`);

  // Capture what the lock tracked, recompile, then delete files no longer produced.
  const lockPath = join(opts.cwd, ".aesop", "lock.json");
  const oldLock = JSON.parse(await readFile(lockPath, "utf8").catch(() => "{}")) as { files?: Record<string, string> };
  await saveManifest(opts.cwd, manifest, `updated by \`aesop remove ${opts.type} ${opts.name}\``);
  await runCompile({ cwd: opts.cwd });
  const newLock = JSON.parse(await readFile(lockPath, "utf8")) as { files?: Record<string, string> };
  const deleted: string[] = [];
  for (const path of Object.keys(oldLock.files ?? {})) {
    if (!(path in (newLock.files ?? {}))) {
      await rm(join(opts.cwd, path), { force: true });
      deleted.push(path);
    }
  }
  return { deleted };
}

export async function runList(opts: { cwd: string; type?: string; available?: boolean }): Promise<string[]> {
  const manifest = await loadManifest(opts.cwd);
  const lines: string[] = [];
  const want = (t: string) => !opts.type || opts.type === t;

  if (!opts.available) {
    if (want("skill")) for (const r of manifest.primitives.skills ?? []) lines.push(`skill      ${refName(r)}`);
    if (want("agent")) for (const r of manifest.primitives.agents ?? []) lines.push(`agent      ${refName(r)}`);
    if (want("command")) for (const r of manifest.primitives.commands ?? []) lines.push(`command    ${refName(r)}`);
    if (want("hook")) for (const r of manifest.primitives.hooks ?? []) lines.push(`hook       ${refName(r)}`);
    return lines;
  }

  for (const source of manifest.registries ?? ["builtin"]) {
    if (source.startsWith("github:") && !existsSync(join(opts.cwd, ".aesop", "cache", registryName(source)))) {
      lines.push(`${registryName(source)}: not fetched yet — \`aesop add\` fetches on demand`);
      continue;
    }
    const reg = await fetchRegistry(source, opts.cwd);
    const scan: { type: string; dirs: string[]; strip?: RegExp }[] = [
      { type: "skill", dirs: ["registry/skills", "skills"] },
      { type: "agent", dirs: ["registry/agents", "agents"], strip: /\.md$/ },
      { type: "command", dirs: ["registry/commands", "commands", "prompts"], strip: /(\.prompt)?\.md$/ },
      { type: "instructions", dirs: ["registry/instructions", "instructions", "rules/common"], strip: /(\.instructions)?\.md$/ },
    ];
    for (const { type, dirs, strip } of scan) {
      if (!want(type)) continue;
      for (const dir of dirs) {
        const abs = join(reg.rootDir, dir);
        if (!existsSync(abs)) continue;
        for (const entry of readdirSync(abs).sort()) {
          if (entry.startsWith("_") || entry.startsWith(".")) continue;
          const name = strip ? entry.replace(strip, "") : entry;
          if (strip && name === entry && !entry.includes(".")) continue; // dir listing for file types
          lines.push(`${type.padEnd(12)} ${name}  (${reg.name})`);
        }
        break; // first existing dir wins per registry
      }
    }
  }
  return lines;
}
