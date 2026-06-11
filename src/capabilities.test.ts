/** GOAL LINE (Phase 3): capabilities() matches docs/03-harness-matrix.md cell-for-cell.
 *  The MATRIX constant below mirrors the doc's "Capabilities summary" table — change both or fail. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { antigravityEmitter } from "./emitters/antigravity.js";
import { claudeCodeEmitter } from "./emitters/claude-code.js";
import { codexEmitter } from "./emitters/codex.js";
import { copilotEmitter } from "./emitters/copilot.js";
import { cursorEmitter } from "./emitters/cursor.js";
import { vscodeEmitter } from "./emitters/vscode.js";
import type { Emitter, PrimitiveType } from "./types.js";

const MATRIX: Record<string, { native: PrimitiveType[]; fallback: PrimitiveType[]; goalMode: string }> = {
  "claude-code": {
    native: ["instructions", "skill", "agent", "command", "mcp", "hook", "permissions", "loop", "state"],
    fallback: [],
    goalMode: "native",
  },
  codex: {
    native: ["instructions", "skill", "agent", "command", "mcp", "permissions", "loop", "state"],
    fallback: ["hook"],
    goalMode: "native",
  },
  copilot: {
    native: ["instructions", "skill", "agent", "command", "mcp", "state"],
    fallback: ["hook", "permissions", "loop"],
    goalMode: "ralph",
  },
  cursor: {
    native: ["instructions", "mcp", "state"],
    fallback: ["skill", "agent", "command", "hook", "permissions", "loop"],
    goalMode: "ralph",
  },
  antigravity: {
    native: ["instructions", "state", "loop"],
    fallback: ["skill", "agent", "command", "mcp", "hook", "permissions"],
    goalMode: "scheduled",
  },
  vscode: {
    native: ["mcp", "state"],
    fallback: ["instructions", "skill", "agent", "command", "hook", "permissions", "loop"],
    goalMode: "ralph",
  },
};

const EMITTERS: Emitter[] = [
  claudeCodeEmitter,
  codexEmitter,
  copilotEmitter,
  cursorEmitter,
  antigravityEmitter,
  vscodeEmitter,
];

test("GOAL LINE: every emitter's capabilities() matches the harness matrix doc", () => {
  for (const emitter of EMITTERS) {
    const expected = MATRIX[emitter.harness];
    assert.ok(expected, `${emitter.harness}: missing from MATRIX/doc table`);
    const caps = emitter.capabilities();
    assert.deepEqual([...caps.native].sort(), [...expected.native].sort(), `${emitter.harness}: native set`);
    assert.deepEqual(
      Object.keys(caps.fallback).sort(),
      [...expected.fallback].sort(),
      `${emitter.harness}: fallback set`
    );
    assert.equal(caps.goalMode, expected.goalMode, `${emitter.harness}: goalMode`);
    for (const [prim, why] of Object.entries(caps.fallback)) {
      assert.ok(why && why.length > 10, `${emitter.harness}: fallback '${prim}' needs a real explanation`);
    }
    const overlap = caps.native.filter((n) => n in caps.fallback);
    assert.deepEqual(overlap, [], `${emitter.harness}: primitives both native and fallback`);
  }
  assert.equal(EMITTERS.length, Object.keys(MATRIX).length, "matrix table and emitter list out of sync");
});
