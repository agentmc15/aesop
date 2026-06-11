# Orchestration — parallel agents without collisions

**max_parallel = 2** (your stated review bandwidth, from aesop.yaml). Worktrees make
parallelism technically free; your capacity to review is the real ceiling. Raise
`project.review_bandwidth` only when you can actually read what ships.

## Worktree per agent (non-negotiable for parallelism)

```bash
git worktree add ../$(basename $(pwd))-agent-1 -b agent-1
git worktree add ../$(basename $(pwd))-agent-2 -b agent-2
```

One agent per worktree, one task per agent. The mechanical collisions go away; review
bandwidth doesn't.

## Mayor / workers

1. The mayor (you, or a scheduled triage loop) maintains the work list in `tasks/todo.md`.
2. Each worker runs one goal recipe in its own worktree (`aesop goal run <name>` or native /goal).
3. Pair every maker with a checker: the reviewer subagent (or a second session) reviews the
   diff before merge — the author is too lenient grading its own homework.
4. State lives in git + `tasks/`: a crashed loop resumes from disk, not from memory.
