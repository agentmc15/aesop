# Troubleshooting & FAQ

## Exit codes (memorize these three)

| Code | Meaning | Typical source |
|---|---|---|
| `1` | error — bad usage, missing file, failed fetch | `no aesop.yaml in … — run aesop init first` |
| `2` | validation — the manifest or a locked schema rejected something | invalid `aesop.yaml`, stop-less goal recipe |
| `3` | findings — nothing crashed, but look | `compile --check` drift, `doctor` findings, `sync` drift, a halted `goal run` |

CI tip: treat `3` as failure, but route it to the environment owner, not the feature author.

## Common errors, decoded

**`invalid aesop.yaml: /primitives/loops/0 must have required property 'stops'`**
Every goal recipe needs all three hard stops — this is deliberate, not a default Aesop will fill
in. Add `stops: { max_iterations, no_progress_after, budget_usd }`.

**`judge.family must differ from primary.family`**
The maker must not grade its own work. Pick a judge from another model family (or drop the
`models` block until you need evals).

**`aesop.yaml already exists … (use --force …)`**
`init` won't clobber a manifest. Edit it directly, or `--force` to regenerate (your instruction
blocks will be re-imported from files, not preserved from the old manifest — prefer editing).

**`skill 'x' from registry 'y' is not vendored — run aesop add skill x --from y`**
A manifest references foreign content that was never `add`ed (hand-edited manifest, or
`.aesop/vendor/` not committed). Run the suggested command, and commit `.aesop/vendor/`.

**`registry 'z' is not declared in aesop.yaml`**
`--from` only searches declared sources. Add it under `registries:` first. The short name is the
last path segment (`github:affaan-m/ecc` → `ecc`).

**`emitter collision on <path>`**
Two harnesses produced different content for one path — that's a bug worth reporting, not a
merge to resolve. Workaround: compile the harnesses separately with `--harness` and diff.

**`registry 'x': fetch failed`**
Network/auth to the upstream repo. GitHub sources clone over HTTPS; private repos need your git
credential helper working. Compiles never need the network — only `add`/`update`/`list
--available` fetch.

**`doctor` says `verify-loop: test command failed` but tests pass in my shell**
Doctor runs the command via `sh -c` from the repo root with a 120 s timeout. Usual causes: the
command needs your shell profile (use a path-explicit command), or it's slower than 120 s
(point `commands.test` at a fast smoke suite and keep the full run in CI).

**`goal run` halts `no-progress` while the agent is clearly working**
The detector hashes the *verify command's output* — if your verify prints nothing, every failing
tick looks identical. Make verify print a progress signal (test counts, error counts). See
[Goals & loops](goals-and-loops.md#the-three-hard-stops).

**My hand edits keep disappearing on compile**
You're editing *inside* the fence. Three correct moves: edit `aesop.yaml` and recompile; or make
the edit in place and run `aesop sync --write-back` (lifts it into the manifest); or write below
the `<!-- aesop:end -->` line — that space is never touched.

**`sync` reports a file as `orphaned`**
The lockfile tracks a file the manifest no longer produces (you removed a primitive). Delete the
file, or re-add the primitive. (`aesop remove` deletes orphans automatically; hand-edits to the
manifest don't.)

## FAQ

**Do my teammates need Aesop installed?**
No. Emitted files are plain native config. They need Aesop only to *change* the environment —
and even then, `sync --write-back` can lift their in-fence edits after the fact.

**Does Aesop phone home / need the network?**
No telemetry, ever. Network is used only by `add`/`update`/`list --available` (git fetch of
declared registries) and whatever your agent CLI does in `goal run`. Compiles are fully offline
(vendored content).

**Can I use only part of it?**
Yes — every primitive list can be empty. A manifest with just `project` + instructions is a
legitimate "keep my six instruction files in sync" tool. Grow into the rest.

**Which files do I commit?**
Everything except what `.gitignore` already excludes (`.aesop/cache/`, `.aesop/bundle/`).
Emitted files, `.aesop/lock.json`, and `.aesop/vendor/` are all part of the repo — that's what
makes drift detectable and compiles offline.

**How do I uninstall?**
`aesop eject --force` — fences stripped (content stays), manifest and `.aesop/` removed. You're
left with exactly the native files you'd have written by hand.

**Something else is wrong.**
`aesop doctor --json` and `aesop sync --json` give you (or your agent) the structured state.
File issues at <https://github.com/agentmc15/aesop/issues> with the JSON attached — secrets are
never in it by design, but skim before posting.
