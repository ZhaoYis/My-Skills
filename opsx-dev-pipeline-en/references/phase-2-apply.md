## Phase 2: Apply

5. **Fetch apply instructions and context**

   ```bash
   openspec instructions apply --change "<name>" --json
   ```

   **Handle returned state:**
   - `state: "blocked"` (missing artifacts) → **AskQuestion**:
     - `Return to Phase 1 to complete artifacts` — go back to Step 3a to finish artifact generation.
     - `Terminate pipeline` — exit.
   - `state: "all_done"` — all tasks done; jump to Phase 3.
   - Otherwise — read all files in `contextFiles` and continue implementation.

6. **Implement task by task**

   Walk pending tasks in `tasks.md`:
   - Show progress: "Implementing task N/M: <task description>"
   - Make code changes (when writing code, follow the `pprod-code-auto-gen` skill if it applies).
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
