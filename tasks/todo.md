# Security remediation ✅ (2026-06-11)

Full audit: docs/security/audit-2026-06-10.md. All 8 findings fixed + pinned by tests.

## Shipped
- [x] src/safety.ts — isSafeName / assertSafeName / safeNameOr / assertWithinRepo
- [x] F1 path-traversal write: safeNameOr in parseAgent + federation normalizeAgent;
      assertSafeName on add-time names; assertWithinRepo backstop on every emitted path
      (computeOutputs); schema name patterns on primitiveRef/agentRef/goalRecipe
- [x] F2 MCP RCE: removed `agent` param from the goal_run tool
- [x] F3 doctor: command -v passes bin as $1 (no shell interpolation); added `doctor --no-exec`
- [x] F4 frontmatter injection: yaml.stringify({lineWidth:0}) for claude-code + copilot
- [x] F5 unvalidated loads: single loadManifest() (validates) used by add/goal/update
- [x] F6 git hygiene: clone with `--`; cache origin verified before pull; dup registry
      short-names rejected in validateManifest
- [x] F7 profile traversal: name validation in profile.ts + `aesop profile show`
- [x] F8 env passthrough: documented at the exec site (mitigated by F2)
- [x] 10 regression tests (src/security.test.ts); 54 total green; lint clean
- [x] dogfood: self compile --check clean, doctor green (incl. --no-exec)
- [x] only output change across all goldens: applyTo now library-serialized (1 line)

## Note
- Schema gained name `pattern`s — security-motivated tightening of the locked v1 schema; all
  real/seed/fixture names already conform (lowercase-kebab).
