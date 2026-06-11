/** `aesop eject` — no lock-in, ever. Strips the fences from managed files (content stays),
 *  removes aesop.yaml and .aesop/. Requires --force: it is the one deliberately destructive
 *  command, and this CLI runs non-interactively. */
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { AesopError } from "../manifest.js";

const FENCE_LINES = /^<!-- aesop:(?:begin v1 sha256:[0-9a-f]{64}|end) -->\n/gm;
const PRESERVED_MARKER = /^<!-- aesop: pre-existing content below[^\n]*-->\n/gm;

export async function runEject(opts: { cwd: string; force?: boolean }): Promise<{ unfenced: string[] }> {
  if (!opts.force) {
    throw new AesopError(1, "eject removes aesop.yaml and .aesop/ and unfences managed files — re-run with --force to confirm");
  }
  const lockRaw = await readFile(join(opts.cwd, ".aesop", "lock.json"), "utf8").catch(() => undefined);
  const tracked = lockRaw ? Object.keys((JSON.parse(lockRaw) as { files?: Record<string, string> }).files ?? {}) : [];

  const unfenced: string[] = [];
  for (const rel of tracked) {
    const abs = join(opts.cwd, rel);
    const content = await readFile(abs, "utf8").catch(() => undefined);
    if (content === undefined) continue;
    const stripped = content.replace(FENCE_LINES, "").replace(PRESERVED_MARKER, "");
    if (stripped !== content) {
      await writeFile(abs, stripped, "utf8");
      unfenced.push(rel);
    }
  }

  await rm(join(opts.cwd, "aesop.yaml"), { force: true });
  await rm(join(opts.cwd, ".aesop"), { recursive: true, force: true });
  return { unfenced };
}
