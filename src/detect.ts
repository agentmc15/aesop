/**
 * Project detection for `aesop init`.
 * Command precedence: package.json scripts > Makefile targets > language defaults > CI scan.
 */
import { readFile, readdir, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import type { HarnessId } from "./types.js";

export interface DetectedCommands {
  build?: string;
  test?: string;
  lint?: string;
}

export interface Detection {
  name: string;
  stack: string[];
  commands: DetectedCommands;
  monorepo?: { packages: string[] };
  /** Harnesses inferred from agent files already present in the repo. */
  harnesses: HarnessId[];
  /** Existing instruction files, content preserved verbatim for import. */
  existingInstructionFiles: { path: string; content: string }[];
}

async function readIf(root: string, rel: string): Promise<string | undefined> {
  try {
    return await readFile(join(root, rel), "utf8");
  } catch {
    return undefined;
  }
}

async function isDir(root: string, rel: string): Promise<boolean> {
  try {
    return (await stat(join(root, rel))).isDirectory();
  } catch {
    return false;
  }
}

type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

function scriptRunner(pm: PackageManager, script: string): string {
  if (script === "test" && pm === "npm") return "npm test";
  switch (pm) {
    case "npm": return `npm run ${script}`;
    case "pnpm": return `pnpm ${script}`;
    case "yarn": return `yarn ${script}`;
    case "bun": return `bun run ${script}`;
  }
}

export async function detect(root: string): Promise<Detection> {
  const d: Detection = {
    name: basename(root),
    stack: [],
    commands: {},
    harnesses: [],
    existingInstructionFiles: [],
  };

  // --- Node / TypeScript ---
  const pkgRaw = await readIf(root, "package.json");
  let pm: PackageManager = "npm";
  if (await readIf(root, "pnpm-lock.yaml")) pm = "pnpm";
  else if (await readIf(root, "yarn.lock")) pm = "yarn";
  else if (await readIf(root, "bun.lockb")) pm = "bun";
  if (pkgRaw) {
    try {
      const pkg = JSON.parse(pkgRaw) as {
        name?: string;
        engines?: { node?: string };
        scripts?: Record<string, string>;
        workspaces?: string[] | { packages?: string[] };
        devDependencies?: Record<string, string>;
        dependencies?: Record<string, string>;
      };
      if (pkg.name) d.name = pkg.name;
      const ts = (await readIf(root, "tsconfig.json")) || pkg.devDependencies?.["typescript"] || pkg.dependencies?.["typescript"];
      d.stack.push(ts ? "typescript" : "javascript");
      const nodeMajor = pkg.engines?.node?.match(/(\d+)/)?.[1];
      d.stack.push(nodeMajor ? `node${nodeMajor}` : "node");
      for (const key of ["build", "test", "lint"] as const) {
        if (pkg.scripts?.[key]) d.commands[key] = scriptRunner(pm, key);
      }
      const ws = Array.isArray(pkg.workspaces) ? pkg.workspaces : pkg.workspaces?.packages;
      if (ws?.length) d.monorepo = { packages: ws };
    } catch {
      // unparseable package.json: fall through to other ecosystems
    }
  }
  const pnpmWs = await readIf(root, "pnpm-workspace.yaml");
  if (pnpmWs && !d.monorepo) {
    const packages = [...pnpmWs.matchAll(/-\s*["']?([^\s"']+)/g)].map((m) => m[1]!).filter(Boolean);
    if (packages.length) d.monorepo = { packages };
  }

  // --- Python ---
  const pyproject = await readIf(root, "pyproject.toml");
  if (pyproject || (await readIf(root, "requirements.txt")) || (await readIf(root, "setup.py"))) {
    d.stack.push("python");
    const pyName = pyproject?.match(/^name\s*=\s*"([^"]+)"/m)?.[1];
    if (pyName && !pkgRaw) d.name = pyName;
    if (!d.commands.test && (pyproject?.includes("pytest") || (await isDir(root, "tests")))) {
      d.commands.test = "pytest";
    }
    if (!d.commands.lint) {
      if (pyproject?.includes("[tool.ruff]") || pyproject?.includes('"ruff"')) d.commands.lint = "ruff check .";
      else if (pyproject?.includes("flake8")) d.commands.lint = "flake8";
    }
  }

  // --- Go ---
  const goMod = await readIf(root, "go.mod");
  if (goMod) {
    d.stack.push("go");
    const mod = goMod.match(/^module\s+(\S+)/m)?.[1];
    if (mod && !pkgRaw) d.name = mod.split("/").pop() ?? d.name;
  }

  // --- Rust ---
  const cargo = await readIf(root, "Cargo.toml");
  if (cargo) {
    d.stack.push("rust");
    const crateName = cargo.match(/^\s*name\s*=\s*"([^"]+)"/m)?.[1];
    if (crateName && !pkgRaw) d.name = crateName;
    const members = cargo.includes("[workspace]")
      ? [...cargo.matchAll(/^\s*"([^"]+)",?\s*$/gm)].map((m) => m[1]!).filter(Boolean)
      : [];
    if (members.length && !d.monorepo) d.monorepo = { packages: members };
  }

  // --- Makefile targets (override language defaults, lose to package scripts) ---
  const makefile = await readIf(root, "Makefile");
  if (makefile) {
    const targets = new Set(
      [...makefile.matchAll(/^([A-Za-z0-9_-]+)\s*:/gm)].map((m) => m[1]!).filter((t) => t !== ".PHONY")
    );
    for (const key of ["build", "test", "lint"] as const) {
      if (!d.commands[key] && targets.has(key)) d.commands[key] = `make ${key}`;
    }
  }

  // --- Language defaults ---
  if (goMod) {
    d.commands.build ??= "go build ./...";
    d.commands.test ??= "go test ./...";
    d.commands.lint ??= "go vet ./...";
  }
  if (cargo) {
    d.commands.build ??= "cargo build";
    d.commands.test ??= "cargo test";
    d.commands.lint ??= "cargo clippy";
  }

  // --- CI scan: last resort for a test command ---
  if (!d.commands.test) {
    const wfDir = join(root, ".github", "workflows");
    try {
      for (const f of await readdir(wfDir)) {
        if (!/\.ya?ml$/.test(f)) continue;
        const wf = await readFile(join(wfDir, f), "utf8");
        const run = wf.match(/run:\s*(.+\b(?:test|pytest)\b.*)/)?.[1];
        if (run) {
          d.commands.test = run.trim();
          break;
        }
      }
    } catch {
      // no workflows dir
    }
  }

  // --- Existing agent files → harness inference + import ---
  const instructionSources: { rel: string; harness?: HarnessId }[] = [
    { rel: "CLAUDE.md", harness: "claude-code" },
    { rel: "AGENTS.md", harness: "codex" },
    { rel: ".github/copilot-instructions.md", harness: "copilot" },
    { rel: "GEMINI.md", harness: "antigravity" },
  ];
  for (const { rel, harness } of instructionSources) {
    const content = await readIf(root, rel);
    if (content !== undefined) {
      d.existingInstructionFiles.push({ path: rel, content });
      if (harness && !d.harnesses.includes(harness)) d.harnesses.push(harness);
    }
  }
  if ((await isDir(root, ".claude")) && !d.harnesses.includes("claude-code")) d.harnesses.push("claude-code");
  if ((await isDir(root, ".codex")) && !d.harnesses.includes("codex")) d.harnesses.push("codex");
  if ((await isDir(root, ".github/instructions")) && !d.harnesses.includes("copilot")) d.harnesses.push("copilot");
  if (await isDir(root, ".cursor")) {
    if (!d.harnesses.includes("cursor")) d.harnesses.push("cursor");
    try {
      const rulesDir = join(root, ".cursor", "rules");
      for (const f of await readdir(rulesDir)) {
        if (f.endsWith(".mdc")) {
          d.existingInstructionFiles.push({
            path: `.cursor/rules/${f}`,
            content: await readFile(join(rulesDir, f), "utf8"),
          });
        }
      }
    } catch {
      // .cursor exists but no rules dir
    }
  }

  return d;
}
