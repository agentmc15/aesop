# Ralph loop (portable)

The **portable** loop, for harnesses without a native `/goal` (Cursor, Copilot, VS Code) — or any
time you want a tool-agnostic loop you control. It's the productionized descendant of the original
`ralph` bash one-liner: a fixed prompt re-fed every tick, with the key discipline being the
**context reset** (reset to anchor files each tick instead of growing the conversation).

## Files
- `prompt.md` — the fixed anchor prompt re-fed each tick. The runner injects the goal + a short
  state summary.
- `ralph_loop.py` — wraps the engine in `../../harness/python/agent_harness.py` with the three hard
  stops (loaded from a profile), a real-run path that shells out to your harness CLI per tick, and a
  `--demo` mock.

## Run

```bash
# Mock (no model/network):
python ralph_loop.py --demo

# Real (adapt the harness command to your tool):
python ralph_loop.py \
  --intent "fix the failing CI tests" \
  --profile ../../profiles/token-lean.yaml \
  --verify-cmd "pytest -q" \
  --harness-cmd "claude -p"        # or "codex exec" | "copilot -p" | a cursor agent command
```

## Why this shape
ralph assumed your terminal stayed open; this assumes it doesn't — state lives in `state.json` so a
crash/restart resumes. `self_verify()` (the `--verify-cmd`) is load-bearing: a loop that writes code
with no feedback is a machine for confident mistakes. And the cost of a coding agent has moved from
the model to **the loop running it**, which is why every guardrail here is a halt condition.
