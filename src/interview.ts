/** The init interview — only what detection can't know. `--yes` or non-TTY → defaults. */
import * as readline from "node:readline/promises";
import type { Detection } from "./detect.js";
import type { HarnessId, ModelRef } from "./types.js";

export interface InitOptions {
  cwd: string;
  yes?: boolean;
  force?: boolean;
  json?: boolean;
  harness?: string; // csv override
  pathway?: string;
}

export interface Answers {
  harnesses: HarnessId[];
  pathway: string;
  invariants: string[];
  models?: { primary: ModelRef; judge: ModelRef };
  review_bandwidth: number;
  testCommand?: string;
}

const ALL_HARNESSES: HarnessId[] = ["claude-code", "codex", "copilot", "cursor", "antigravity", "vscode"];
const PATHWAYS = ["token-lean", "balanced", "accuracy-max"];

export function defaults(detection: Detection, opts: InitOptions): Answers {
  const fromFlag = opts.harness
    ?.split(",")
    .map((h) => h.trim())
    .filter((h): h is HarnessId => (ALL_HARNESSES as string[]).includes(h));
  return {
    // Inferred from existing agent files; else the two Phase-2 emitters with native /goal.
    harnesses: fromFlag?.length ? fromFlag : detection.harnesses.length ? detection.harnesses : ["claude-code", "codex"],
    // token-lean is the documented starting point: turn the dial up only where accuracy pays.
    pathway: opts.pathway ?? "token-lean",
    invariants: [],
    review_bandwidth: 2,
  };
}

export async function interview(detection: Detection, opts: InitOptions): Promise<Answers> {
  const base = defaults(detection, opts);
  if (opts.yes || !process.stdin.isTTY) return base;

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (q: string, def: string): Promise<string> =>
    (await rl.question(`${q} [${def}]: `)).trim() || def;

  try {
    const harnesses = (await ask(`Harnesses (${ALL_HARNESSES.join(", ")})`, base.harnesses.join(",")))
      .split(",")
      .map((h) => h.trim())
      .filter((h): h is HarnessId => (ALL_HARNESSES as string[]).includes(h));

    const pathway = await ask(`Pathway (${PATHWAYS.join(" | ")})`, base.pathway);

    let testCommand: string | undefined;
    if (!detection.commands.test) {
      testCommand = await ask("Test command (the verify loop — load-bearing)", "");
    }

    console.log("Domain invariants — the rules an agent would guess wrong (empty line to finish):");
    const invariants: string[] = [];
    for (;;) {
      const line = (await rl.question("  - ")).trim();
      if (!line) break;
      invariants.push(line);
    }

    const primaryFamily = await ask("Primary model family (claude, openai, gemini, …; empty to skip)", "");
    let models: Answers["models"];
    if (primaryFamily) {
      let judgeFamily = await ask("Judge model family (MUST differ from primary)", primaryFamily === "claude" ? "openai" : "claude");
      while (judgeFamily === primaryFamily) {
        judgeFamily = await ask("Judge family must differ from primary — pick another", "");
      }
      models = { primary: { family: primaryFamily, tier: "strong" }, judge: { family: judgeFamily, tier: "strong" } };
    }

    const review_bandwidth = Number.parseInt(
      await ask("Review bandwidth — parallel agents you will actually review", String(base.review_bandwidth)),
      10
    );

    return {
      harnesses: harnesses.length ? harnesses : base.harnesses,
      pathway,
      invariants,
      ...(models ? { models } : {}),
      review_bandwidth: Number.isFinite(review_bandwidth) && review_bandwidth >= 1 ? review_bandwidth : base.review_bandwidth,
      ...(testCommand ? { testCommand } : {}),
    };
  } finally {
    rl.close();
  }
}
