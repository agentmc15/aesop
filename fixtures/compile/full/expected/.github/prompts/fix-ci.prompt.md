---
name: fix-ci
description: Diagnose and fix the failing CI run for the current branch, end to end.
---

1. Fetch the latest CI status and logs for this branch (`gh run list`, `gh run view --log-failed`).
2. Reproduce the failure locally with the project's test command before changing anything.
3. Find the root cause — no band-aid fixes, no skipped tests, no loosened assertions.
4. Fix, run the full verify loop locally (test + lint + build), then commit and push.
5. Confirm the new CI run is green before declaring done. "Done" is a claim; green CI is the proof.
