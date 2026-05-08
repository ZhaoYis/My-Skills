## Phase 5: Commit, merge, and push

16. **Pre-commit checks**

    ```bash
    git status
    git branch --show-current
    git fetch origin
    ```

    Branch sync (`git status` vs remote):
    - **Behind or diverged**: **AskQuestion**:
      - `Run git pull --rebase then continue` — `git pull --rebase origin <branch>`; on conflicts, list files and AskQuestion: `Resolve manually then continue` / `git rebase --abort and stop`
      - `Ignore; commit anyway (push may fail)` — continue commit flow
      - `Terminate pipeline` — exit

    Scan sensitive paths (`.env`, `*.key`, `*.pem`, files with password/secret/token).
    **If found**: list paths, **AskQuestion**:
    - `Exclude sensitive files and continue` — `git reset HEAD <files>` then commit
    - `Include sensitive files (I accept risk)` — continue after explicit confirm
    - `Terminate pipeline` — exit

17. **Stage and commit**

    ```bash
    git add -A
    ```

    Unstage build artifacts (`target/`), IDE (`.idea/`), logs (`*.log`) with `git reset HEAD <file>`. Always keep openspec paths (archive, specs, review).

    Draft a conventional commit message:
    ```
    <type>: <description>

    Co-Authored-By: Claude <noreply@anthropic.com>
    ```

    Show the message, **AskQuestion**:

    **[Decision 5] Options:**
    - `Confirm commit` — commit with generated message
    - `Edit commit message` — then ask in **plain text** for the custom message (not AskQuestion), wait, commit with user text
    - `Cancel commit` — do not commit; show resume guidance (user can use `git-commit-push` later)

    Commit (heredoc):
    ```bash
    git commit -m "$(cat <<'EOF'
    <commit-message>
    EOF
    )"
    ```

18. **Push**

    ```bash
    git push origin <current-branch>
    ```

    **If push fails**, **AskQuestion**:
    - `Pull --rebase then retry` — `git pull --rebase origin <branch>`; on conflict, list files, AskQuestion: `Resolve manually` (user runs `git rebase --continue` + push again) / `git rebase --abort and stop`; if clean, push again
    - `Terminate pipeline` — exit (note: commit exists locally; `git push origin <branch>` later)

19. **[Decision 6] Merge (only if decision 4 was commit-and-merge)**

    List branches (`git branch -a`), **AskQuestion** for target:

    **Options (derive from what exists):**
    - `master` / `main` if present
    - `qa` if present
    - `stg` if present
    - `develop` if present
    - `Other (I will type the name)`

    **AskQuestion** for strategy:
    - `Standard merge`
    - `Squash merge`
    - `No-ff merge`

    Merge (update target first):
    ```bash
    git fetch origin <target-branch>
    git checkout <target-branch>
    git pull origin <target-branch>
    ```

    By strategy:
    - **Standard merge**: `git merge <source-branch> -m "Merge branch '<source-branch>' into <target-branch>"`
    - **Squash merge**: `git merge --squash <source-branch>` then `git commit -m "Merge branch '<source-branch>' into <target-branch> (squashed)"`
    - **No-ff merge**: `git merge --no-ff <source-branch> -m "Merge branch '<source-branch>' into <target-branch>"`

    After success, push and return:
    ```bash
    git push origin <target-branch>
    git checkout <source-branch>
    ```

    **On conflicts**: `git diff --name-only --diff-filter=U`, then **AskQuestion**:
    - `Abort merge` — `git merge --abort` + `git checkout <source-branch>`, resume guidance, exit
    - `Take theirs` — `git checkout --theirs .` + `git add .`, then push
    - `Take ours` — `git checkout --ours .` + `git add .`, then push
    - `Pause for manual merge` — list conflicts; user resolves, then `git add .` → `git commit` → `git push origin <target-branch>` → `git checkout <source-branch>`, exit

20. **After merge**

    **AskQuestion**:
    - `Keep source branch (default)` — nothing else
    - `Delete source branch locally and on remote` — `git branch -d <source>` + `git push origin --delete <source>`, stay on target branch

21. **Final summary**

    Build from what actually ran (skipped steps marked "⏭️ skipped"), including:
    - Change name, archive path, review report paths (including `-round-N`)
    - Phase table (propose / apply / review / archive / commit / merge)
    - Commit message and diff stats (files, insertions, deletions)
