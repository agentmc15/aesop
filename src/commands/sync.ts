/** `aesop sync` — diff expected (computeOutputs) against disk; report drift with file:line.
 *  --accept regenerates; --write-back lifts in-fence AGENTS.md edits into the manifest
 *  (Boris's mistake→rule loop, mechanized). Outside-fence edits are NOT drift — preservation
 *  is the contract. */
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { computeOutputs, runCompile } from "./compile.js";
import { serializeManifest, validateManifest, AesopError } from "../manifest.js";
import type { Manifest } from "../types.js";

export interface SyncOptions {
  cwd: string;
  accept?: boolean;
  writeBack?: boolean;
}

export interface DriftEntry {
  path: string;
  /** 1-based first differing line; 0 = file missing on disk. */
  line: number;
  kind: "edited" | "missing" | "orphaned";
}

export interface SyncResult {
  drift: DriftEntry[];
  /** Lines lifted into the manifest by --write-back. */
  liftedLines: string[];
  notes: string[];
}

function firstDiffLine(expected: string, actual: string): number {
  const e = expected.split("\n");
  const a = actual.split("\n");
  const n = Math.max(e.length, a.length);
  for (let i = 0; i < n; i++) {
    if (e[i] !== a[i]) return i + 1;
  }
  return 0;
}

const fenceInner = (content: string): string | undefined =>
  content.match(/<!-- aesop:begin v1 sha256:[0-9a-f]{64} -->\n([\s\S]*?)<!-- aesop:end -->/)?.[1];

/** Newest mtime (ms) of files with `ext` under `dir`, recursively; 0 if absent or empty. */
async function newestMtime(dir: string, ext: string): Promise<number> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  let newest = 0;
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) newest = Math.max(newest, await newestMtime(path, ext));
    else if (entry.name.endsWith(ext)) {
      try {
        newest = Math.max(newest, (await stat(path)).mtimeMs);
      } catch {
        /* raced with a delete — ignore */
      }
    }
  }
  return newest;
}

/** True when `root/src/**\/*.ts` is newer than `root/dist/**\/*.js`; undefined when either tree
 *  is absent (an installed package ships dist only, so there is nothing to be stale against). */
export async function buildIsStale(root: string): Promise<boolean | undefined> {
  const src = await newestMtime(join(root, "src"), ".ts");
  const dist = await newestMtime(join(root, "dist"), ".js");
  if (!src || !dist) return undefined;
  return src > dist;
}

/** Repo root of the RUNNING cli, derived from this module's own path — never from cwd, so a
 *  user project that happens to have src/ and dist/ is not mistaken for a stale aesop build. */
function runningBuildRoot(): string | undefined {
  const self = fileURLToPath(import.meta.url);
  const marker = `${sep}dist${sep}`;
  const at = self.lastIndexOf(marker);
  return at === -1 ? undefined : self.slice(0, at);
}

export async function runSync(opts: SyncOptions): Promise<SyncResult> {
  const computed = await computeOutputs({ cwd: opts.cwd });
  const result: SyncResult = { drift: [], liftedLines: [], notes: [] };

  // sync compares disk against what THIS binary believes the manifest produces. If the binary is
  // older than its source, that belief is stale and the verdict — drift or clean — is unreliable.
  const buildRoot = runningBuildRoot();
  if (buildRoot && (await buildIsStale(buildRoot)))
    result.notes.push("dist/ is older than src/ — this ran a stale compiler; `npm run build`, then re-run sync (the verdict above may be wrong)");

  for (const [path, { content: expected, fence }] of computed.outputs) {
    let actual: string;
    try {
      actual = await readFile(join(opts.cwd, path), "utf8");
    } catch {
      result.drift.push({ path, line: 0, kind: "missing" });
      continue;
    }
    if (actual === expected) continue;
    result.drift.push({ path, line: firstDiffLine(expected, actual), kind: "edited" });

    if (opts.writeBack && fence === "inline" && path === "AGENTS.md") {
      // Lift lines the user added inside the fence into a manifest instruction block.
      const expectedInner = fenceInner(expected);
      const actualInner = fenceInner(actual);
      if (expectedInner !== undefined && actualInner !== undefined) {
        const expectedSet = new Set(expectedInner.split("\n"));
        const added = actualInner.split("\n").filter((l) => l.trim() && !expectedSet.has(l));
        result.liftedLines.push(...added);
      }
    } else if (opts.writeBack && fence !== "inline") {
      result.notes.push(`${path}: structural edit — fold it into aesop.yaml by hand (write-back lifts instruction edits only)`);
    }
  }

  // Files the lock tracked that the manifest no longer produces (e.g. a primitive was removed).
  try {
    const lock = JSON.parse(await readFile(join(opts.cwd, ".aesop", "lock.json"), "utf8")) as {
      files?: Record<string, string>;
    };
    for (const path of Object.keys(lock.files ?? {})) {
      if (!computed.outputs.has(path)) result.drift.push({ path, line: 0, kind: "orphaned" });
    }
  } catch {
    result.notes.push("no .aesop/lock.json — run `aesop compile` once to establish the baseline");
  }

  if (opts.writeBack && result.liftedLines.length) {
    const manifestPath = join(opts.cwd, "aesop.yaml");
    const manifest = parse(await readFile(manifestPath, "utf8")) as Manifest;
    const instructions = (manifest.primitives.instructions ??= {});
    (instructions.blocks ??= []).push({
      scope: "project",
      content: ["## Lifted by aesop sync --write-back", ...result.liftedLines].join("\n") + "\n",
    });
    const { valid, errors } = validateManifest(manifest);
    if (!valid) throw new AesopError(2, `write-back produced an invalid manifest:\n  - ${errors.join("\n  - ")}`);
    await writeFile(manifestPath, serializeManifest(manifest, "updated by `aesop sync --write-back`"), "utf8");
  }

  if (opts.accept || (opts.writeBack && result.liftedLines.length)) {
    await runCompile({ cwd: opts.cwd }); // regenerate (write-back recompiles so the lift lands in the fence)
  }

  return result;
}

export function syncSummary(result: SyncResult, opts: SyncOptions): string {
  const lines: string[] = [];
  if (!result.drift.length) {
    lines.push("clean: disk matches the manifest.");
  } else {
    lines.push(`drift: ${result.drift.length} file(s):`);
    for (const d of result.drift) {
      lines.push(
        d.kind === "missing"
          ? `  ✗ ${d.path} (missing — run aesop compile)`
          : d.kind === "orphaned"
            ? `  ✗ ${d.path} (orphaned — no longer produced by the manifest; remove or re-add the primitive)`
            : `  ~ ${d.path}:${d.line} (edited inside the managed region)`
      );
    }
    if (opts.accept) lines.push("regenerated from the manifest (--accept).");
    else if (!opts.writeBack) lines.push("next: `aesop sync --accept` to regenerate, or --write-back to lift instruction edits into aesop.yaml");
  }
  if (result.liftedLines.length) {
    lines.push(`lifted ${result.liftedLines.length} line(s) into aesop.yaml and recompiled:`);
    for (const l of result.liftedLines) lines.push(`  + ${l}`);
  }
  for (const n of result.notes) lines.push(`  ⚠ ${n}`);
  return lines.join("\n");
}
