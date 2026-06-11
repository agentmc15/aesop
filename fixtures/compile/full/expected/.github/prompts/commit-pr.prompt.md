---
name: commit-pr
description: Commit verified work, push, and open a PR. The most-used inner-loop command.
---

1. Review the working tree (`git status`, `git diff`). Stage only changes that trace to the task;
   nothing unrelated.
2. Run the project's test and lint commands (from `aesop.yaml` → `project.commands`). Stop and
   report if either fails — never commit unverified work.
3. Commit: one message stating what changed and why, present tense, no filler.
4. Push the current branch and open a PR (`gh pr create`) with a summary and a test plan.
   Never push to the default branch directly.
