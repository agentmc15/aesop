/** `aesop mcp serve` — the CLI surface as an MCP server (stdio, newline-delimited JSON-RPC).
 *  Hand-rolled on purpose: the protocol subset we need (initialize / tools/list / tools/call)
 *  is ~100 lines, and the no-runtime-deps rule beats pulling in an SDK. Agents are first-class
 *  callers: the agent that hits a missing skill installs it without leaving its loop. */
import { createInterface } from "node:readline";
import { runAdd, runList } from "./add.js";
import { runCompile } from "./compile.js";
import { runDoctor } from "./doctor.js";
import { goalList, goalRun } from "./goal.js";
import { runLessons } from "./lessons.js";
import { runSync } from "./sync.js";
import { AesopError } from "../manifest.js";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number | string;
  method: string;
  params?: Record<string, unknown>;
}

const cwdProp = { cwd: { type: "string", description: "project root (defaults to the server's cwd)" } };
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties,
  ...(required.length ? { required } : {}),
});

export const TOOLS = [
  { name: "compile", description: "Compile aesop.yaml into native files for every selected harness. check=true reports drift without writing.", inputSchema: obj({ ...cwdProp, check: { type: "boolean" }, pathway: { type: "string" } }) },
  { name: "sync", description: "Diff managed files against the manifest; accept=true regenerates, writeBack=true lifts in-fence instruction edits into aesop.yaml.", inputSchema: obj({ ...cwdProp, accept: { type: "boolean" }, writeBack: { type: "boolean" } }) },
  { name: "doctor", description: "Audit the environment (verify loop, MCP health, stops, secrets, permissions, state dir, judge family). fix=true creates the notes dir.", inputSchema: obj({ ...cwdProp, fix: { type: "boolean" } }) },
  { name: "add", description: "Add a primitive (skill|agent|command|instructions) from a declared registry and recompile.", inputSchema: obj({ ...cwdProp, type: { type: "string" }, name: { type: "string" }, from: { type: "string" } }, ["type", "name"]) },
  { name: "list", description: "List installed primitives; available=true browses every declared registry.", inputSchema: obj({ ...cwdProp, type: { type: "string" }, available: { type: "boolean" } }) },
  { name: "lessons", description: "Record a mistake→rule lesson; promote=true also lifts it into the instruction files everywhere.", inputSchema: obj({ ...cwdProp, text: { type: "string" }, promote: { type: "boolean" } }, ["text"]) },
  { name: "goal_list", description: "List goal recipes (goal, verify command, hard stops).", inputSchema: obj({ ...cwdProp }) },
  // Note: no `agent` parameter — an MCP caller (which may be a prompt-injected agent) must not be
  // able to choose the shell command Aesop runs. goal_run only executes the recipe's vetted,
  // compiled agent_command (F2).
  { name: "goal_run", description: "Run a goal recipe via the portable Ralph loop until verified or a hard stop triggers.", inputSchema: obj({ ...cwdProp, name: { type: "string" } }, ["name"]) },
] as const;

async function dispatch(name: string, args: Record<string, unknown>): Promise<unknown> {
  const cwd = (args.cwd as string) ?? process.cwd();
  switch (name) {
    case "compile":
      return runCompile({ cwd, ...(args.check ? { check: true } : {}), ...(args.pathway ? { pathway: args.pathway as string } : {}) });
    case "sync":
      return runSync({ cwd, ...(args.accept ? { accept: true } : {}), ...(args.writeBack ? { writeBack: true } : {}) });
    case "doctor":
      return runDoctor({ cwd, ...(args.fix ? { fix: true } : {}) });
    case "add":
      return runAdd({ cwd, type: args.type as string, name: args.name as string, ...(args.from ? { from: args.from as string } : {}) });
    case "list":
      return runList({ cwd, ...(args.type ? { type: args.type as string } : {}), ...(args.available ? { available: true } : {}) });
    case "lessons":
      return runLessons({ cwd, text: args.text as string, ...(args.promote ? { promote: true } : {}) });
    case "goal_list":
      return goalList(cwd);
    case "goal_run":
      return goalRun({ cwd, name: args.name as string }); // agent command is fixed by the recipe, not the caller (F2)
    default:
      throw new AesopError(1, `unknown tool '${name}'`);
  }
}

/** Serves until stdin closes (the MCP client owns the lifecycle). */
export function serveMcp(version: string): Promise<void> {
  const send = (msg: Record<string, unknown>): void => {
    process.stdout.write(JSON.stringify(msg) + "\n");
  };
  const rl = createInterface({ input: process.stdin });
  const done = new Promise<void>((resolve) => rl.on("close", resolve));
  rl.on("line", (line) => {
    if (!line.trim()) return;
    let req: JsonRpcRequest;
    try {
      req = JSON.parse(line) as JsonRpcRequest;
    } catch {
      return; // not JSON-RPC — ignore
    }
    void handle(req);
  });

  async function handle(req: JsonRpcRequest): Promise<void> {
    if (req.id === undefined) return; // notification (e.g. notifications/initialized)
    const reply = (result: unknown) => send({ jsonrpc: "2.0", id: req.id, result });
    switch (req.method) {
      case "initialize":
        reply({
          protocolVersion: (req.params?.protocolVersion as string) ?? "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "aesop", version },
        });
        return;
      case "tools/list":
        reply({ tools: TOOLS });
        return;
      case "tools/call": {
        const name = req.params?.name as string;
        const args = (req.params?.arguments as Record<string, unknown>) ?? {};
        try {
          const result = await dispatch(name, args);
          reply({ content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
        } catch (e) {
          reply({ content: [{ type: "text", text: (e as Error).message }], isError: true });
        }
        return;
      }
      case "ping":
        reply({});
        return;
      default:
        send({ jsonrpc: "2.0", id: req.id, error: { code: -32601, message: `method not found: ${req.method}` } });
    }
  }

  return done;
}
