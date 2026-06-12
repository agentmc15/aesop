/** Path-safety guards. Aesop turns names (some from untrusted registry content) into file paths
 *  and writes them; these are the chokepoints that keep that from escaping the project. */
import { basename, resolve, sep } from "node:path";
import { AesopError } from "./manifest.js";

/** True if `name` is safe to use as a single path segment (no separators, no `..`). */
export function isSafeName(name: string): boolean {
  return (
    !!name &&
    name !== "." &&
    name !== ".." &&
    !name.includes("..") &&
    !name.includes("/") &&
    !name.includes("\\") &&
    !name.includes("\0") &&
    basename(name) === name
  );
}

/** Assert a name is path-segment-safe. Use where the user supplied it (e.g. `aesop add <name>`)
 *  and a bad value should fail loudly rather than be silently rewritten. */
export function assertSafeName(name: string, what = "name"): string {
  if (!isSafeName(name)) {
    throw new AesopError(2, `unsafe ${what} '${name}' — must not contain path separators or '..'`);
  }
  return name;
}

/** Return `candidate` if it is path-safe, else `fallback`. Use for names that come from
 *  untrusted content (registry frontmatter) where compile should degrade, not break. */
export function safeNameOr(candidate: string | undefined, fallback: string): string {
  return candidate && isSafeName(candidate) ? candidate : fallback;
}

/** Defense-in-depth catch-all: a written/emitted path must resolve inside the project root.
 *  Applied to every file the compiler funnels out, so any future emitter is covered too. */
export function assertWithinRepo(root: string, relPath: string, what = "path"): string {
  const base = resolve(root);
  const target = resolve(base, relPath);
  if (target !== base && !target.startsWith(base + sep)) {
    throw new AesopError(2, `refused: ${what} '${relPath}' resolves outside the project root`);
  }
  return target;
}
