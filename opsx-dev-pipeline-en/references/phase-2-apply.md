---
name: phase-2-apply
description: Global steps 5–7, including decision 2. Usually continue at phase-3-review.md step 8; skip review and archive → phase-4-archive.md step 12.
compatibility: Requires openspec CLI and git; when writing code, follow this repo’s project baseline and existing style (see step 6).
---

## Phase 2: Apply

5. **Fetch apply instructions and context**

   ```bash
   bash opsx-dev-pipeline-en/scripts/opsx-instructions-apply.sh "<name>"
   ```

   **Equivalent**: `openspec instructions apply --change "<name>" --json`

   **Handle returned state:**
   - `state: "blocked"` (missing artifacts) → **AskQuestion**:
     - `Return to Phase 1 to complete artifacts` — go back to Step 3a to finish artifact generation.
     - `Terminate pipeline` — exit.
   - `state: "all_done"` — all tasks done; jump to Phase 3.
   - Otherwise — read all files in `contextFiles` and continue implementation.

6. **Implement task by task**

   Walk pending tasks in `tasks.md`:
   - Show progress: "Implementing task N/M: <task description>"
   - Make code changes using the **project baseline** (same as Phase 3 Step 8: prefer `openspec/project.md`, else `openspec/config.yaml`, else `CLAUDE.md`) and **match existing code** in the same areas of the repo (naming, layering, errors, logging, test layout/style, etc.); do not introduce patterns that contradict local conventions; where the baseline is silent, follow neighboring files and directories touched by this change.
   - Mark complete: `- [ ]` → `- [x]`
   - Continue to the next task.

   **If blocked** (unclear task, design flaw, etc.), **AskQuestion**:
   - `Provide more detail` — user clarifies; continue the current task.
   - `Skip this task` — in `tasks.md` mark `- [~] <description> (skipped)`; next task.
   - `Terminate pipeline` — exit (show resume guidance).

7. **[Decision 2] Implementation complete**

   When all tasks are done, show an implementation summary (completed count, skipped count, changed files), **AskQuestion**:

   **Options:**
   - `Proceed to code review` — enter Phase 3.
   - `Pause pipeline; I will adjust manually` — show resume guidance and exit; user re-runs the pipeline with the change name to continue from Phase 3.
   - `Skip review; archive now` — go to Phase 4.
   - `Terminate pipeline` — exit.
