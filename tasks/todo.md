# Slice 3: Windows support — issue #4 (2026-07-12)

Goal line (from #4): all 63 tests green on windows-latest node 20+22, continue-on-error
removed so Windows gates merges. Verify loop = CI (no local Windows box).

## Product fixes
- [x] federation.ts registryName(): split on / AND \ so `path:C:\…\ecc` → 'ecc'
- [x] manifest.ts F6 short-name collision rule: same cross-separator split
- [x] doctor.ts test-command probe: shell:true (sh -c / cmd.exe — manifest owner's own
      command, F3 posture unchanged)
- [x] doctor.ts binary probe: `where <bin>` via execFile on win32 (argv-only, no shell)

## Test-portability fixes
- [x] compile.test.ts walk(): normalize \ → / before golden comparison
- [x] security.test.ts F1: resolve()-based expectation instead of hardcoded POSIX string
- [x] security.test.ts F1b/F3b/F4: single-quoted YAML scalars for interpolated temp
      paths (double-quoted style treats \U as an escape → BAD_DQ_ESCAPE on Windows)
- [x] ship.test.ts: npm pack via shell:true on win32 (npm.cmd resolution)

## CI
- [x] remove continue-on-error from windows legs (they gate now)
- [x] doctor step runs on all OSes (probes are platform-aware)
- [ ] PR CI green on all 6 legs — THE goal line; iterate here if windows disagrees

## Wrap-up
- [x] local: 63/63, lint clean, self compile --check clean, doctor healthy
- [x] CHANGELOG Fixed entry
- [ ] merge; close #4
