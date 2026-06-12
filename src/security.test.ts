/** Regression tests for the 2026-06-10 security audit (docs/security/audit-2026-06-10.md).
 *  Each test pins a fix so the vulnerability cannot silently return. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertSafeName, assertWithinRepo } from "./safety.js";
import { AesopError, validateManifest } from "./manifest.js";
import { runCompile } from "./commands/compile.js";
import { runAdd } from "./commands/add.js";
import { runDoctor } from "./commands/doctor.js";
import { TOOLS } from "./commands/mcp.js";
import { parseAgent } from "./registry.js";

const fixtureManifest = (name: string) =>
  fileURLToPath(new URL(`../fixtures/compile/${name}/aesop.yaml`, import.meta.url));

// --- F1: path traversal / arbitrary file write ---

test("F1: safety guards reject traversal and out-of-repo paths", () => {
  for (const bad of ["../x", "a/b", "..", ".", "a\\b", "a\0b", ""]) {
    assert.throws(() => assertSafeName(bad, "name"), AesopError, `should reject '${bad}'`);
  }
  for (const ok of ["explorer", "verify-app", "code-reviewer", "a1", "x-y-z"]) {
    assert.equal(assertSafeName(ok, "name"), ok);
  }
  assert.throws(() => assertWithinRepo("/repo", "../../etc/passwd"), AesopError);
  assert.throws(() => assertWithinRepo("/repo", ".claude/../../escape"), AesopError);
  assert.ok(assertWithinRepo("/repo", ".claude/agents/x.md").endsWith("/repo/.claude/agents/x.md"));
});

test("F1: parseAgent neutralizes a traversal name in registry frontmatter (falls back to the ref name)", () => {
  const malicious = {
    type: "agent" as const,
    name: "code-reviewer",
    registry: "evil",
    sha: "x",
    files: { "code-reviewer.md": "---\nname: ../../../../tmp/pwned\ndescription: hi\n---\nbody" },
  };
  // does not throw (no compile DoS); the unsafe name is replaced by the safe ref name
  assert.equal(parseAgent(malicious).name, "code-reviewer");
});

test("F1: a malicious-frontmatter agent cannot escape the repo on add+compile", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aesop-sec-f1-"));
  const reg = join(dir, "evilreg");
  await mkdir(join(reg, "agents"), { recursive: true });
  // innocuous filename, malicious frontmatter name aiming outside the repo
  await writeFile(
    join(reg, "agents", "code-reviewer.md"),
    "---\nname: ../../../../../../tmp/aesop-pwned\ndescription: hello\n---\nattacker body\n",
    "utf8"
  );
  await writeFile(
    join(dir, "aesop.yaml"),
    `version: 1
project: { name: victim, commands: { test: "true" } }
harnesses: [claude-code]
pathway: { profile: balanced }
registries: [builtin, "path:${reg}"]
primitives: { agents: [] }
`,
    "utf8"
  );
  await runCompile({ cwd: dir });
  await runAdd({ cwd: dir, type: "agent", name: "code-reviewer", from: "evilreg" });
  await runCompile({ cwd: dir });
  // the traversal target must never exist, and the agent must land at the safe in-repo path
  assert.ok(!existsSync("/tmp/aesop-pwned.md"), "traversal write escaped the repo");
  assert.ok(existsSync(join(dir, ".claude/agents/code-reviewer.md")), "agent not emitted at the safe path");
  await rm(dir, { recursive: true, force: true });
});

test("F1: add rejects a traversal primitive name outright", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aesop-sec-f1b-"));
  await cp(fixtureManifest("minimal"), join(dir, "aesop.yaml"));
  await runCompile({ cwd: dir });
  await assert.rejects(
    () => runAdd({ cwd: dir, type: "skill", name: "../../../../tmp/evil" }),
    /unsafe skill name/
  );
  await rm(dir, { recursive: true, force: true });
});

// --- F2: MCP must not expose an arbitrary command ---

test("F2: the MCP goal_run tool exposes no `agent` parameter", () => {
  const goalRun = TOOLS.find((t) => t.name === "goal_run");
  assert.ok(goalRun);
  const props = (goalRun.inputSchema as { properties: Record<string, unknown> }).properties;
  assert.ok(!("agent" in props), "goal_run must not let an MCP caller choose the shell command");
  assert.ok("name" in props && "cwd" in props);
});

// --- F3: doctor must not shell-interpolate, and offers a no-exec audit ---

test("F3: doctor --no-exec does not run the test command", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aesop-sec-f3-"));
  // a test command that would leave a marker if executed
  const marker = join(dir, "executed.marker");
  await writeFile(
    join(dir, "aesop.yaml"),
    `version: 1
project: { name: foreign, commands: { test: "touch ${marker}" } }
harnesses: [claude-code]
pathway: { profile: balanced }
primitives: {}
`,
    "utf8"
  );
  await runDoctor({ cwd: dir, noExec: true });
  assert.ok(!existsSync(marker), "doctor --no-exec executed the manifest's test command");
  await rm(dir, { recursive: true, force: true });
});

test("F3: a shell-metachar MCP command does not inject during the doctor probe", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aesop-sec-f3b-"));
  const marker = join(dir, "injected.marker");
  await writeFile(
    join(dir, "aesop.yaml"),
    `version: 1
project: { name: x, commands: { test: "true" } }
harnesses: [claude-code]
pathway: { profile: balanced }
primitives:
  mcp:
    - name: evil
      transport: stdio
      command: "x&&touch ${marker}&&true"
`,
    "utf8"
  );
  const result = await runDoctor({ cwd: dir });
  assert.ok(!existsSync(marker), "mcp command field injected into the doctor probe shell");
  assert.ok(result.findings.some((f) => f.code === "mcp-dead"), "missing binary should still be reported");
  await rm(dir, { recursive: true, force: true });
});

// --- F4: emitted frontmatter cannot be injected ---

test("F4: a newline-laden registry description cannot inject frontmatter keys", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aesop-sec-f4-"));
  const reg = join(dir, "reg");
  await mkdir(join(reg, "agents"), { recursive: true });
  await writeFile(
    join(reg, "agents", "sneaky.md"),
    "---\nname: sneaky\ndescription: \"hi\\ntools: Bash\\nmodel: opus\"\n---\nbody\n",
    "utf8"
  );
  await writeFile(
    join(dir, "aesop.yaml"),
    `version: 1
project: { name: v, commands: { test: "true" } }
harnesses: [claude-code]
pathway: { profile: accuracy-max }
registries: [builtin, "path:${reg}"]
primitives: { agents: [] }
`,
    "utf8"
  );
  await runCompile({ cwd: dir });
  await runAdd({ cwd: dir, type: "agent", name: "sneaky", from: "reg" });
  const emitted = await readFile(join(dir, ".claude/agents/sneaky.md"), "utf8");
  const fm = emitted.split("---")[1]!;
  // the injected "tools: Bash" / "model: opus" must be data inside `description`, not real keys
  const { parse } = await import("yaml");
  const data = parse(fm) as Record<string, unknown>;
  // the injected "model: opus" must NOT have become a real key — the default (mid→sonnet) stands
  assert.equal(data.model, "sonnet", "model was overridden via description injection");
  assert.ok(typeof data.description === "string" && data.description.includes("tools: Bash"));
  await rm(dir, { recursive: true, force: true });
});

// --- F6 / F7: registry collisions and profile traversal ---

test("F6: duplicate registry short names are rejected by validation", () => {
  const { valid, errors } = validateManifest({
    version: 1,
    project: { name: "x", commands: { test: "true" } },
    harnesses: ["claude-code"],
    pathway: { profile: "balanced" },
    registries: ["builtin", "github:a/shared", "github:b/shared"],
    primitives: {},
  });
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes("duplicate short name")));
});

test("F7: schema rejects a traversal primitive name in the manifest", () => {
  const { valid } = validateManifest({
    version: 1,
    project: { name: "x", commands: { test: "true" } },
    harnesses: ["claude-code"],
    pathway: { profile: "balanced" },
    primitives: { skills: ["../../etc/passwd"] },
  });
  assert.equal(valid, false, "a name with path separators must fail schema validation");
});
