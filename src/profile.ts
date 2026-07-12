/** Pathway profiles: load the YAML calibrations, apply them to a manifest at compile time. */
import { readFileSync, existsSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { AesopError } from "./manifest.js";
import type { AgentRef, Effort, Manifest, Profile } from "./types.js";

const PACKAGE_PROFILES = fileURLToPath(new URL("../profiles", import.meta.url));

/** The on-disk YAML shape (inherited from the agentic-harness-kit; richer than the locked Profile). */
interface ProfileYaml {
  profile: string;
  reasoning?: { effort?: string; model_tier?: string };
  verification?: { verify_subagent?: boolean; reviewer_subagent?: boolean; llm_judge?: boolean };
  orchestration?: { multi_agent?: boolean | string };
  context?: { compaction?: string };
  guardrails?: { max_iterations?: number; no_progress_stop?: number; budget_usd?: number };
}

function profilePath(name: string, projectRoot: string): string {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    throw new AesopError(2, `invalid profile name '${name}' — use lowercase letters, digits, and hyphens (F7)`);
  }
  const custom = join(projectRoot, ".aesop", "profiles", `${name}.yaml`);
  if (existsSync(custom)) return custom;
  const builtin = join(PACKAGE_PROFILES, `${name}.yaml`);
  if (existsSync(builtin)) return builtin;
  throw new AesopError(2, `unknown pathway profile '${name}' (looked in ${custom} and aesop's profiles/)`);
}

export function listProfiles(projectRoot: string): { name: string; source: "builtin" | "custom" }[] {
  const out: { name: string; source: "builtin" | "custom" }[] = [];
  for (const f of readdirSync(PACKAGE_PROFILES)) {
    if (f.endsWith(".yaml")) out.push({ name: f.replace(/\.yaml$/, ""), source: "builtin" });
  }
  const customDir = join(projectRoot, ".aesop", "profiles");
  if (existsSync(customDir)) {
    for (const f of readdirSync(customDir)) {
      if (f.endsWith(".yaml")) out.push({ name: f.replace(/\.yaml$/, ""), source: "custom" });
    }
  }
  return out;
}

/** Raw YAML text of a profile (custom wins over builtin) — for `aesop profile show`. */
export function readProfileSource(name: string, projectRoot: string): string {
  return readFileSync(profilePath(name, projectRoot), "utf8");
}

/** `aesop profile new <name> --from <base>`: fork a calibration into .aesop/profiles/<name>.yaml.
 *  Textual copy so the base profile's comments survive; only the `profile:` line is rewritten. */
export function createProfile(name: string, from: string, projectRoot: string): string {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    throw new AesopError(2, `invalid profile name '${name}' — use lowercase letters, digits, and hyphens (F7)`);
  }
  const target = join(projectRoot, ".aesop", "profiles", `${name}.yaml`);
  if (existsSync(target)) {
    throw new AesopError(1, `profile '${name}' already exists at ${target} — edit it, or pick another name`);
  }
  const source = readFileSync(profilePath(from, projectRoot), "utf8");
  const body = /^profile:.*$/m.test(source)
    ? source.replace(/^profile:.*$/m, `profile: ${name}`)
    : `profile: ${name}\n${source}`;
  const header = `# ${name} — forked from '${from}' by \`aesop profile new\`. Tune, then reference it\n# from aesop.yaml (pathway.profile: ${name}) and run: aesop compile\n`;
  mkdirSync(join(projectRoot, ".aesop", "profiles"), { recursive: true });
  writeFileSync(target, header + body, "utf8");
  return target;
}

export function loadProfile(name: string, projectRoot: string, overrides?: Record<string, unknown>): Profile {
  const raw = parse(readFileSync(profilePath(name, projectRoot), "utf8")) as ProfileYaml;
  const effortMap: Record<string, Effort> = { low: "fast", fast: "fast", medium: "medium", high: "high", xhigh: "xhigh" };
  const ma = raw.orchestration?.multi_agent;
  const profile: Profile = {
    name: raw.profile ?? name,
    reasoning_effort: effortMap[raw.reasoning?.effort ?? "high"] ?? "high",
    model_tier: (raw.reasoning?.model_tier as Profile["model_tier"]) ?? "strong",
    verify_subagent: raw.verification?.verify_subagent ?? true,
    reviewer_subagent: raw.verification?.reviewer_subagent ?? false,
    llm_judge: raw.verification?.llm_judge ?? false,
    multi_agent: ma === true ? "yes" : ma === false ? "no" : "when-needed",
    compaction: raw.context?.compaction === "truncate" ? "truncate" : "summarize",
    stops: {
      max_iterations: raw.guardrails?.max_iterations ?? 40,
      no_progress_after: raw.guardrails?.no_progress_stop ?? 3,
      budget_usd: raw.guardrails?.budget_usd ?? 25,
    },
  };
  // Sparse overrides from manifest.pathway.overrides. Stops can be tuned, never removed.
  for (const [k, v] of Object.entries(overrides ?? {})) {
    if (k === "max_iterations" || k === "no_progress_after" || k === "budget_usd") {
      if (typeof v === "number" && v > 0) profile.stops[k] = v;
    } else if (k === "reasoning_effort" && typeof v === "string" && v in effortMap) {
      profile.reasoning_effort = effortMap[v]!;
    } else if (k in profile && k !== "stops" && k !== "name") {
      (profile as unknown as Record<string, unknown>)[k] = v;
    }
  }
  return profile;
}

const agentName = (ref: AgentRef): string => (typeof ref === "string" ? ref : ref.name);

/** Pathway pruning: which selected subagents actually get emitted at this setting. */
export function applyProfile(
  manifest: Manifest,
  profile: Profile
): { agents: AgentRef[]; notes: string[] } {
  const selected = manifest.primitives.agents ?? [];
  const notes: string[] = [];
  const agents = selected.filter((ref) => {
    const name = agentName(ref);
    if (!profile.verify_subagent && name === "verify-app") {
      notes.push(`pathway ${profile.name}: pruned subagent '${name}' (verify_subagent: off — inline self-check only)`);
      return false;
    }
    if (!profile.reviewer_subagent && ["critic", "spec-reviewer", "security-reviewer"].includes(name)) {
      notes.push(`pathway ${profile.name}: pruned subagent '${name}' (reviewer_subagent: off)`);
      return false;
    }
    return true;
  });
  return { agents, notes };
}
