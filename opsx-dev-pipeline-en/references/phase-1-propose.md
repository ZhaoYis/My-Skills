## Phase 1: Proposal (Propose)

3. **Create change and generate artifacts**

   **a. Resuming an existing change from Phase 0 Step 2a**: Skip creation; run `openspec status --change "<name>" --json` and run generation only for incomplete artifacts.

   **b. New change**:

   ```bash
   openspec new change "<name>"
   ```

   **If the change name already exists**, use **AskQuestion**:
   - `Continue on existing change` — treat as 3a (skip create, resume artifact generation).
   - `Use a new name` — ask in plain text for a new name, then create again.

   ```bash
   openspec status --change "<name>" --json
   ```

   Create artifacts in dependency order: for each artifact in `ready`, run `openspec instructions <artifact-id> --change "<name>" --json`, read dependencies, create files per `template`. Leave finished artifacts unchanged. Loop until all `applyRequires` artifacts are done.

   Use **TodoWrite** to track artifact progress.

4. **[Decision 1] Confirm proposal (pre-Apply gate, required)**

   **Hard rule: Do not enter Phase 2 (Apply), do not change product code, and do not run `openspec instructions apply` until the user explicitly chooses “Confirm proposal, start implementation”.**

   **What to show (must answer “are we doing the right thing”, not only “which files exist”):**
   - Short bullets **mapped to the user’s original requirement**: scope (APIs/modules/data), key behavior, non-goals and assumptions;
   - Then a one- or two-line summary per artifact (`proposal.md` / `design.md` / delta `specs` / `tasks.md`).

   **Use AskQuestion first** (options fixed below; **do not** use AskQuestion as a substitute for free-form “does this match?” — if the user picks a “does not match” path, continue in **text**):

   **Options:**
   - `Confirm proposal, start implementation` — only when the user agrees the proposal matches the original ask; go to Phase 2.
   - `Proposal does not match; I need to add or change something` — **do not** collect details via AskQuestion: use **text** so the user can explain gaps (missing/wrong/add/remove); **edit** files under `openspec/changes/<name>/` (proposal / design / specs / tasks), rerun Step 3 generation for anything not ready if needed; **return to this decision**, show the comparison summary again, AskQuestion again. **Repeat until** “Confirm proposal…” or “Terminate pipeline” (no fixed round cap; alignment with the original requirement is the stop condition; if alignment still fails after many rounds, suggest pause, narrow scope, or split the change and let the user decide to terminate).
   - `Terminate pipeline` — exit.

   **Operational notes:**
   - If the user only says in chat “change xxx” without picking an option, treat as the revise path: update artifacts, then show summary and **still** AskQuestion with the three options so explicit confirmation is not skipped.
   - When resuming an existing change (Phase 0 Step 2a) with artifacts already present: **still** pass this gate; if the proposal is stale, update artifacts from the conversation before confirmation.
