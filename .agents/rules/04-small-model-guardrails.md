---
trigger: model_decision
description: Load when editing micro-task decomposition, compiler verification loops, search-replace patching, or student learning/quiz commands.
globs:
  - "src/commands/micro.ts"
  - "src/commands/explain.ts"
  - "src/commands/rubric.ts"
  - "src/core/verify-loop.ts"
---

# Rule 04: Small-Model Verification Loops & Student Defense Mode

## Atomic Micro-Task Execution (`src/commands/micro.ts` & `src/core/verify-loop.ts`)
- **Single-File Scope**: Each micro-step may modify at most 1 file and $\le 60$ lines to prevent output truncation on 4000-token cap endpoints (GitHub Models) and 3B–8B local models.
- **Patch Format**: Require strict search/replace blocks:
  ```
  <<<< SEARCH
  exact existing lines
  ====
  replacement lines
  >>>> REPLACE
  ```

## Checkpoint & Compiler Loop
- Capture pre-edit git state via `git stash create` before applying any patch.
- Run the verification command (`--verify`, defaulting to `npx tsc --noEmit`).
- On non-zero exit code, extract only error lines (truncated to $\le 300$ tokens) and retry up to 2 times. If retry #2 fails, restore the pre-edit state automatically.

## Oral-Defense Learning Mode (`vibe explain --quiz` / `vibe learn`)
- Inspect git diff `HEAD~1..HEAD` and write `.vibe/memory/learn-notes/<YYYY-MM-DD>-<short-sha>.md`.
- Every note must include:
  - **Pattern Summary**: Why this data structure, query, or control flow was chosen.
  - **3 Viva / Interview Questions**: Concrete questions a professor or technical interviewer would ask about the diff, with answers wrapped in `<details><summary>Answer</summary>...</details>`.
