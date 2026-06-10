---
name: add-learning
description: Record a correction as a durable lesson (mistake → rule) so it never repeats.
args: "<what went wrong / what the human corrected>"
---

1. Append to `tasks/lessons.md`: the mistake pattern, and a rule for yourself that prevents it.
   Format: `- <date> — pattern: <what happened>. Rule: <what to do instead>.`
2. If the rule is general enough that every future session needs it, propose promoting it to the
   instruction file (`aesop lessons --promote` adds it to the manifest's instruction blocks).
3. The repo remembers what you forget — lessons live on disk, not in context.
