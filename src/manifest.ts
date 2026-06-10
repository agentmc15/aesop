/** Manifest load / validate / serialize. The schema is the contract; this module enforces it. */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { parse, stringify } from "yaml";
import type { Manifest } from "./types.js";

const require = createRequire(import.meta.url);
// ajv ships CJS; createRequire sidesteps the ESM/CJS default-export interop mess.
const Ajv2020 = require("ajv/dist/2020.js");

const SCHEMA_URL = new URL("../schemas/aesop.schema.json", import.meta.url);

let compiled: ((data: unknown) => boolean) & { errors?: { instancePath: string; message?: string }[] | null };

function validator() {
  if (!compiled) {
    const schema = JSON.parse(readFileSync(SCHEMA_URL, "utf8"));
    const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true });
    compiled = ajv.compile(schema);
  }
  return compiled;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateManifest(data: unknown): ValidationResult {
  const validate = validator();
  const errors: string[] = [];
  if (!validate(data)) {
    for (const e of validate.errors ?? []) {
      errors.push(`${e.instancePath || "/"} ${e.message ?? "invalid"}`);
    }
  }
  // Cross-field rules JSON Schema can't express:
  const m = data as Manifest;
  const primary = m?.project?.models?.primary?.family;
  const judge = m?.project?.models?.judge?.family;
  if (primary && judge && primary === judge) {
    errors.push("/project/models judge.family must differ from primary.family (the maker must not grade its own work)");
  }
  return { valid: errors.length === 0, errors };
}

export function serializeManifest(manifest: Manifest, generatedNote: string): string {
  const header = `# aesop.yaml — single source of truth for this project's agentic environment.\n# ${generatedNote}\n# Everything under .claude/ .github/ .cursor/ .codex/ AGENTS.md GEMINI.md is compiled output.\n# Edit this file, then run: aesop compile\n`;
  return header + stringify(manifest, { lineWidth: 100 });
}

export function parseManifest(yamlText: string): Manifest {
  const data = parse(yamlText) as Manifest;
  const { valid, errors } = validateManifest(data);
  if (!valid) {
    throw new AesopError(2, `invalid aesop.yaml:\n  - ${errors.join("\n  - ")}`);
  }
  return data;
}

/** Typed error: commands throw, only the CLI shell calls process.exit. */
export class AesopError extends Error {
  constructor(public exitCode: number, message: string) {
    super(message);
    this.name = "AesopError";
  }
}
