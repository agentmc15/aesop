/** `aesop bundle` — package the compiled environment for distribution. Same contents, three
 *  wrappers: a Claude Code plugin (+marketplace), a Copilot-style plugin dir, or a plain tarball
 *  of every managed file. The skill is the authoring format; the plugin is how you ship it. */
import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { computeOutputs } from "./compile.js";
import { AesopError } from "../manifest.js";

const exec = promisify(execFile);

export type BundleFormat = "claude-plugin" | "copilot-plugin" | "tarball";

export interface BundleResult {
  format: BundleFormat;
  out: string;
  files: number;
  install: string;
}

/** Copy emitted files whose path starts with a prefix into the bundle under a new root. */
function pick(outputs: Map<string, { content: string }>, prefix: string, rebase: string): { rel: string; content: string }[] {
  return [...outputs.entries()]
    .filter(([path]) => path.startsWith(prefix))
    .map(([path, { content }]) => ({ rel: join(rebase, path.slice(prefix.length)), content }));
}

export async function runBundle(opts: { cwd: string; format?: BundleFormat }): Promise<BundleResult> {
  const format = opts.format ?? "claude-plugin";
  const computed = await computeOutputs({ cwd: opts.cwd });
  const name = computed.manifest.project.name;
  const bundleRoot = join(opts.cwd, ".aesop", "bundle", format);
  await rm(bundleRoot, { recursive: true, force: true });

  if (format === "tarball") {
    const paths = [...computed.outputs.keys()];
    await mkdir(bundleRoot, { recursive: true });
    const out = join(bundleRoot, `${name}-env.tgz`);
    await exec("tar", ["czf", out, "-C", opts.cwd, ...paths], { timeout: 60_000 });
    return { format, out, files: paths.length, install: `tar xzf ${name}-env.tgz -C /path/to/your/repo` };
  }

  let files: { rel: string; content: string }[];
  let install: string;
  if (format === "claude-plugin") {
    files = [
      {
        rel: join(name, ".claude-plugin", "plugin.json"),
        content: JSON.stringify({ name, description: `Agentic environment for ${name}, compiled by aesop.`, version: "0.1.0" }, null, 2) + "\n",
      },
      {
        rel: join(".claude-plugin", "marketplace.json"),
        content:
          JSON.stringify(
            {
              name: `${name}-marketplace`,
              metadata: { description: `Marketplace wrapping the ${name} environment plugin.` },
              plugins: [{ name, source: `./${name}`, description: `Agentic environment for ${name}.` }],
            },
            null,
            2
          ) + "\n",
      },
      ...pick(computed.outputs, ".claude/agents/", join(name, "agents")),
      ...pick(computed.outputs, ".claude/commands/", join(name, "commands")),
      ...pick(computed.outputs, ".claude/skills/", join(name, "skills")),
    ];
    install = `/plugin marketplace add <this-repo-or-path>  →  /plugin install ${name}@${name}-marketplace`;
    if (files.length <= 2) throw new AesopError(1, `nothing to bundle for ${format} — is 'claude-code' in harnesses and compiled?`);
  } else {
    files = [
      {
        rel: "README.md",
        content: `# ${name} — Copilot environment plugin\n\nCompiled by aesop. Copy these directories into your repo's .github/ (or wire this repo as a marketplace).\n`,
      },
      ...pick(computed.outputs, ".github/agents/", "agents"),
      ...pick(computed.outputs, ".github/prompts/", "prompts"),
      ...pick(computed.outputs, ".github/instructions/", "instructions"),
      ...pick(computed.outputs, ".github/skills/", "skills"),
    ];
    install = `copilot plugin install ${name}@<your-marketplace> (or copy the dirs into .github/)`;
    if (files.length <= 1) throw new AesopError(1, `nothing to bundle for ${format} — is 'copilot' in harnesses and compiled?`);
  }

  for (const f of files) {
    const abs = join(bundleRoot, f.rel);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, f.content, "utf8");
  }
  return { format, out: bundleRoot, files: files.length, install };
}

export function bundleSummary(result: BundleResult): string {
  return [`bundled ${result.files} file(s) → ${result.out}`, `install: ${result.install}`].join("\n");
}
