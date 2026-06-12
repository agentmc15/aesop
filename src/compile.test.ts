import { test } from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { runCompile } from "./commands/compile.js";

const FIXTURES = ["minimal", "full", "token-lean"] as const;
const fixturePath = (name: string) => fileURLToPath(new URL(`../fixtures/compile/${name}`, import.meta.url));

async function walk(dir: string, root = dir): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full, root)));
    else out.push(relative(root, full));
  }
  return out.sort();
}

async function compileFixture(name: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), `aesop-compile-${name}-`));
  await cp(join(fixturePath(name), "aesop.yaml"), join(dir, "aesop.yaml"));
  await runCompile({ cwd: dir });
  return dir;
}

test("GOAL LINE: compile output matches golden fixtures byte-for-byte", async () => {
  for (const name of FIXTURES) {
    const dir = await compileFixture(name);
    const expectedRoot = join(fixturePath(name), "expected");
    const expectedFiles = await walk(expectedRoot);
    const actualFiles = (await walk(dir)).filter(
      (f) => f !== "aesop.yaml" && f !== ".aesop/lock.json" && !f.startsWith(".aesop/cache/")
    );
    assert.deepEqual(actualFiles, expectedFiles, `${name}: emitted file set differs from golden`);
    for (const f of expectedFiles) {
      const expected = await readFile(join(expectedRoot, f), "utf8");
      const actual = await readFile(join(dir, f), "utf8");
      assert.equal(actual, expected, `${name}/${f}: content differs from golden`);
    }
    await rm(dir, { recursive: true, force: true });
  }
});

test("GOAL LINE: compile --check exits clean (0) after compile, drift (3) after tampering", async () => {
  const dir = await compileFixture("minimal");

  const clean = await runCompile({ cwd: dir, check: true });
  assert.equal(clean.drift.length, 0, `expected clean check, got drift: ${clean.drift.join(", ")}`);

  // Tamper inside the fenced region of a generated file → drift.
  const agentsPath = join(dir, "AGENTS.md");
  const tampered = (await readFile(agentsPath, "utf8")).replace("## Operating model", "## Tampered model");
  await writeFile(agentsPath, tampered, "utf8");
  const drifted = await runCompile({ cwd: dir, check: true });
  assert.ok(drifted.drift.includes("AGENTS.md"), "tampered AGENTS.md not reported as drift");

  await rm(dir, { recursive: true, force: true });
});

test("native path scoping: copilot applyTo and cursor globs carry the path block", async () => {
  const dir = await compileFixture("full");
  const copilot = await readFile(join(dir, ".github/instructions/packages-web.instructions.md"), "utf8");
  // applyTo is YAML-serialized (F4): this glob is safe unquoted; globs with a leading * get quoted.
  assert.ok(copilot.startsWith("---\napplyTo: packages/web/**\n---"), "applyTo frontmatter missing");
  assert.ok(copilot.includes("React function components only"));
  const cursor = await readFile(join(dir, ".cursor/rules/scoped-packages-web.mdc"), "utf8");
  assert.ok(cursor.includes("globs: packages/web/**"), "globs frontmatter missing");
  // Copilot's own instruction file omits the path block (native scoping), AGENTS.md keeps it inline.
  const copilotMain = await readFile(join(dir, ".github/copilot-instructions.md"), "utf8");
  assert.ok(!copilotMain.includes("React function components"), "path block duplicated in copilot-instructions.md");
  const agents = await readFile(join(dir, "AGENTS.md"), "utf8");
  assert.ok(agents.includes("React function components"), "path block missing from AGENTS.md");
  // Fallbacks are shared bytes: roles + portable prompts exist once for cursor AND antigravity.
  const role = await readFile(join(dir, ".aesop/roles/explorer.md"), "utf8");
  assert.ok(role.includes("READ-ONLY"));
  await rm(dir, { recursive: true, force: true });
});

test("pathway pruning: token-lean drops verify-app and critic, keeps explorer", async () => {
  const dir = await compileFixture("token-lean");
  const agentFiles = await readdir(join(dir, ".codex", "agents"));
  assert.deepEqual(agentFiles.sort(), ["explorer.toml"]);
  await rm(dir, { recursive: true, force: true });
});

test("outside-fence content is preserved across recompiles", async () => {
  const dir = await compileFixture("minimal");

  // User adds hand-written notes after the fenced region.
  const agentsPath = join(dir, "AGENTS.md");
  const handWritten = "\n## My hand-written addendum\n\nKeep this forever.\n";
  await writeFile(agentsPath, (await readFile(agentsPath, "utf8")) + handWritten, "utf8");

  await runCompile({ cwd: dir });
  const after = await readFile(agentsPath, "utf8");
  assert.ok(after.includes("Keep this forever."), "hand-written content outside the fence was lost");
  assert.ok(after.includes("aesop:begin"), "fence lost on recompile");

  // Pre-existing unmanaged file: preserved below the marker.
  const dir2 = await mkdtemp(join(tmpdir(), "aesop-prefence-"));
  await cp(join(fixturePath("minimal"), "aesop.yaml"), join(dir2, "aesop.yaml"));
  await writeFile(join(dir2, "AGENTS.md"), "# Legacy hand-rolled AGENTS\nold rule: do not delete\n", "utf8");
  await runCompile({ cwd: dir2 });
  const merged = await readFile(join(dir2, "AGENTS.md"), "utf8");
  assert.ok(merged.includes("old rule: do not delete"), "pre-existing unmanaged content was lost");
  assert.ok(merged.includes("aesop: pre-existing content below"), "preservation marker missing");

  await rm(dir, { recursive: true, force: true });
  await rm(dir2, { recursive: true, force: true });
});

test("one-off pathway override: --pathway accuracy-max keeps reviewer agents", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aesop-override-"));
  await cp(join(fixturePath("token-lean"), "aesop.yaml"), join(dir, "aesop.yaml"));
  await runCompile({ cwd: dir, pathway: "accuracy-max" });
  const agentFiles = await readdir(join(dir, ".codex", "agents"));
  assert.deepEqual(agentFiles.sort(), ["critic.toml", "explorer.toml", "verify-app.toml"]);
  await rm(dir, { recursive: true, force: true });
});

test("unknown primitive and unknown profile fail with readable errors", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aesop-badref-"));
  const manifest = await readFile(join(fixturePath("minimal"), "aesop.yaml"), "utf8");
  await writeFile(join(dir, "aesop.yaml"), manifest.replace("- verify-loop", "- no-such-skill"), "utf8");
  await assert.rejects(() => runCompile({ cwd: dir }), /unknown skill 'no-such-skill'/);
  await writeFile(join(dir, "aesop.yaml"), manifest.replace("profile: balanced", "profile: warp-speed"), "utf8");
  await assert.rejects(() => runCompile({ cwd: dir }), /unknown pathway profile 'warp-speed'/);
  await rm(dir, { recursive: true, force: true });
});
