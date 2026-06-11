/** `aesop compile` — manifest → native files. Pure render; all I/O lives here. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { claudeCodeEmitter } from "../emitters/claude-code.js";
import { codexEmitter } from "../emitters/codex.js";
import { AesopError, parseManifest } from "../manifest.js";
import { applyProfile, loadProfile } from "../profile.js";
import { resolveBuiltin, sha256 } from "../registry.js";
import { mergeWithExisting, renderAgentsMd, wrapInlineFence } from "../render.js";
import type { CompileContext, EmittedFile, Emitter, HarnessId, ResolvedPrimitive } from "../types.js";

const EMITTERS: Partial<Record<HarnessId, Emitter>> = {
  "claude-code": claudeCodeEmitter,
  codex: codexEmitter,
};

export interface CompileOptions {
  cwd: string;
  check?: boolean;
  verbose?: boolean;
  harness?: string; // csv subset
  pathway?: string; // one-off override
}

export interface CompileResult {
  files: { path: string; changed: boolean }[];
  notes: string[];
  /** Paths that would change — populated in --check mode; non-empty → exit 3. */
  drift: string[];
}

async function readIfExists(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return undefined;
  }
}

export async function runCompile(opts: CompileOptions): Promise<CompileResult> {
  const manifestRaw = await readIfExists(join(opts.cwd, "aesop.yaml"));
  if (manifestRaw === undefined) {
    throw new AesopError(1, `no aesop.yaml in ${opts.cwd} — run \`aesop init\` first`);
  }
  const manifest = parseManifest(manifestRaw);

  const profileName = opts.pathway ?? manifest.pathway.profile;
  const profile = loadProfile(profileName, opts.cwd, opts.pathway ? undefined : manifest.pathway.overrides);
  const { agents: prunedAgents, notes } = applyProfile(manifest, profile);

  // Resolve everything the emitters need; the template rides along as an instructions primitive.
  const templateRef = (manifest.primitives.instructions?.template ?? "builtin:AGENTS.template").replace(/^builtin:/, "");
  const primitives: ResolvedPrimitive[] = [
    resolveBuiltin("instructions", templateRef),
    ...prunedAgents.map((ref) => resolveBuiltin("agent", ref)),
    ...(manifest.primitives.skills ?? []).map((ref) => resolveBuiltin("skill", ref)),
    ...(manifest.primitives.commands ?? []).map((ref) => resolveBuiltin("command", ref)),
    ...(manifest.primitives.hooks ?? []).map((ref) => resolveBuiltin("hook", ref)),
  ];

  const effectiveManifest = {
    ...manifest,
    primitives: { ...manifest.primitives, agents: prunedAgents },
  };
  const ctx: CompileContext = { manifest: effectiveManifest, profile, primitives, root: opts.cwd };

  // AGENTS.md is the portable standard — emitted once by the core, not per-emitter.
  const emitted: EmittedFile[] = [
    { path: "AGENTS.md", content: wrapInlineFence(renderAgentsMd(ctx)), fence: "inline" },
  ];
  const harnessFilter = opts.harness?.split(",").map((h) => h.trim());
  for (const harness of manifest.harnesses) {
    if (harnessFilter && !harnessFilter.includes(harness)) continue;
    const emitter = EMITTERS[harness];
    if (!emitter) {
      notes.push(`harness '${harness}': emitter lands in Phase 3 — skipped`);
      continue;
    }
    emitted.push(...emitter.emit(ctx));
    if (opts.verbose) {
      for (const [prim, why] of Object.entries(emitter.capabilities().fallback)) {
        notes.push(`harness '${harness}': ${prim} fallback — ${why}`);
      }
    }
  }

  // One path, one content — a collision between emitters is a bug, not a merge.
  const byPath = new Map<string, EmittedFile>();
  for (const f of emitted) {
    const prev = byPath.get(f.path);
    if (prev && prev.content !== f.content) {
      throw new AesopError(1, `emitter collision on ${f.path} (two harnesses produced different content)`);
    }
    byPath.set(f.path, f);
  }

  const result: CompileResult = { files: [], notes, drift: [] };
  const lockFiles: Record<string, string> = {};
  for (const f of [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path))) {
    const abs = join(opts.cwd, f.path);
    const existing = await readIfExists(abs);
    const next = f.fence === "inline" ? mergeWithExisting(f.content, existing) : f.content;
    const changed = existing !== next;
    lockFiles[f.path] = sha256(next);
    result.files.push({ path: f.path, changed });
    if (changed) result.drift.push(f.path);
    if (!opts.check && changed) {
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, next, "utf8");
    }
  }

  if (!opts.check) {
    const lock = {
      version: 1,
      profile: profile.name,
      primitives: Object.fromEntries(
        [...primitives]
          .sort((a, b) => `${a.type}:${a.name}`.localeCompare(`${b.type}:${b.name}`))
          .map((p) => [`${p.type}:${p.name}`, { registry: p.registry, sha256: p.sha }])
      ),
      files: Object.fromEntries(Object.entries(lockFiles).sort(([a], [b]) => a.localeCompare(b))),
    };
    const lockPath = join(opts.cwd, ".aesop", "lock.json");
    await mkdir(dirname(lockPath), { recursive: true });
    await writeFile(lockPath, JSON.stringify(lock, null, 2) + "\n", "utf8");
    result.drift = []; // drift only meaningful in --check mode
  }

  return result;
}

export function compileSummary(result: CompileResult, check: boolean): string {
  const lines: string[] = [];
  if (check) {
    lines.push(
      result.drift.length
        ? `drift: ${result.drift.length} file(s) would change:\n${result.drift.map((p) => `  ~ ${p}`).join("\n")}`
        : "clean: emitted files match the manifest."
    );
  } else {
    const changed = result.files.filter((f) => f.changed);
    lines.push(`compiled ${result.files.length} file(s), ${changed.length} written:`);
    for (const f of result.files) lines.push(`  ${f.changed ? "✚" : "="} ${f.path}`);
  }
  for (const n of result.notes) lines.push(`  ⚠ ${n}`);
  return lines.join("\n");
}
