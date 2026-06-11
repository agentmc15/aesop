/** `aesop lessons` — mistake → rule, as a verb. Appends to the lessons file; --promote lifts the
 *  lesson into a manifest instruction block and recompiles so every harness learns it. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import { runCompile } from "./compile.js";
import { serializeManifest, validateManifest, AesopError } from "../manifest.js";
import type { Manifest } from "../types.js";

export interface LessonsOptions {
  cwd: string;
  text: string;
  promote?: boolean;
}

export async function runLessons(opts: LessonsOptions): Promise<{ file: string; promoted: boolean }> {
  if (!opts.text.trim()) throw new AesopError(1, "usage: aesop lessons \"<the lesson>\" [--promote]");

  const manifestPath = join(opts.cwd, "aesop.yaml");
  let manifest: Manifest | undefined;
  try {
    manifest = parse(await readFile(manifestPath, "utf8")) as Manifest;
  } catch {
    // no manifest — lessons file still works; --promote needs one
  }

  const dir = join(opts.cwd, manifest?.state?.dir ?? "tasks/");
  await mkdir(dir, { recursive: true });
  const file = join(dir, "lessons.md");
  const existing = await readFile(file, "utf8").catch(() => "# Lessons\n\n<!-- mistake → rule. Append after any correction; read at session start. -->\n");
  const date = new Date().toISOString().slice(0, 10);
  await writeFile(file, `${existing.trimEnd()}\n- ${date} — ${opts.text.trim()}\n`, "utf8");

  if (opts.promote) {
    if (!manifest) throw new AesopError(1, "--promote needs an aesop.yaml (run `aesop init` first)");
    const instructions = (manifest.primitives.instructions ??= {});
    (instructions.blocks ??= []).push({ scope: "project", content: `- ${opts.text.trim()}\n` });
    const { valid, errors } = validateManifest(manifest);
    if (!valid) throw new AesopError(2, `promotion produced an invalid manifest:\n  - ${errors.join("\n  - ")}`);
    await writeFile(manifestPath, serializeManifest(manifest, "updated by `aesop lessons --promote`"), "utf8");
    await runCompile({ cwd: opts.cwd });
  }

  return { file, promoted: !!opts.promote };
}
