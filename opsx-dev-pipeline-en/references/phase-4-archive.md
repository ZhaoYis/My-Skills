## Phase 4: Archive

12. **Check artifacts and tasks**

    ```bash
    openspec status --change "<name>" --json
    ```

    Read `tasks.md` for unfinished items.

    **If anything is unfinished**: warn and **AskQuestion**:
    - `Archive anyway` — ignore unfinished; continue.
    - `Back to implementation` — Phase 2.
    - `Terminate pipeline` — exit.

13. **Delta spec sync check**

    Check `openspec/changes/<name>/specs/` for delta specs.

    **If delta specs exist**:
    - Compare to main specs (`openspec/specs/<capability>/spec.md`), show delta summary.
    - **AskQuestion**:
      - `Sync to main specs (recommended)` — perform sync.
      - `Skip sync; archive only` — no sync.

14. **Archive**

    ```bash
    mkdir -p openspec/changes/archive
    ```

    Target folder name `YYYY-MM-DD-<change-name>`. If it exists, append `-N`.

    ```bash
    mv openspec/changes/<name> openspec/changes/archive/YYYY-MM-DD-<name>
    ```

15. **[Decision 4] After archive**

    **AskQuestion**:

    **Options:**
    - `Commit and merge into target branch` — full Phase 5.
    - `Commit and push only (no merge)` — Phase 5: commit + push, then stop.
    - `Terminate pipeline` — exit (show resume guidance).
