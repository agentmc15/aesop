/** `aesop doctor` — audit the environment. Eight canonical checks, each a coded finding.
 *  Never auto-fixes meaning; --fix only creates the notes directory. Exit 3 on findings. */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { parse } from "yaml";
import { EMITTERS } from "./compile.js";
import { AesopError, validateManifest } from "../manifest.js";
import type { HarnessId, Manifest } from "../types.js";

const exec = promisify(execFile);

export interface DoctorOptions {
  cwd: string;
  fix?: boolean;
  matrix?: boolean;
  /** Static audit only — never execute the manifest's test command or probe MCP binaries.
   *  Use when auditing a repo whose aesop.yaml you did not author (F3). */
  noExec?: boolean;
}

export interface Finding {
  code:
    | "verify-loop"
    | "mcp-dead"
    | "schema"
    | "instructions-oversize"
    | "secret"
    | "yolo"
    | "state-dir"
    | "judge-family";
  message: string;
  /** file:line where applicable. */
  at?: string;
}

export interface DoctorResult {
  findings: Finding[];
  fixed: string[];
  matrix?: string[];
}

const SECRET_PATTERNS: { re: RegExp; what: string }[] = [
  { re: /ghp_[A-Za-z0-9]{20,}/, what: "GitHub token" },
  { re: /sk-[A-Za-z0-9-]{20,}/, what: "API key (sk-…)" },
  { re: /AKIA[0-9A-Z]{16}/, what: "AWS access key" },
  { re: /(?:api[_-]?key|secret|token|password)["']?\s*[:=]\s*["'](?!\$\{)[^"'\s]{12,}["']/i, what: "literal credential" },
];

const INSTRUCTION_FILES = ["AGENTS.md", "CLAUDE.md", ".github/copilot-instructions.md", "GEMINI.md"];
const YOLO_SCAN = ["package.json", "Makefile", ".claude/settings.json", ".codex/config.toml"];

async function readIf(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return undefined;
  }
}

function scanForLine(content: string, re: RegExp): number {
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) if (re.test(lines[i]!)) return i + 1;
  return 0;
}

export async function runDoctor(opts: DoctorOptions): Promise<DoctorResult> {
  const result: DoctorResult = { findings: [], fixed: [] };
  const manifestRaw = await readIf(join(opts.cwd, "aesop.yaml"));
  if (manifestRaw === undefined) {
    throw new AesopError(1, `no aesop.yaml in ${opts.cwd} — run \`aesop init\` first`);
  }

  // 3 + 8 — lenient load: schema problems (incl. missing goal stops) and the same-family judge
  // become findings, not crashes, so the remaining checks still run.
  let manifest: Manifest;
  try {
    manifest = parse(manifestRaw) as Manifest;
  } catch (e) {
    result.findings.push({ code: "schema", message: `aesop.yaml is not parseable YAML: ${(e as Error).message}`, at: "aesop.yaml" });
    return result;
  }
  const { errors } = validateManifest(manifest);
  for (const e of errors) {
    result.findings.push({
      code: e.includes("judge.family") ? "judge-family" : "schema",
      message: e,
      at: "aesop.yaml",
    });
  }

  // 1 — the verify loop is load-bearing (no runnable test command = unhealthy by definition).
  // --no-exec skips actually running it, for auditing a repo whose aesop.yaml you didn't author (F3).
  const testCmd = manifest.project?.commands?.test;
  if (!testCmd || testCmd.startsWith("TODO")) {
    result.findings.push({ code: "verify-loop", message: `test command is unset ('${testCmd ?? ""}') — the agent cannot prove its work`, at: "aesop.yaml" });
  } else if (!opts.noExec) {
    try {
      // shell:true runs the manifest's own command via sh -c / cmd.exe — the same trust the
      // project owner already extends to it; nothing foreign is interpolated (F3).
      await exec(testCmd, { cwd: opts.cwd, timeout: 120_000, shell: true });
    } catch {
      result.findings.push({ code: "verify-loop", message: `test command failed: \`${testCmd}\` — fix it before trusting any loop`, at: "aesop.yaml" });
    }
  }

  // 2 — MCP health (binary resolution; a real handshake probe arrives with federation, Phase 5).
  if (!opts.noExec) {
    for (const server of manifest.primitives?.mcp ?? []) {
      if (server.transport !== "stdio" || !server.command) continue;
      const bin = server.command.split(" ")[0]!;
      try {
        // bin is passed as an argv entry, never interpolated into a script — no shell
        // injection (F3). POSIX resolves via `command -v "$1"`, Windows via `where <bin>`.
        if (process.platform === "win32") {
          await exec("where", [bin], { cwd: opts.cwd, timeout: 10_000 });
        } else {
          await exec("sh", ["-c", 'command -v "$1"', "sh", bin], { cwd: opts.cwd, timeout: 10_000 });
        }
      } catch {
        result.findings.push({ code: "mcp-dead", message: `MCP server '${server.name}': command '${bin}' not found on PATH`, at: "aesop.yaml" });
      }
    }
  }

  // 4 — instruction files must survive compaction.
  for (const rel of INSTRUCTION_FILES) {
    const content = await readIf(join(opts.cwd, rel));
    if (content && content.split("\n").length > 300) {
      result.findings.push({ code: "instructions-oversize", message: `${rel} is ${content.split("\n").length} lines (>300) — every line must earn its place`, at: rel });
    }
  }

  // 5 — secrets never enter config.
  const lock = JSON.parse((await readIf(join(opts.cwd, ".aesop", "lock.json"))) ?? "{}") as { files?: Record<string, string> };
  const secretScan = ["aesop.yaml", ...Object.keys(lock.files ?? {})];
  for (const rel of secretScan) {
    const content = await readIf(join(opts.cwd, rel));
    if (!content) continue;
    for (const { re, what } of SECRET_PATTERNS) {
      const line = scanForLine(content, re);
      if (line) result.findings.push({ code: "secret", message: `${what} committed in config — move it to an env var`, at: `${rel}:${line}` });
    }
  }

  // 6 — skip-permissions is only sanctioned inside a container. Lines that are themselves the
  // guard (the block-dangerous-commands hook quotes the flag in its deny pattern) don't count.
  if (manifest.primitives?.permissions?.unattended !== "devcontainer") {
    for (const rel of YOLO_SCAN) {
      const content = await readIf(join(opts.cwd, rel));
      if (!content) continue;
      const lines = content.split("\n");
      const idx = lines.findIndex((l) => l.includes("--dangerously-skip-permissions") && !l.includes("blocked by aesop"));
      const line = idx + 1;
      if (line) {
        result.findings.push({ code: "yolo", message: "--dangerously-skip-permissions used outside a devcontainer (set permissions.unattended or remove it)", at: `${rel}:${line}` });
      }
    }
  }

  // 7 — durable memory on disk: the agent forgets; the repo must not.
  const stateDir = manifest.state?.dir ?? "tasks/";
  const stateAbs = join(opts.cwd, stateDir);
  const missing = ["todo.md", "lessons.md"].filter((f) => !existsSync(join(stateAbs, f)));
  if (missing.length) {
    if (opts.fix) {
      await mkdir(stateAbs, { recursive: true });
      for (const f of missing) {
        const body = f === "lessons.md" ? "# Lessons\n\n<!-- mistake → rule. Append after any correction; read at session start. -->\n" : "# Todo\n";
        await writeFile(join(stateAbs, f), body, "utf8");
        result.fixed.push(`${stateDir}${f}`);
      }
    } else {
      result.findings.push({ code: "state-dir", message: `${stateDir} is missing ${missing.join(", ")} — durable memory lives on disk (run doctor --fix)`, at: stateDir });
    }
  }

  if (opts.matrix) {
    result.matrix = (manifest.harnesses ?? []).map((h: HarnessId) => {
      const caps = EMITTERS[h]?.capabilities();
      if (!caps) return `${h}: no emitter`;
      const fallbacks = Object.keys(caps.fallback);
      return `${h}: goal=${caps.goalMode} native=[${caps.native.join(", ")}]${fallbacks.length ? ` fallback=[${fallbacks.join(", ")}]` : ""}`;
    });
  }

  return result;
}

export function doctorSummary(result: DoctorResult): string {
  const lines: string[] = [];
  if (result.matrix) {
    lines.push("capabilities (compare against docs/03-harness-matrix.md):", ...result.matrix.map((m) => `  ${m}`), "");
  }
  for (const f of result.fixed) lines.push(`  ✚ fixed: created ${f}`);
  if (!result.findings.length) {
    lines.push("healthy: all checks passed.");
  } else {
    lines.push(`${result.findings.length} finding(s):`);
    for (const f of result.findings) lines.push(`  ✗ [${f.code}] ${f.message}${f.at ? `  (${f.at})` : ""}`);
  }
  return lines.join("\n");
}
