import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { detect } from "./detect.js";

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/init/${name}`, import.meta.url));

test("node-app: typescript stack, npm scripts, CLAUDE.md import + harness inference", async () => {
  const d = await detect(fixture("node-app"));
  assert.equal(d.name, "fixture-node-app");
  assert.ok(d.stack.includes("typescript"));
  assert.ok(d.stack.includes("node20"));
  assert.equal(d.commands.build, "npm run build");
  assert.equal(d.commands.test, "npm test");
  assert.equal(d.commands.lint, "npm run lint");
  assert.deepEqual(d.harnesses, ["claude-code"]);
  const claude = d.existingInstructionFiles.find((f) => f.path === "CLAUDE.md");
  assert.ok(claude?.content.includes("NEVER touch the legacy/ directory"));
});

test("python-app: pytest + ruff detected from pyproject", async () => {
  const d = await detect(fixture("python-app"));
  assert.equal(d.name, "fixture-python-app");
  assert.ok(d.stack.includes("python"));
  assert.equal(d.commands.test, "pytest");
  assert.equal(d.commands.lint, "ruff check .");
});

test("go-app: Makefile targets beat language defaults", async () => {
  const d = await detect(fixture("go-app"));
  assert.equal(d.name, "fixture-go-app");
  assert.ok(d.stack.includes("go"));
  assert.equal(d.commands.build, "make build");
  assert.equal(d.commands.test, "make test");
  assert.equal(d.commands.lint, "go vet ./..."); // no Makefile lint target → language default
});

test("rust-app: cargo defaults", async () => {
  const d = await detect(fixture("rust-app"));
  assert.equal(d.name, "fixture-rust-app");
  assert.ok(d.stack.includes("rust"));
  assert.equal(d.commands.build, "cargo build");
  assert.equal(d.commands.test, "cargo test");
  assert.equal(d.commands.lint, "cargo clippy");
});

test("monorepo: pnpm workspaces + AGENTS.md import + codex inference", async () => {
  const d = await detect(fixture("monorepo"));
  assert.equal(d.name, "fixture-monorepo");
  assert.equal(d.commands.build, "pnpm build");
  assert.equal(d.commands.test, "pnpm test");
  assert.deepEqual(d.monorepo, { packages: ["packages/*"] });
  assert.deepEqual(d.harnesses, ["codex"]);
  const agents = d.existingInstructionFiles.find((f) => f.path === "AGENTS.md");
  assert.ok(agents?.content.includes("Never import across package boundaries"));
});

test("GOAL LINE: ≥80% of aimed-for fields auto-detected across the 5 fixtures", async () => {
  // Per-fixture aims: which fields this ecosystem should yield without a human.
  const aims: Record<string, ("name" | "stack" | "build" | "test" | "lint" | "monorepo")[]> = {
    "node-app": ["name", "stack", "build", "test", "lint"],
    "python-app": ["name", "stack", "test", "lint"],
    "go-app": ["name", "stack", "build", "test", "lint"],
    "rust-app": ["name", "stack", "build", "test", "lint"],
    monorepo: ["name", "stack", "build", "test", "monorepo"],
  };
  let aimed = 0;
  let detected = 0;
  for (const [name, fields] of Object.entries(aims)) {
    const d = await detect(fixture(name));
    for (const f of fields) {
      aimed++;
      const hit =
        f === "name" ? d.name.startsWith("fixture-") || d.name === "fixture-monorepo"
        : f === "stack" ? d.stack.length > 0
        : f === "monorepo" ? d.monorepo !== undefined
        : d.commands[f] !== undefined;
      if (hit) detected++;
    }
  }
  const ratio = detected / aimed;
  assert.ok(ratio >= 0.8, `detection ratio ${detected}/${aimed} = ${ratio.toFixed(2)} < 0.80`);
});
