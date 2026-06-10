/**
 * Aesop core interfaces — LOCKED AT PHASE 0.
 * Changing these after Phase 1 is a breaking change; flag it and stop for approval.
 *
 * Design rules (docs/02-architecture.md):
 *  - Emitters are pure: (manifest, primitives, profile) → files. All I/O lives in the CLI shell.
 *  - Capability fallbacks are explicit, never silent.
 */

export type HarnessId =
  | "claude-code"
  | "codex"
  | "copilot"
  | "cursor"
  | "antigravity"
  | "vscode";

export type PrimitiveType =
  | "instructions"
  | "skill"
  | "agent"
  | "command"
  | "mcp"
  | "hook"
  | "permissions"
  | "loop"
  | "state";

/** Mirrors schemas/aesop.schema.json. Generated types replace this hand model in Phase 1. */
export interface Manifest {
  version: 1;
  project: {
    name: string;
    stack?: string[];
    commands: { build?: string; test: string; lint?: string; [k: string]: string | undefined };
    monorepo?: { packages: string[] };
    invariants?: string[];
    models?: { primary?: ModelRef; judge?: ModelRef };
    review_bandwidth?: number;
  };
  harnesses: HarnessId[];
  pathway: { profile: string; overrides?: Record<string, unknown> };
  registries?: string[];
  primitives: {
    instructions?: {
      template?: string;
      blocks?: InstructionBlock[];
      global?: string[];
    };
    skills?: PrimitiveRef[];
    agents?: AgentRef[];
    commands?: PrimitiveRef[];
    mcp?: McpServer[];
    hooks?: PrimitiveRef[];
    permissions?: Permissions;
    loops?: GoalRecipe[];
  };
  state?: { dir?: string };
}

export interface ModelRef { family: string; tier?: "strong" | "mid" | "cheap"; pin?: string }
export type PrimitiveRef = string | { name: string; from?: string };
export type AgentRef =
  | string
  | { name: string; from?: string; model?: "strong" | "mid" | "cheap"; effort?: Effort; tools?: string[] };
export type Effort = "xhigh" | "high" | "medium" | "fast";

export interface InstructionBlock {
  scope: "global" | "project" | `path:${string}`;
  content: string;
}

export interface McpServer {
  name: string;
  transport: "stdio" | "http";
  command?: string;
  url?: string;
  /** Env var NAMES only — values never enter the manifest or emitted files. */
  env?: string[];
  scopes?: string[];
  trust?: "read" | "write" | "irreversible";
}

export interface Permissions {
  mutate_allow?: string[];
  irreversible?: string[];
  unattended?: "devcontainer" | "none";
}

/** The three hard stops are required, not optional — schema rejects a recipe without them. */
export interface GoalRecipe {
  name: string;
  goal: string;
  verify: string;
  plan_gate?: boolean;
  autonomy?: "high" | "plan-gated" | "supervised";
  stops: { max_iterations: number; no_progress_after: number; budget_usd: number };
}

/** A pathway profile (profiles/*.yaml), applied at compile time AND read by loops at run time. */
export interface Profile {
  name: string;
  reasoning_effort: Effort;
  model_tier: "strong" | "mid" | "cheap";
  verify_subagent: boolean;
  reviewer_subagent: boolean;
  llm_judge: boolean;
  multi_agent: "yes" | "when-needed" | "no";
  compaction: "summarize" | "truncate";
  stops: { max_iterations: number; no_progress_after: number; budget_usd: number };
}

/** A primitive resolved from a registry, normalized to canonical form and SHA-pinned. */
export interface ResolvedPrimitive {
  type: PrimitiveType;
  name: string;
  registry: string;
  sha: string;
  /** Canonical content: SKILL.md folder map, agent YAML, prompt file, hook spec, etc. */
  files: Record<string, string>;
}

export interface CompileContext {
  manifest: Manifest;
  profile: Profile;
  primitives: ResolvedPrimitive[];
  /** Repo root; emitters use it for relative paths only — never for I/O. */
  root: string;
}

export interface EmittedFile {
  /** Path relative to repo root (or "~"-prefixed for user-level global files). */
  path: string;
  content: string;
  /** Fenced files get drift tracking; sidecar-hashed files (json/toml) are tracked via lockfile. */
  fence: "inline" | "sidecar" | "none";
}

/** What a harness supports natively vs what this emitter falls back to. Drives matrix tests. */
export interface CapabilityMatrix {
  native: PrimitiveType[];
  fallback: Partial<Record<PrimitiveType, string>>; // primitive → description of the fallback
  goalMode: "native" | "ralph" | "scheduled";
}

export interface Emitter {
  harness: HarnessId;
  /** Pure render. No filesystem, no network, no clock. */
  emit(ctx: CompileContext): EmittedFile[];
  /** init-time adoption of hand-written config found in an existing repo. */
  importExisting(rootFiles: Record<string, string>): Partial<Manifest>;
  capabilities(): CapabilityMatrix;
}
