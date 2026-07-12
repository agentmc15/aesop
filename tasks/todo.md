# Ship the three documented-but-unshipped features (2026-07-12)

From tasks/improvement-recommendations.md §3 — each was promised in docs as "future work".
No changes to the locked src/types.ts or schemas/aesop.schema.json.

## 1. `aesop profile new <name> --from <base>`  (docs/06-cli-spec.md:166)
- [ ] profile.ts: createProfile() — validate name (F7 regex), textual copy of base profile
      (preserves comments), rewrite the `profile:` line, refuse overwrite, write to
      .aesop/profiles/<name>.yaml → verify: profile.test.ts (create, list, load, overwrite
      refusal, traversal rejection, unknown base)
- [ ] profile.ts: readProfileSource() so `profile show` resolves custom profiles too
- [ ] index.ts dispatch + usage; docs/06-cli-spec.md → verify: manual CLI run

## 2. `aesop init --refresh [--write]`  (docs/07-manifest-schema.md:77)
- [ ] init.ts: runRefresh() — loadManifest + detect(), diff detected-only fields
      (stack, commands.test/build/lint, monorepo); never touch interviewed fields
      (invariants, models, review_bandwidth, harnesses, pathway); detection absence is not
      evidence of removal (report only when a detected value exists and differs)
- [ ] --write applies + validates + serializeManifest (same pattern as sync --write-back)
- [ ] index.ts: exit 3 on unapplied drift (mirrors compile --check / sync)
      → verify: init.test.ts (drift detected, --write applies, interviewed fields intact,
      clean repo → no drift)
- [ ] docs/06 + docs/07 notes updated

## 3. Antigravity native skills  (docs/03-harness-matrix.md:33)
- [ ] Pin verified location in docs/03 FIRST (doc, then code): workspace
      `.agents/skills/<name>/SKILL.md`; legacy `.agent/skills/` still read; global
      `~/.gemini/config/skills/` (sources: Google codelab, atamel.dev 2026-07-01,
      antigravity.google/docs/skills)
- [ ] antigravity.ts: emit skills to .agents/skills/; capabilities(): skill → native
- [ ] capabilities.test.ts MATRIX row updated (cell-for-cell with doc)
- [ ] regenerate fixtures/compile/full/expected deliberately; read the diff
      → verify: compile golden test green
- [ ] recompile self (dogfood) so CI compile --check stays green

## Wrap-up
- [ ] CHANGELOG Unreleased section
- [ ] npm test + lint + self compile --check + doctor all green

---

# Archive: security remediation ✅ (2026-06-11) — see docs/security/audit-2026-06-10.md;
# all 8 findings fixed + pinned by src/security.test.ts (details in git history of this file).
