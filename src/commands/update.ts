/** `aesop update` — re-fetch vendored registries, re-normalize, diff against the vendor copy.
 *  A prompt change is a code change: nothing is applied without --apply, and --apply recompiles
 *  so the change lands in every harness's native files for review in one diff. */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runCompile } from "./compile.js";
import {
  fetchRegistry,
  importPrimitive,
  readVendorMetas,
  vendorDir,
  writeVendored,
  PROVENANCE_MARKER,
} from "../federation.js";
import { loadManifest, serializeManifest, validateManifest, AesopError } from "../manifest.js";
import type { Manifest } from "../types.js";

export interface UpdateEntry {
  registry: string;
  primitive: string; // "type:name"
  changedFiles: { file: string; added: string[]; removed: string[] }[];
}

export interface UpdateResult {
  changes: UpdateEntry[];
  applied: boolean;
  notes: string[];
}

const PREVIEW = 6;

function diffLines(before: string, after: string): { added: string[]; removed: string[] } {
  const b = new Set(before.split("\n"));
  const a = new Set(after.split("\n"));
  return {
    added: [...a].filter((l) => l.trim() && !b.has(l)).slice(0, PREVIEW),
    removed: [...b].filter((l) => l.trim() && !a.has(l)).slice(0, PREVIEW),
  };
}

export async function runUpdate(opts: { cwd: string; apply?: boolean }): Promise<UpdateResult> {
  const metas = await readVendorMetas(opts.cwd);
  const result: UpdateResult = { changes: [], applied: false, notes: [] };
  if (!metas.length) {
    result.notes.push("nothing vendored — `aesop add <type> <name> --from <registry>` first");
    return result;
  }

  let manifestDirty = false;
  const manifestPath = join(opts.cwd, "aesop.yaml");
  const manifest = await loadManifest(opts.cwd);

  for (const meta of metas) {
    const reg = await fetchRegistry(meta.source, opts.cwd);
    for (const { type, name } of meta.primitives) {
      let imported;
      try {
        imported = await importPrimitive(reg, type, name);
      } catch {
        result.notes.push(`${meta.registry}/${type}:${name} — gone upstream; keeping the vendored copy`);
        continue;
      }
      const dir = vendorDir(opts.cwd, meta.registry, type, name);
      const changedFiles: UpdateEntry["changedFiles"] = [];
      for (const [rel, after] of Object.entries(imported.files)) {
        const before = await readFile(join(dir, rel), "utf8").catch(() => "");
        if (before !== after) changedFiles.push({ file: rel, ...diffLines(before, after) });
      }
      if (!changedFiles.length) continue;
      result.changes.push({ registry: meta.registry, primitive: `${type}:${name}`, changedFiles });

      if (opts.apply) {
        await writeVendored(opts.cwd, meta.registry, imported, reg.sha, reg.source);
        if (type === "instructions") {
          const marker = PROVENANCE_MARKER(meta.registry, name);
          const blocks = manifest.primitives.instructions?.blocks ?? [];
          const idx = blocks.findIndex((b) => b.content.startsWith(marker));
          if (idx !== -1) {
            const body = Object.values(imported.files)[0]!.replace(/^---\n[\s\S]*?\n---\n+/, "");
            blocks[idx] = { scope: (imported.scope ?? "project") as "project", content: `${marker}\n${body.trim()}\n` };
            manifestDirty = true;
          }
        }
      }
    }
  }

  if (opts.apply && result.changes.length) {
    if (manifestDirty) {
      const { valid, errors } = validateManifest(manifest);
      if (!valid) throw new AesopError(2, `update produced an invalid manifest:\n  - ${errors.join("\n  - ")}`);
      await writeFile(manifestPath, serializeManifest(manifest, "updated by `aesop update --apply`"), "utf8");
    }
    await runCompile({ cwd: opts.cwd });
    result.applied = true;
  }
  return result;
}

export function updateSummary(result: UpdateResult): string {
  const lines: string[] = [];
  if (!result.changes.length) lines.push("up to date: vendored content matches upstream.");
  for (const c of result.changes) {
    lines.push(`~ ${c.primitive} (${c.registry})`);
    for (const f of c.changedFiles) {
      for (const l of f.removed) lines.push(`    - ${l}`);
      for (const l of f.added) lines.push(`    + ${l}`);
    }
  }
  if (result.changes.length && !result.applied) lines.push("review the diff, then `aesop update --apply` to take it (recompiles).");
  if (result.applied) lines.push("applied and recompiled.");
  for (const n of result.notes) lines.push(`  ⚠ ${n}`);
  return lines.join("\n");
}
