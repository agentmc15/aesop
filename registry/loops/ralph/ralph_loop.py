#!/usr/bin/env python3
"""
ralph_loop.py — the portable Ralph loop, for harnesses WITHOUT a native /goal (Cursor, Copilot,
VS Code) or any time you want a tool-agnostic loop.

It wraps the engine in ../../harness/python/agent_harness.py with:
  - a fixed anchor prompt (prompt.md), re-fed every tick (the context-reset discipline),
  - a real-run path that shells out to your harness CLI for each tick's action, and
  - the three hard stops, taken from the active profile.

Run the mock demo (no model, no network):
    python ralph_loop.py --demo

Wire a real loop (example — adapt the command to your harness):
    python ralph_loop.py \
        --intent "fix the failing CI tests" \
        --profile ../../profiles/token-lean.yaml \
        --verify-cmd "pytest -q" \
        --harness-cmd "claude -p"     # or: "codex exec" | "copilot -p" | "cursor-agent"
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys

# Import the engine from the sibling harness package.
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "harness", "python"))
from agent_harness import Guardrails, run_loop  # noqa: E402


def load_guardrails(profile_path: str | None) -> Guardrails:
    """Load the three stops from a profile YAML. Uses PyYAML if present, else a tiny fallback."""
    if not profile_path or not os.path.exists(profile_path):
        return Guardrails()
    try:
        import yaml  # type: ignore
        with open(profile_path) as f:
            return Guardrails.from_profile(yaml.safe_load(f) or {})
    except Exception:
        # Minimal fallback: scan for the three keys under a `guardrails:` block.
        vals: dict[str, float] = {}
        in_block = False
        for line in open(profile_path):
            s = line.rstrip()
            if s.strip().startswith("guardrails:"):
                in_block = True
                continue
            if in_block:
                if s and not s.startswith((" ", "\t")):
                    break  # left the block
                for key in ("max_iterations", "no_progress_stop", "budget_usd"):
                    if key in s and ":" in s:
                        try:
                            vals[key] = float(s.split(":", 1)[1].split("#")[0].strip())
                        except ValueError:
                            pass
        return Guardrails.from_profile({"guardrails": vals})


def read_prompt(goal: str, state_summary: str) -> str:
    tmpl = open(os.path.join(HERE, "prompt.md")).read()
    return tmpl.replace("{{goal}}", goal).replace("{{state_summary}}", state_summary)


def real_run(intent: str, harness_cmd: str, verify_cmd: str, g: Guardrails, state_path: str) -> None:
    """Drive a real harness CLI tick-by-tick. Each tick re-feeds the anchor prompt (context reset)."""
    def agent_decide(goal: str, state: dict):
        prompt = read_prompt(goal, _summarize(state))
        # Re-feed the anchor prompt to a fresh harness invocation. We treat the call as an action.
        proc = subprocess.run(harness_cmd.split() + [prompt], capture_output=True, text=True)
        state["last_output"] = proc.stdout[-2000:]
        # Cost is unknown from the CLI here; estimate or parse from your harness's output.
        return {"name": "harness_tick", "kind": "read"}, 0.0

    def execute(action: dict, state: dict) -> str:
        return state.get("last_output", "")

    def self_verify(state: dict) -> bool:
        if not verify_cmd:
            return True
        rc = subprocess.run(verify_cmd, shell=True, capture_output=True, text=True).returncode
        state["last_verify_rc"] = rc
        return rc == 0

    def made_progress(state: dict, observation: str) -> bool:
        # Replace with a real progress signal (e.g. failing-test count dropping).
        return state.get("last_verify_rc", 1) == 0

    def agent_thinks_done(state: dict) -> bool:
        return state.get("last_verify_rc", 1) == 0

    def on_tick(i: int, state: dict) -> None:
        print(f"  tick {i}: verify_rc={state.get('last_verify_rc')}  spent=${state['usd_spent']}")

    result = run_loop(
        intent, agent_decide=agent_decide, execute=execute, self_verify=self_verify,
        made_progress=made_progress, agent_thinks_done=agent_thinks_done,
        guardrails=g, state_path=state_path, on_tick=on_tick,
    )
    print(f"\nHalt: {result.halt_reason} after {result.iterations} iterations, "
          f"${result.usd_spent} spent.")


def _summarize(state: dict) -> str:
    return f"iteration={state.get('iteration', 0)} verify_rc={state.get('last_verify_rc', 'n/a')}"


def demo(g: Guardrails) -> None:
    """Reuse the engine's mock to show a Ralph loop completing under a budget."""
    failing = {"count": 4}

    def agent_decide(goal, state):
        return {"name": "fix_one_test", "kind": "read"}, 0.50

    def execute(action, state):
        if failing["count"] > 0:
            failing["count"] -= 1
        return f"{failing['count']} failing"

    def self_verify(state):
        return failing["count"] == 0

    def made_progress(state, obs):
        return True

    def agent_thinks_done(state):
        return failing["count"] == 0

    def on_tick(i, state):
        print(f"  tick {i}: {failing['count']} failing  (spent ${state['usd_spent']})")

    print("Ralph loop demo (anchor prompt re-fed each tick, context reset):\n")
    r = run_loop("fix the failing CI tests", agent_decide=agent_decide, execute=execute,
                 self_verify=self_verify, made_progress=made_progress,
                 agent_thinks_done=agent_thinks_done, guardrails=g, state_path="", on_tick=on_tick)
    print(f"\nHalt: {r.halt_reason} after {r.iterations} iterations, ${r.usd_spent} spent.")


def main() -> None:
    ap = argparse.ArgumentParser(description="Portable Ralph loop.")
    ap.add_argument("--intent")
    ap.add_argument("--profile")
    ap.add_argument("--harness-cmd", help='e.g. "claude -p" | "codex exec" | "copilot -p"')
    ap.add_argument("--verify-cmd", default="", help='e.g. "pytest -q"')
    ap.add_argument("--state", default="state.json")
    ap.add_argument("--demo", action="store_true")
    args = ap.parse_args()

    g = load_guardrails(args.profile)
    if args.demo or not (args.intent and args.harness_cmd):
        demo(g)
    else:
        real_run(args.intent, args.harness_cmd, args.verify_cmd, g, args.state)


if __name__ == "__main__":
    main()
