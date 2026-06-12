import { test } from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { runAdd, runRemove, runList } from "./commands/add.js";
import { runCompile } from "./commands/compile.js";
import { runUpdate } from "./commands/update.js";
import { validateManifest } from "./manifest.js";
import type { Manifest } from "./types.js";

const REGISTRY_FIXTURES = fileURLToPath(new URL("../fixtures/registries", import.meta.url));

/** A six-harness project wired to local copies of the ecc / awesome-copilot fixture registries
 *  (copied to temp so tests can mutate "upstream"). */
async function federatedProject(): Promise<{ dir: string; upstream: string }> {
  const dir = await mkdtemp(join(tmpdir(), "aesop-fed-"));
  const upstream = join(dir, "_upstream");
  await cp(REGISTRY_FIXTURES, upstream, { recursive: true });
  const manifest = `version: 1
project:
  name: fed-app
  commands:
    test: "true"
harnesses: [claude-code, codex, copilot, cursor, antigravity, vscode]
pathway:
  profile: accuracy-max
registries:
  - builtin
  - path:${join(upstream, "ecc")}
  - path:${join(upstream, "awesome-copilot")}
primitives:
  skills: [verify-loop]
  agents: [explorer]
  commands: [commit-pr]
`;
  await writeFile(join(dir, "aesop.yaml"), manifest, "utf8");
  await runCompile({ cwd: dir });
  return { dir, upstream };
}

test("GOAL LINE: add agent from ecc + add instructions from awesome-copilot → valid native files on all 6 harnesses", async () => {
  const { dir } = await federatedProject();

  const addedAgent = await runAdd({ cwd: dir, type: "agent", name: "code-reviewer", from: "ecc" });
  assert.equal(addedAgent.registry, "ecc");
  const addedInstr = await runAdd({ cwd: dir, type: "instructions", name: "react", from: "awesome-copilot" });
  assert.equal(addedInstr.registry, "awesome-copilot");

  // manifest is still schema-valid and carries provenance
  const manifest = parse(await readFile(join(dir, "aesop.yaml"), "utf8")) as Manifest;
  assert.ok(validateManifest(manifest).valid);
  assert.ok(manifest.primitives.agents?.some((r) => typeof r === "object" && r.name === "code-reviewer" && r.from === "ecc"));

  // ecc Claude-format agent normalized (opus→strong) and emitted natively per harness:
  const claudeAgent = await readFile(join(dir, ".claude/agents/code-reviewer.md"), "utf8");
  assert.ok(claudeAgent.includes("model: opus"), "strong tier should map back to opus for claude-code");
  assert.ok(claudeAgent.includes("tools: Read, Grep, Glob"));
  const codexAgent = await readFile(join(dir, ".codex/agents/code-reviewer.toml"), "utf8");
  assert.ok(codexAgent.includes('read_only = true'));
  const copilotAgent = await readFile(join(dir, ".github/agents/code-reviewer.md"), "utf8");
  assert.ok(copilotAgent.includes("name: code-reviewer"));
  const role = await readFile(join(dir, ".aesop/roles/code-reviewer.md"), "utf8"); // cursor + antigravity fallback
  assert.ok(role.includes("READ-ONLY"));

  // awesome-copilot instructions: applyTo → path scope, native on copilot/cursor, inline in AGENTS.md:
  const copilotInstr = await readFile(join(dir, ".github/instructions/jsx-tsx.instructions.md"), "utf8");
  assert.ok(copilotInstr.includes('applyTo: "**/*.jsx,**/*.tsx"'));
  assert.ok(copilotInstr.includes("function components with hooks"));
  const cursorRule = await readFile(join(dir, ".cursor/rules/scoped-jsx-tsx.mdc"), "utf8");
  assert.ok(cursorRule.includes("globs: **/*.jsx,**/*.tsx"));
  const agents = await readFile(join(dir, "AGENTS.md"), "utf8");
  assert.ok(agents.includes("function components with hooks"));
  // vscode + antigravity emitted too
  assert.ok((await readFile(join(dir, ".vscode/tasks.json"), "utf8")).includes("aesop: test"));
  assert.ok((await readFile(join(dir, "GUARDRAILS.md"), "utf8")).includes("hard stops"));

  await rm(dir, { recursive: true, force: true });
});

test("GOAL LINE: update shows a correct diff when upstream moves, and --apply lands it everywhere", async () => {
  const { dir, upstream } = await federatedProject();
  await runAdd({ cwd: dir, type: "agent", name: "code-reviewer", from: "ecc" });

  assert.equal((await runUpdate({ cwd: dir })).changes.length, 0, "freshly vendored should be up to date");

  // upstream moves
  const upstreamAgent = join(upstream, "ecc", "agents", "code-reviewer.md");
  await writeFile(upstreamAgent, (await readFile(upstreamAgent, "utf8")).replace("security smells", "security smells and license violations"), "utf8");

  const preview = await runUpdate({ cwd: dir });
  assert.equal(preview.changes.length, 1);
  assert.equal(preview.changes[0]!.primitive, "agent:code-reviewer");
  assert.equal(preview.changes[0]!.registry, "ecc");
  const change = preview.changes[0]!.changedFiles[0]!;
  assert.ok(change.added.some((l) => l.includes("license violations")), "diff preview missing the new upstream line");
  assert.equal(preview.applied, false);
  // not applied: emitted file unchanged
  assert.ok(!(await readFile(join(dir, ".claude/agents/code-reviewer.md"), "utf8")).includes("license violations"));

  const applied = await runUpdate({ cwd: dir, apply: true });
  assert.equal(applied.applied, true);
  assert.ok((await readFile(join(dir, ".claude/agents/code-reviewer.md"), "utf8")).includes("license violations"));
  assert.ok((await readFile(join(dir, ".codex/agents/code-reviewer.toml"), "utf8")).includes("license violations"));
  assert.equal((await runUpdate({ cwd: dir })).changes.length, 0, "should be clean after apply");

  await rm(dir, { recursive: true, force: true });
});

test("instructions update --apply replaces the provenance-marked manifest block", async () => {
  const { dir, upstream } = await federatedProject();
  await runAdd({ cwd: dir, type: "instructions", name: "react", from: "awesome-copilot" });

  const upstreamInstr = join(upstream, "awesome-copilot", "instructions", "react.instructions.md");
  await writeFile(upstreamInstr, (await readFile(upstreamInstr, "utf8")).replace("no class components", "no class components, no defaultProps"), "utf8");

  await runUpdate({ cwd: dir, apply: true });
  const manifest = await readFile(join(dir, "aesop.yaml"), "utf8");
  assert.ok(manifest.includes("no defaultProps"), "manifest block not replaced");
  assert.ok((await readFile(join(dir, ".github/instructions/jsx-tsx.instructions.md"), "utf8")).includes("no defaultProps"));
  await rm(dir, { recursive: true, force: true });
});

test("ecc skill via domain nesting + rules import + remove cleans orphans", async () => {
  const { dir } = await federatedProject();

  await runAdd({ cwd: dir, type: "skill", name: "tdd-workflow", from: "ecc" }); // lives at skills/testing/tdd-workflow
  assert.ok((await readFile(join(dir, ".claude/skills/tdd-workflow/SKILL.md"), "utf8")).includes("failing test"));

  await runAdd({ cwd: dir, type: "instructions", name: "no-console-log", from: "ecc" }); // rules/common/*.md
  assert.ok((await readFile(join(dir, "AGENTS.md"), "utf8")).includes("console.log"));

  const removed = await runRemove({ cwd: dir, type: "skill", name: "tdd-workflow" });
  assert.ok(removed.deleted.some((d) => d.includes(".claude/skills/tdd-workflow")), `orphans not deleted: ${removed.deleted.join(", ")}`);
  await assert.rejects(() => readFile(join(dir, ".claude/skills/tdd-workflow/SKILL.md"), "utf8"));

  await rm(dir, { recursive: true, force: true });
});

test("add: unknown name fails readably; list --available spans registries", async () => {
  const { dir } = await federatedProject();
  await assert.rejects(
    () => runAdd({ cwd: dir, type: "agent", name: "does-not-exist" }),
    (e: Error) => e.message.includes("not found in any registry") && e.message.includes("ecc"),
  );
  await assert.rejects(
    () => runAdd({ cwd: dir, type: "agent", name: "x", from: "nope" }),
    /not declared in aesop.yaml/
  );
  const available = await runList({ cwd: dir, available: true });
  assert.ok(available.some((l) => l.includes("code-reviewer") && l.includes("ecc")));
  assert.ok(available.some((l) => l.includes("react") && l.includes("awesome-copilot")));
  assert.ok(available.some((l) => l.includes("verify-loop") && l.includes("builtin")));
  assert.ok(!available.some((l) => /readme/i.test(l)), "README files are docs, not installable primitives");
  await rm(dir, { recursive: true, force: true });
});
