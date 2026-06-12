import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { runBundle } from "./commands/bundle.js";
import { runCompile } from "./commands/compile.js";

const exec = promisify(execFile);
const fixturePath = (name: string) => fileURLToPath(new URL(`../fixtures/compile/${name}`, import.meta.url));
const packageRoot = fileURLToPath(new URL("..", import.meta.url));

async function compiledTemp(fixture: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "aesop-ship-"));
  await cp(join(fixturePath(fixture), "aesop.yaml"), join(dir, "aesop.yaml"));
  await runCompile({ cwd: dir });
  return dir;
}

test("GOAL LINE (one-command install): bundle produces a claude plugin + marketplace", async () => {
  const dir = await compiledTemp("minimal");
  const result = await runBundle({ cwd: dir, format: "claude-plugin" });
  const root = join(dir, ".aesop/bundle/claude-plugin");
  const plugin = JSON.parse(await readFile(join(root, "minimal-app/.claude-plugin/plugin.json"), "utf8"));
  assert.equal(plugin.name, "minimal-app");
  const marketplace = JSON.parse(await readFile(join(root, ".claude-plugin/marketplace.json"), "utf8"));
  assert.equal(marketplace.plugins[0].source, "./minimal-app");
  assert.ok(await readFile(join(root, "minimal-app/agents/explorer.md"), "utf8"));
  assert.ok(await readFile(join(root, "minimal-app/commands/commit-pr.md"), "utf8"));
  assert.ok((await readFile(join(root, "minimal-app/skills/verify-loop/SKILL.md"), "utf8")).includes("verify-loop"));
  assert.ok(result.install.includes("/plugin install minimal-app@minimal-app-marketplace"));
  await rm(dir, { recursive: true, force: true });
});

test("bundle: copilot plugin from .github outputs, tarball contains the whole environment", async () => {
  const dir = await compiledTemp("full");
  const copilot = await runBundle({ cwd: dir, format: "copilot-plugin" });
  assert.ok(copilot.files > 5);
  assert.ok(
    (await readFile(join(dir, ".aesop/bundle/copilot-plugin/instructions/packages-web.instructions.md"), "utf8")).includes("applyTo")
  );

  const tarball = await runBundle({ cwd: dir, format: "tarball" });
  const { stdout } = await exec("tar", ["tzf", tarball.out]);
  assert.ok(stdout.includes("CLAUDE.md"));
  assert.ok(stdout.includes(".codex/config.toml"));
  assert.ok(stdout.includes("GUARDRAILS.md"));
  await rm(dir, { recursive: true, force: true });
});

test("GOAL LINE (agent-native): MCP server answers initialize, tools/list, and a doctor tools/call", async () => {
  const dir = await compiledTemp("minimal");
  const child = spawn("node", [join(packageRoot, "dist/index.js"), "mcp", "serve"], {
    stdio: ["pipe", "pipe", "inherit"],
  });
  const responses: Record<string | number, unknown> = {};
  let buffer = "";
  child.stdout.on("data", (chunk: Buffer) => {
    buffer += chunk.toString();
    let nl;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      if (!line.trim()) continue;
      const msg = JSON.parse(line) as { id: string | number };
      responses[msg.id] = msg;
    }
  });
  const waitFor = (id: number, timeoutMs = 30_000) =>
    new Promise<{ result: never }>((resolve, reject) => {
      const t0 = Date.now();
      const poll = setInterval(() => {
        if (responses[id]) {
          clearInterval(poll);
          resolve(responses[id] as { result: never });
        } else if (Date.now() - t0 > timeoutMs) {
          clearInterval(poll);
          reject(new Error(`timeout waiting for response ${id}`));
        }
      }, 10);
    });
  const send = (msg: Record<string, unknown>) => child.stdin.write(JSON.stringify(msg) + "\n");

  try {
    send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05" } });
    const init = (await waitFor(1)) as { result: { serverInfo: { name: string } } };
    assert.equal(init.result.serverInfo.name, "aesop");

    send({ jsonrpc: "2.0", method: "notifications/initialized" });
    send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    const tools = (await waitFor(2)) as { result: { tools: { name: string }[] } };
    const names = tools.result.tools.map((t) => t.name);
    for (const expected of ["compile", "sync", "doctor", "add", "list", "lessons", "goal_list", "goal_run"]) {
      assert.ok(names.includes(expected), `missing tool ${expected}`);
    }

    send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "doctor", arguments: { cwd: dir, fix: true } } });
    const doctor = (await waitFor(3)) as { result: { content: { text: string }[]; isError?: boolean } };
    assert.ok(!doctor.result.isError, doctor.result.content[0]?.text);
    const parsed = JSON.parse(doctor.result.content[0]!.text) as { findings: { code: string }[] };
    // minimal fixture's test command is `npm test` which fails in the temp dir → verify-loop finding expected
    assert.ok(Array.isArray(parsed.findings));

    send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "goal_list", arguments: { cwd: dir } } });
    const goals = (await waitFor(4)) as { result: { isError?: boolean } };
    assert.ok(!goals.result.isError);
  } finally {
    child.stdin.end();
    child.kill();
    await rm(dir, { recursive: true, force: true });
  }
});

test("npm pack ships exactly the runtime surface (dist, registry, profiles, schemas)", async () => {
  const { stdout } = await exec("npm", ["pack", "--dry-run", "--json"], { cwd: packageRoot, timeout: 60_000 });
  const [info] = JSON.parse(stdout) as [{ files: { path: string }[]; name: string; version: string }];
  assert.equal(info.name, "@agentmc15/aesop");
  const paths = info.files.map((f) => f.path);
  assert.ok(paths.includes("dist/index.js"));
  assert.ok(paths.includes("registry/instructions/AGENTS.template.md"));
  assert.ok(paths.includes("profiles/balanced.yaml"));
  assert.ok(paths.includes("schemas/aesop.schema.json"));
  assert.ok(paths.some((p) => p.startsWith("registry/skills/verify-loop/")));
  assert.ok(!paths.some((p) => p.startsWith("fixtures/")), "fixtures must not ship");
  assert.ok(!paths.some((p) => p.startsWith("src/")), "source must not ship");
  assert.ok(!paths.some((p) => p.includes(".test.")), "test files must not ship");
  assert.ok(!paths.some((p) => p.endsWith(".js.map")), "source maps must not ship");
});
