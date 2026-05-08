---
name: phase-3-review
description: Global steps 8–11, including decision 3 and fix-cr. On archive path, continue at phase-4-archive.md step 12.
compatibility: Requires git; project conventions from `openspec/project.md` or newer `openspec/config.yaml`, else CLAUDE.md; AskQuestion recommended in Cursor.
---

## Phase 3: Code review

8. **Load project conventions**

   **Sources** (cover different OpenSpec versions):
   - **If `openspec/project.md` exists**: read it first (stack, architecture rules, naming, etc.).
   - **Else if `openspec/config.yaml` exists**: read and interpret YAML (newer OpenSpec often stores project info here; keys follow the repo and `openspec` docs).
   - **If neither exists**: warn "`openspec/project.md` and `openspec/config.yaml` not found; falling back to CLAUDE.md defaults", then use CLAUDE.md.

   **If both exist**: treat `project.md` as the primary prose baseline; `config.yaml` may add non-conflicting detail (e.g. schema, toolchain).

   Step 8’s loaded material is referred to below as the **project baseline**.

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

    **Fully inlined**: execute the checklist below inside this pipeline — **do not** rely on any external standalone Git code-review skill.

    **10.1 Secret scanning**  
    Scan the full diff for likely secrets: API keys / apikey patterns, `password` / `passwd`, `token` / `access_token` / `refresh_token`, PEM private keys (`-----BEGIN … PRIVATE KEY-----`), DB URLs with credentials, common cloud credential patterns. **Any hit** → file under **Critical**; recommend env vars or a secret manager; if already committed, warn about history rewriting (filter-repo / BFG, etc.).

    **10.2 Convention baseline**  
    Use Step 8’s **project baseline** (`project.md` / `config.yaml`, and **CLAUDE.md** when used): stack, layering, naming, style, constraints. Everything it states must be checked against the diff.

    **10.3 General dimensions** (fill gaps where the baseline is silent)  
    - **Correctness**: logic bugs, edge/null handling, missing error paths, resource leaks  
    - **Security**: injection (SQL etc.), XSS, exposed secrets, authz gaps  
    - **Performance**: obvious N+1, hot-path inefficiency, unbounded batches  
    - **Maintainability**: duplication, oversized functions/classes, unclear critical behavior  

    **10.4 Typical Java layered stack** (apply **only** when the project baseline or layout indicates it; otherwise stick to baseline + §10.3)  
    - Layers: Web → Biz → Core → Common; no upward or illegal cross-layer deps  
    - Naming suffixes per project baseline (Controller, BizService/Impl, DomainService/Impl, Mapper, DO, VO, Request, Convert, …)  
    - Writes: `@Transactional(rollbackFor = Throwable.class)` when Spring-style  
    - Mapping: prefer MapStruct (`INSTANCE`), avoid huge hand-rolled maps  
    - Logging: framework logger; avoid `System.out.println`  

    **10.5 Historical reviews**  
    If `openspec/review/` has a recent report for the **same branch**, compare recurring issues, fixed items, regressions.

    **10.6 Very large diffs**  
    If stats show a very large change (e.g. on the order of 5000+ lines), review in chunks (by file/dir) and state the chunking strategy in the summary.

    **10.7 Report language**  
    Pipeline rule: **Project baseline** (`project.md` / `config.yaml`) and user-facing workflow may be English here, but the **saved review document body must remain 中文** (same as Phase 3 report filenames and parent skill). Structure: overview (files, +/- lines, counts by severity), **Critical / Major / Minor / Suggestions**, convention violations table vs **project baseline**, file list, secret-scan section, delta vs last review (if any), fix list, positives.  
    **Severity**: critical (security/data loss/show-stoppers) > major (convention/perf/design) > minor (style/naming) > suggestion (optional).

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
    e. Archive the fix change (often no delta specs: if Step 13 is skipped, `--skip-specs` is typical; omit it if deltas must merge into main specs):
       ```bash
       bash opsx-dev-pipeline-en/scripts/opsx-archive.sh "fix-cr-<type>" -y --skip-specs
       ```
       **Equivalent**: `openspec archive "fix-cr-<type>" -y --skip-specs`; on failure, fall back to manual `mkdir` + `mv` (same Phase 4 fallback note).
    f. Re-run Steps 9–11.
    g. After 3 rounds with serious issues still open: force pause, tell the user to intervene manually, show resume guidance, exit.

    **`Fix directly and re-review` sub-flow (max 3 rounds):**

    a. Patch code in place from review findings (no new change).
    b. Re-run Steps 9–11.
    c. After 3 rounds with serious issues: force pause, show resume guidance, exit.
