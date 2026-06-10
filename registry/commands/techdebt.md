---
name: techdebt
description: Sweep the area you just touched for small, safe cleanups — scoped, never speculative.
---

1. Limit scope to files changed in the current branch (`git diff --name-only main...`).
2. Look only for: dead code your changes orphaned, duplicated logic introduced by the change,
   TODOs you can now resolve, and tests that no longer assert anything real.
3. Do NOT refactor working code that the task didn't touch, add abstractions, or "improve" style.
4. Each cleanup is its own small commit with the verify loop run after it.
5. Anything bigger than 20 lines: write it to `tasks/todo.md` as a proposal instead of doing it.
