## Phase 3: Code review

8. **Load project conventions**

   Read `openspec/project.md` for stack, architecture rules, naming, etc.

   **If `openspec/project.md` is missing**: warn "`openspec/project.md` not found; falling back to defaults in CLAUDE.md", then use CLAUDE.md.

9. **Get the diff**

   Use `git diff HEAD` for all uncommitted changes (unstaged + staged), and `git diff --stat HEAD` for stats.

   **If there is no uncommitted diff**, check for unpushed commits:
   ```bash
   git rev-parse --verify origin/<current-branch> 2>/dev/null
   ```
   - If the upstream exists: `git log origin/<current-branch>..HEAD --oneline`
     - Unpushed commits: review with `git diff origin/<current-branch>..HEAD`
     - None: say nothing to review; go to Phase 4
   - If no upstream (branch never pushed): `git log --oneline -20`, note "branch not on remote yet; consider commit/push before review", go to Phase 4.

10. **Run code review**

    Follow the `git-code-review` skill checklist:
    - Secrets / sensitive data
    - Stack compliance (e.g. Java 8)
    - Layering (Web → Biz → Core → Common)
    - Naming, annotations, style, error handling
    - Mapping (MapStruct), transactions, security, performance

    Save the report under `openspec/review/`:
    - File name: `YYYY-MM-DD-HH:mm-<branch-name>-pipeline-review.md`
    - Multiple rounds: append `-round-2.md`, `-round-3.md`, etc.

11. **[Decision 3] Handle review results**

    Show summary (issue counts + report path), then branch by severity:

    **If there are serious or important issues**, **AskQuestion**:

    **Options:**
    - `Create fix proposal and apply` — full propose → apply → archive fix change → re-review from CR.
    - `Fix directly and re-review` — no new proposal; patch code and re-review.
    - `Pause pipeline; fix manually` — show resume guidance; user re-runs with change name.
    - `Ignore issues; continue to archive` — skip fixes; Phase 4.
    - `Terminate pipeline` — exit.

    **If only minor issues or suggestions**, **AskQuestion**:

    **Options:**
    - `Continue to archive` — Phase 4.
    - `Create fix proposal and apply` — as above.
    - `Pause pipeline; adjust manually` — show resume guidance; exit.
    - `Terminate pipeline` — exit.

    **If zero issues**: go to Phase 4 without asking.

    ---

    **`Create fix proposal and apply` sub-flow (max 3 rounds):**

    a. From the report, draft a fix proposal:
       - Name (kebab-case): `fix-cr-<main-issue-type>` (e.g. `fix-cr-security`, `fix-cr-convention`, `fix-cr-mixed`)
       - Later rounds: `fix-cr-<type>-round-2`
       - Body: issue list, affected files, fix plan, link/path to review report.
    b. Invoke the `openspec-propose` skill to create the fix change and artifacts.
    c. Show fix proposal summary, **AskQuestion**:
       - `Confirm proposal; start fix` — continue.
       - `Revise proposal` — user explains edits; update artifacts.
       - `Abandon fix; continue to archive` — remove this fix change (`rm -rf openspec/changes/fix-cr-*` for what you created); Phase 4.
    d. Invoke `openspec-apply-change` to implement fix tasks.
    e. Archive the fix change (fix changes often have no delta specs — skip sync check, archive):
       ```bash
       mkdir -p openspec/changes/archive
       mv openspec/changes/fix-cr-<type> openspec/changes/archive/YYYY-MM-DD-fix-cr-<type>
       ```
    f. Re-run Steps 9–11.
    g. After 3 rounds with serious issues still open: force pause, tell the user to intervene manually, show resume guidance, exit.

    **`Fix directly and re-review` sub-flow (max 3 rounds):**

    a. Patch code in place from review findings (no new change).
    b. Re-run Steps 9–11.
    c. After 3 rounds with serious issues: force pause, show resume guidance, exit.
