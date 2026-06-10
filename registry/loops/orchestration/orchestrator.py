#!/usr/bin/env python3
"""
orchestrator.py — the Stage-5 "Mayor" pattern: one loop supervising others.

A scheduler (cron) kicks this orchestrator. It reads a work queue from durable git-backed state,
dispatches a worker per item (each in its own isolated worktree so they don't collide), each worker
self-verifies, a review agent scans the result, and GUARDRAILS are checked every tick. State lives
in git so a crash/restart resumes from the last checkpoint.

This is what cron alone cannot express: a decision-maker in the body, one loop supervising others
concurrently, and durable shared state with crash recovery.

Demo (no network, no model — a simulated "babysit my PRs" run):
    python orchestrator.py --demo
"""
from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass


@dataclass
class Guardrails:
    max_iterations: int = 30
    no_progress_stop: int = 3
    budget_usd: float = 50.0


# A tiny status machine for one PR: fixing_build -> awaiting_review -> done.
NEXT_STATUS = {"fixing_build": "awaiting_review", "awaiting_review": "done", "done": "done"}


def load_state(path: str) -> dict:
    if path and os.path.exists(path):
        return json.load(open(path))
    # Seed a mock queue matching docs/source/loop-architectures.html state.json.
    return {
        "run_id": "demo",
        "iteration": 0,
        "usd_spent": 0.0,
        "prs": {
            "#412": {"status": "fixing_build", "attempts": 0, "worktree": "wt-412"},
            "#418": {"status": "awaiting_review", "attempts": 0, "worktree": "wt-418"},
            "#421": {"status": "fixing_build", "attempts": 0, "worktree": "wt-421"},
        },
        "halt_reason": None,
    }


def checkpoint(state: dict, path: str) -> None:
    if path:
        json.dump(state, open(path, "w"), indent=2)  # a real impl also commits to git


def dispatch_worker(pr_id: str, pr: dict) -> tuple[str, float]:
    """Simulate one worker tick in an isolated worktree: advance status, self-verify, report cost."""
    pr["attempts"] += 1
    # In a real impl this shells out a worker agent (see ../ralph/) in `pr["worktree"]`, which
    # writes code, runs build/test/lint (self_verify), and commits its branch.
    pr["status"] = NEXT_STATUS[pr["status"]]
    return pr["status"], 1.20  # mock cost per worker tick


def review_scan(pr_id: str, pr: dict) -> str:
    """Simulate the review agent (roborev-style 2nd pass) scanning a worktree's new commit."""
    return "approve" if pr["status"] in ("awaiting_review", "done") else "fix"


def orchestrate(state_path: str, g: Guardrails) -> dict:
    state = load_state(state_path)
    spent = float(state["usd_spent"])
    stale = 0

    for tick in range(state["iteration"], g.max_iterations):
        progressed = False
        for pr_id, pr in state["prs"].items():
            if pr["status"] == "done":
                continue
            new_status, cost = dispatch_worker(pr_id, pr)   # worker tick (isolated worktree)
            spent += cost
            verdict = review_scan(pr_id, pr)                # review agent scans the diff
            print(f"  tick {tick}: {pr_id} -> {new_status} (review: {verdict}, ${spent:.2f})")
            progressed = True

        state["iteration"] = tick + 1
        state["usd_spent"] = round(spent, 2)
        checkpoint(state, state_path)                       # crash-recoverable checkpoint

        # ---- guardrails checked every tick ----
        if all(pr["status"] == "done" for pr in state["prs"].values()):
            state["halt_reason"] = "complete"
            return state
        if not progressed:
            stale += 1
            if stale >= g.no_progress_stop:
                state["halt_reason"] = "no-progress"
                return state
        else:
            stale = 0
        if spent >= g.budget_usd:
            state["halt_reason"] = "budget-ceiling"
            return state

    state["halt_reason"] = "max-iterations"
    return state


def main() -> None:
    ap = argparse.ArgumentParser(description="Orchestrator (Mayor) loop.")
    ap.add_argument("--state", default="", help="Path to durable state.json (enables resume).")
    ap.add_argument("--demo", action="store_true")
    args = ap.parse_args()

    print("Orchestration demo: 'babysit all my PRs' (simulated)\n")
    final = orchestrate(args.state, Guardrails())
    done = sum(1 for p in final["prs"].values() if p["status"] == "done")
    print(f"\nHalt: {final['halt_reason']} — {done}/{len(final['prs'])} PRs done, "
          f"${final['usd_spent']} spent over {final['iteration']} ticks.")


if __name__ == "__main__":
    main()
