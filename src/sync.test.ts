import { test } from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCompile } from "./commands/compile.js";
import { runSync } from "./commands/sync.js";
import { runEject } from "./commands/eject.js";
import { runLessons } from "./commands/lessons.js";

const fixturePath = (name: string) => fileURLToPath(new URL(`../fixtures/compile/${name}`, import.meta.url));

async function compiledTemp(fixture: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "aesop-sync-"));
  await cp(join(fixturePath(fixture), "aesop.yaml"), join(dir, "aesop.yaml"));
  await runCompile({ cwd: dir });
  return dir;
}

/** Replace line `line` (1-based) of a file with tampered content; returns the line number. */
async function tamperLine(dir: string, rel: string, line: number): Promise<number> {
  const abs = join(dir, rel);
  const lines = (await readFile(abs, "utf8")).split("\n");
  assert.ok(lines.length > line, `${rel} too short to tamper line ${line}`);
  lines[line - 1] = `TAMPERED ${rel}`;
  await writeFile(abs, lines.join("\n"), "utf8");
  return line;
}

test("GOAL LINE: 10 seeded drifts → 10/10 detected with correct file and line", async () => {
  // 10 distinct managed files across the full fixture (all six harnesses), tampered at known
  // lines INSIDE their managed regions (inline-fenced files: line 2+ is inside the fence).
  const seeds: { rel: string; line: number }[] = [
    { rel: "AGENTS.md", line: 10 },
    { rel: "CLAUDE.md", line: 4 },
    { rel: "GUARDRAILS.md", line: 6 },
    { rel: ".claude/settings.json", line: 3 },
    { rel: ".claude/agents/explorer.md", line: 5 },
    { rel: ".claude/commands/commit-pr.md", line: 7 },
    { rel: ".codex/config.toml", line: 4 },
    { rel: ".cursor/rules/00-aesop.mdc", line: 7 },
    { rel: ".github/copilot-instructions.md", line: 12 },
    { rel: ".aesop/roles/explorer.md", line: 3 },
  ];
  let detected = 0;
  for (const seed of seeds) {
    const dir = await compiledTemp("full");
    await tamperLine(dir, seed.rel, seed.line);
    const result = await runSync({ cwd: dir });
    const hit = result.drift.find((d) => d.path === seed.rel);
    assert.ok(hit, `${seed.rel}: drift not detected`);
    assert.equal(hit.kind, "edited", `${seed.rel}: wrong drift kind`);
    assert.equal(hit.line, seed.line, `${seed.rel}: wrong line (got ${hit.line}, tampered ${seed.line})`);
    assert.equal(result.drift.length, 1, `${seed.rel}: false positives: ${result.drift.map((d) => d.path).join(", ")}`);
    detected++;
    await rm(dir, { recursive: true, force: true });
  }
  assert.equal(detected, 10);
});

test("sync: clean after compile; missing and orphaned files reported", async () => {
  const dir = await compiledTemp("minimal");
  assert.equal((await runSync({ cwd: dir })).drift.length, 0, "fresh compile should be clean");

  await rm(join(dir, "CLAUDE.md"));
  const missing = await runSync({ cwd: dir });
  assert.ok(missing.drift.some((d) => d.path === "CLAUDE.md" && d.kind === "missing"));

  // Remove a primitive from the manifest → its emitted file becomes orphaned.
  const manifest = (await readFile(join(dir, "aesop.yaml"), "utf8")).replace("  commands:\n    - commit-pr\n", "  commands: []\n");
  await writeFile(join(dir, "aesop.yaml"), manifest, "utf8");
  const orphaned = await runSync({ cwd: dir });
  assert.ok(
    orphaned.drift.some((d) => d.path === ".claude/commands/commit-pr.md" && d.kind === "orphaned"),
    "removed primitive's file not reported as orphaned"
  );
  await rm(dir, { recursive: true, force: true });
});

test("sync --accept regenerates; outside-fence edits survive", async () => {
  const dir = await compiledTemp("minimal");
  const agentsPath = join(dir, "AGENTS.md");
  await writeFile(agentsPath, (await readFile(agentsPath, "utf8")).replace("## Operating model", "## Tampered") + "\n## Hand-written\n\nkeep me\n", "utf8");
  await runSync({ cwd: dir, accept: true });
  const after = await readFile(agentsPath, "utf8");
  assert.ok(after.includes("## Operating model"), "fenced region not regenerated");
  assert.ok(after.includes("keep me"), "outside-fence content lost by --accept");
  assert.equal((await runSync({ cwd: dir })).drift.length, 0);
  await rm(dir, { recursive: true, force: true });
});

test("sync --write-back lifts in-fence AGENTS.md additions into the manifest (mistake → rule)", async () => {
  const dir = await compiledTemp("minimal");
  const agentsPath = join(dir, "AGENTS.md");
  const rule = "- NEVER call the payments API in tests; use the sandbox.";
  await writeFile(agentsPath, (await readFile(agentsPath, "utf8")).replace("## Operating model", `${rule}\n\n## Operating model`), "utf8");

  const result = await runSync({ cwd: dir, writeBack: true });
  assert.ok(result.liftedLines.includes(rule), "added line not lifted");
  assert.ok((await readFile(join(dir, "aesop.yaml"), "utf8")).includes(rule), "manifest not updated");
  const recompiled = await readFile(agentsPath, "utf8");
  assert.ok(recompiled.includes(rule), "lifted rule missing from recompiled AGENTS.md");
  assert.equal((await runSync({ cwd: dir })).drift.length, 0, "not clean after write-back");
  await rm(dir, { recursive: true, force: true });
});

test("lessons --promote adds the rule to AGENTS.md via the manifest", async () => {
  const dir = await compiledTemp("minimal");
  await runLessons({ cwd: dir, text: "Always run the linter before committing.", promote: true });
  assert.ok((await readFile(join(dir, "tasks", "lessons.md"), "utf8")).includes("Always run the linter"));
  assert.ok((await readFile(join(dir, "AGENTS.md"), "utf8")).includes("Always run the linter"));
  await rm(dir, { recursive: true, force: true });
});

test("eject strips fences, keeps content, removes manifest and lock", async () => {
  const dir = await compiledTemp("minimal");
  await runEject({ cwd: dir, force: true });
  const agents = await readFile(join(dir, "AGENTS.md"), "utf8");
  assert.ok(!agents.includes("aesop:begin"), "fence not stripped");
  assert.ok(agents.includes("## Operating model"), "content lost on eject");
  await assert.rejects(() => readFile(join(dir, "aesop.yaml"), "utf8"));
  await assert.rejects(() => readFile(join(dir, ".aesop", "lock.json"), "utf8"));
  await rm(dir, { recursive: true, force: true });
});
