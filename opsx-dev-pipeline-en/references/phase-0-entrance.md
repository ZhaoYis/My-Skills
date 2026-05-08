## Phase 0: Entry routing

1. **Environment preflight**

   ```bash
   openspec --version
   git rev-parse --is-inside-work-tree
   ```

   - If the openspec CLI is unavailable: show how to install and exit.
   - If not inside a git repository: prompt `git init` (or enter a repo) and exit.

2. **Determine entry type**

   **a. User provided an existing change name:**
   - Run `openspec status --change "<name>" --json` to inspect change state.
   - If the change does not exist: report invalid name, run `openspec list --json` to list changes, let the user pick again.
   - If it exists, infer which phase to resume from artifacts and tasks:
     - Not all `applyRequires` artifacts done → continue from **Phase 1 Step 3** (see which artifacts are `ready`, run generation only for incomplete ones; leave completed artifacts unchanged).
     - Artifacts done but tasks not all done → continue **Phase 2** implementation.
     - All tasks done → start **Phase 3** review.
   - Use the **AskQuestion tool** to confirm:
     - `Continue from Phase X` — follow the inferred phase.
     - `Start over (new change)` — ask for a new change name and run full Phase 1 (leave the old change untouched).
     - `Terminate pipeline` — exit.

   **b. User provided a requirement description:**
   - Derive a kebab-case change name from the description.
   - Enter **Phase 1**.

   **c. User provided no input:**
   - Send a plain-text message (do **not** use AskQuestion here — free text is needed):
     > "Please describe the requirement or feature to implement, or enter an existing change name."
   - After the reply, route per **a** or **b**.
