import { test } from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { runInit, runRefresh } from "./commands/init.js";
import { validateManifest, AesopError } from "./manifest.js";
import type { Manifest } from "./types.js";

const FIXTURES = ["node-app", "python-app", "go-app", "rust-app", "monorepo"] as const;
const fixturePath = (name: string) => fileURLToPath(new URL(`../fixtures/init/${name}`, import.meta.url));

async function initInTemp(name: string): Promise<{ manifest: Manifest; raw: string; dir: string }> {
  const dir = await mkdtemp(join(tmpdir(), `aesop-${name}-`));
  await cp(fixturePath(name), dir, { recursive: true });
  const result = await runInit({ cwd: dir, yes: true });
  const raw = await readFile(result.path, "utf8");
  return { manifest: parse(raw) as Manifest, raw, dir };
}

test("GOAL LINE: init --yes on all 5 fixtures produces a schema-valid manifest", async () => {
  for (const name of FIXTURES) {
    const { manifest, dir } = await initInTemp(name);
    const { valid, errors } = validateManifest(manifest);
    assert.ok(valid, `${name}: ${errors.join("; ")}`);
    assert.equal(manifest.version, 1);
    assert.ok(manifest.project.commands.test, `${name}: test command missing`);
    assert.ok(manifest.harnesses.length >= 1, `${name}: no harnesses`);
    assert.equal(manifest.pathway.profile, "token-lean");
    await rm(dir, { recursive: true, force: true });
  }
});

test("GOAL LINE: existing CLAUDE.md / AGENTS.md content is imported, not lost", async () => {
  const node = await initInTemp("node-app");
  const nodeBlocks = node.manifest.primitives.instructions?.blocks ?? [];
  assert.ok(
    nodeBlocks.some((b) => b.content.includes("NEVER touch the legacy/ directory")),
    "CLAUDE.md content missing from manifest blocks"
  );
  assert.ok(nodeBlocks.some((b) => b.content.includes("imported by aesop init from CLAUDE.md")));
  await rm(node.dir, { recursive: true, force: true });

  const mono = await initInTemp("monorepo");
  const monoBlocks = mono.manifest.primitives.instructions?.blocks ?? [];
  assert.ok(
    monoBlocks.some((b) => b.content.includes("Never import across package boundaries")),
    "AGENTS.md content missing from manifest blocks"
  );
  await rm(mono.dir, { recursive: true, force: true });
});

test("init refuses to overwrite an existing aesop.yaml without --force", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aesop-overwrite-"));
  await cp(fixturePath("rust-app"), dir, { recursive: true });
  await runInit({ cwd: dir, yes: true });
  await assert.rejects(
    () => runInit({ cwd: dir, yes: true }),
    (e: unknown) => e instanceof AesopError && e.exitCode === 1
  );
  await runInit({ cwd: dir, yes: true, force: true }); // --force succeeds
  await rm(dir, { recursive: true, force: true });
});

test("flags override defaults: --harness and --pathway", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aesop-flags-"));
  await cp(fixturePath("go-app"), dir, { recursive: true });
  const result = await runInit({ cwd: dir, yes: true, harness: "copilot,cursor", pathway: "accuracy-max" });
  assert.deepEqual(result.manifest.harnesses, ["copilot", "cursor"]);
  assert.equal(result.manifest.pathway.profile, "accuracy-max");
  const { valid } = validateManifest(result.manifest);
  assert.ok(valid);
  await rm(dir, { recursive: true, force: true });
});

test("init --refresh: reports detection drift, applies it only with --write, spares human fields", async () => {
  const { dir, manifest } = await initInTemp("node-app");

  // Fresh init → no drift.
  const clean = await runRefresh({ cwd: dir });
  assert.deepEqual(clean.changes, [], "fresh init should have no detection drift");

  // A stale manifest (test never set) plus human-owned edits; the project itself has moved on:
  // package.json no longer carries build/lint scripts (absence must NOT remove manifest values).
  const manifestPath = join(dir, "aesop.yaml");
  const edited = {
    ...manifest,
    project: {
      ...manifest.project,
      commands: { ...manifest.project.commands, test: "TODO: set your test command" },
      invariants: ["never break the public API"],
      review_bandwidth: 1,
    },
  };
  const { stringify } = await import("yaml");
  await writeFile(manifestPath, stringify(edited), "utf8");
  const pkgPath = join(dir, "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  pkg.scripts = { test: "vitest run" };
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2), "utf8");

  // Report-only: drift named, manifest untouched.
  const drifted = await runRefresh({ cwd: dir });
  assert.equal(drifted.written, false);
  assert.deepEqual(
    drifted.changes.map((c) => c.field),
    ["project.commands.test"]
  );
  assert.equal(drifted.changes[0]!.detected, "npm test"); // package.json has a test script → npm test
  const untouched = parse(await readFile(manifestPath, "utf8")) as Manifest;
  assert.equal(untouched.project.commands.test, "TODO: set your test command");
  const written = await runRefresh({ cwd: dir, write: true });
  assert.equal(written.written, true);
  const after = parse(await readFile(manifestPath, "utf8")) as Manifest;
  assert.equal(after.project.commands.test, "npm test");
  assert.equal(after.project.commands.build, "npm run build", "build must survive detection absence");
  assert.equal(after.project.commands.lint, "npm run lint", "lint must survive detection absence");
  assert.deepEqual(after.project.invariants, ["never break the public API"], "interviewed field clobbered");
  assert.equal(after.project.review_bandwidth, 1, "interviewed field clobbered");
  const { valid, errors } = validateManifest(after);
  assert.ok(valid, errors.join("; "));

  await rm(dir, { recursive: true, force: true });
});

test("validateManifest rejects same-family judge and missing stops", () => {
  const base = {
    version: 1,
    project: { name: "x", commands: { test: "true" }, models: { primary: { family: "claude" }, judge: { family: "claude" } } },
    harnesses: ["claude-code"],
    pathway: { profile: "balanced" },
    primitives: {},
  };
  const sameFamily = validateManifest(base);
  assert.equal(sameFamily.valid, false);
  assert.ok(sameFamily.errors.some((e) => e.includes("judge.family must differ")));

  const noStops = validateManifest({
    ...base,
    project: { name: "x", commands: { test: "true" } },
    primitives: { loops: [{ name: "g", goal: "tests pass", verify: "true", stops: { max_iterations: 10 } }] },
  });
  assert.equal(noStops.valid, false, "a goal recipe without all three stops must fail validation");
});
