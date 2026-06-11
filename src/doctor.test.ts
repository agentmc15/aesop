import { test } from "node:test";
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCompile } from "./commands/compile.js";
import { runDoctor, type Finding } from "./commands/doctor.js";

const fixturePath = (name: string) => fileURLToPath(new URL(`../fixtures/compile/${name}`, import.meta.url));

/** A manifest exhibiting all 8 canonical misconfigurations at once. */
const SICK_MANIFEST = `version: 1
project:
  name: sick-app
  commands:
    test: "false"                       # 1 — verify loop runs and fails
  models:
    primary: { family: claude }
    judge: { family: claude }           # 8 — judge same family as primary
harnesses: [claude-code]
pathway: { profile: balanced }
primitives:
  mcp:
    - name: ghost
      transport: stdio
      command: aesop-definitely-missing-binary-xyz   # 2 — dead MCP
  permissions:
    unattended: none                    # 6 — yolo flag found below while not in a container
  loops:
    - name: bad-loop                    # 3 — missing verify + stops (schema findings)
      goal: do things
`;

test("GOAL LINE: doctor catches all 8 canonical misconfigurations", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aesop-doctor-sick-"));
  await writeFile(join(dir, "aesop.yaml"), SICK_MANIFEST, "utf8");
  // 4 — oversize instruction file
  await writeFile(join(dir, "AGENTS.md"), Array.from({ length: 320 }, (_, i) => `line ${i}`).join("\n"), "utf8");
  // 5 — committed secret (tracked via lock; aesop.yaml is always scanned, so plant it there too)
  await writeFile(join(dir, "package.json"), JSON.stringify({ name: "sick", scripts: { yolo: "claude --dangerously-skip-permissions -p hi" } }, null, 2), "utf8");
  await mkdir(join(dir, ".aesop"), { recursive: true });
  await writeFile(join(dir, ".aesop", "lock.json"), JSON.stringify({ files: { "leak.txt": "x" } }), "utf8");
  await writeFile(join(dir, "leak.txt"), "token = \"ghp_abcdefghijklmnopqrstuvwxyz0123456789\"\n", "utf8");
  // 7 — no tasks/ directory

  const result = await runDoctor({ cwd: dir });
  const codes = new Set(result.findings.map((f: Finding) => f.code));
  for (const expected of [
    "verify-loop",
    "mcp-dead",
    "schema",
    "instructions-oversize",
    "secret",
    "yolo",
    "state-dir",
    "judge-family",
  ] as const) {
    assert.ok(codes.has(expected), `missing finding '${expected}' — got: ${[...codes].join(", ")}`);
  }
  // file:line precision where it applies
  const secret = result.findings.find((f) => f.code === "secret");
  assert.equal(secret?.at, "leak.txt:1");
  const yolo = result.findings.find((f) => f.code === "yolo");
  assert.ok(yolo?.at?.startsWith("package.json:"), `yolo finding lacks file:line (${yolo?.at})`);
  await rm(dir, { recursive: true, force: true });
});

test("doctor: healthy environment passes; --fix creates the state dir", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aesop-doctor-ok-"));
  await cp(join(fixturePath("minimal"), "aesop.yaml"), join(dir, "aesop.yaml"));
  // make the verify loop actually pass in the temp dir
  const manifest = (await import("node:fs/promises")).readFile;
  await writeFile(join(dir, "aesop.yaml"), (await manifest(join(dir, "aesop.yaml"), "utf8")).replace("test: npm test", "test: \"true\""), "utf8");
  await runCompile({ cwd: dir });

  const withFix = await runDoctor({ cwd: dir, fix: true });
  assert.deepEqual(withFix.fixed.sort(), ["tasks/lessons.md", "tasks/todo.md"]);
  assert.equal(withFix.findings.length, 0, `expected healthy, got: ${withFix.findings.map((f) => `${f.code}: ${f.message}`).join("; ")}`);

  const second = await runDoctor({ cwd: dir, matrix: true });
  assert.equal(second.findings.length, 0);
  assert.ok(second.matrix?.some((m) => m.startsWith("claude-code: goal=native")));
  await rm(dir, { recursive: true, force: true });
});
