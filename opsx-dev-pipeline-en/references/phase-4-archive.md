## Phase 4: Archive

12. **Check artifacts and tasks**

    ```bash
    bash opsx-dev-pipeline-en/scripts/opsx-change-status.sh "<name>"
    ```

    **Equivalent**: `openspec status --change "<name>" --json`

    (Recommended) then `bash opsx-dev-pipeline-en/scripts/opsx-validate-change.sh "<name>"` to surface structural issues before archive.

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
      - `Sync to main specs (recommended)` — in Step 14 run `bash opsx-dev-pipeline-en/scripts/opsx-archive.sh "<name>" -y` (**without** `--skip-specs`): OpenSpec merges deltas into `openspec/specs/` and archives; no manual copy.
      - `Skip sync; archive only` — in Step 14 run `bash opsx-dev-pipeline-en/scripts/opsx-archive.sh "<name>" -y --skip-specs`: do not update main specs.

14. **Archive**

    **Recommended (OpenSpec CLI)**: after Step 13, use official archive so main specs merge and the change moves under `openspec/changes/archive/`.

    - If Step 13 chose **sync delta to main specs** (update `openspec/specs/`):

      ```bash
      bash opsx-dev-pipeline-en/scripts/opsx-archive.sh "<name>" -y
      ```

    - If Step 13 chose **skip main spec updates** (tooling/docs-only style):

      ```bash
      bash opsx-dev-pipeline-en/scripts/opsx-archive.sh "<name>" -y --skip-specs
      ```

    **Equivalent**: `openspec archive "<name>" -y` (add `--skip-specs` when appropriate). The CLI validates, merges when not skipped, and picks the dated archive folder name.

    **Fallback**: if `openspec archive` fails or is unavailable, use manual `mkdir -p openspec/changes/archive`, pick `YYYY-MM-DD-<change-name>` (append `-N` on clash), then `mv openspec/changes/<name> openspec/changes/archive/<target>` (no automatic spec merge — must match Step 13 intent).

15. **[Decision 4] After archive**

    **AskQuestion**:

    **Options:**
    - `Commit and merge into target branch` — full Phase 5.
    - `Commit and push only (no merge)` — Phase 5: commit + push, then stop.
    - `Terminate pipeline` — exit (show resume guidance).
