---
name: git-commit-push
description: Commit and push code changes to the remote repository. Use when the user wants to commit their changes and push to remote.
license: MIT
compatibility: Requires git CLI and a git repository.
metadata:
  author: zhaoyi
  version: "1.2"
  generatedBy: "1.0.0"
---

Commit and push code changes to the remote repository.

**Input**: Optionally specify a commit message. If omitted, generate a meaningful commit message based on the changes.

**Steps**

1. **Pre-commit checks**

   Run `git status` to check for:
   - Unstaged changes
   - Staged changes
   - Untracked files

   Run `git stash list` to check for existing stashes.

   **If there are conflicts or issues:**
   - Warn user about uncommitted changes
   - Ask if they want to proceed or stash changes first

2. **Check branch sync status**

   Run `git fetch origin` to update remote tracking info.

   Run `git status` to check if current branch is:
   - Ahead of remote (needs push)
   - Behind remote (needs pull first)
   - Diverged (may need rebase or merge)

   **If behind or diverged:**
   - Warn user and ask how to proceed
   - Options: Pull first, Force push (dangerous), Cancel

3. **Check for sensitive files**

   Scan staged files for potentially sensitive content:
   - `.env` files
   - Files containing `password`, `secret`, `api_key`, `token`
   - Private key files (`.pem`, `.key`)
   - Configuration files with credentials

   **If sensitive files detected:**
   - Warn user and show the files
   - Ask for confirmation before proceeding

4. **Stage changes**

   If there are unstaged changes:
   - Run `git add <files>` to stage specific files
   - Or run `git add -A` to stage all changes

   **For OpenSpec changes**: Always include openspec files:
   - `openspec/changes/archive/` (archived changes)
   - `openspec/specs/` (synced specs)
   - `openspec/review/` (code review reports)

5. **Generate and confirm commit message**

   Generate a commit message based on the changes:
   ```
   <type>: <description>

   [optional body]

   Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
   ```

   **Commit types**:
   - `feat`: New feature
   - `fix`: Bug fix
   - `perf`: Performance improvement
   - `refactor`: Code refactoring
   - `docs`: Documentation
   - `test`: Adding/updating tests
   - `chore`: Maintenance tasks
   - `style`: Code style changes
   - `ci`: CI/CD changes

   **Show the generated message to user for confirmation or editing.**

   Use heredoc for multi-line commit messages:
   ```bash
   git commit -m "$(cat <<'EOF'
   <type>: <description>

   <optional body>

   Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
   EOF
   )"
   ```

6. **Push to remote**

   Get current branch name and push:
   ```bash
   git push origin <current-branch>
   ```

   **If push fails:**
   - Show error message
   - Suggest possible solutions:
     - Pull and retry: `git pull --rebase origin <branch>`
     - Check network connectivity
     - Verify permissions

7. **Display summary**

   Show:
   - Commit hash
   - Branch name
   - Commit message
   - Files changed count
   - Remote URL or MR/PR creation link

**Output On Success**

```
## Commit & Push Complete

**Commit:** <commit-hash>
**Branch:** <branch-name>
**Message:**
<commit-message>

**Files changed:** <count> files (+<additions>, -<deletions>)

**Remote:** <remote-url>

**Create MR/PR:** <mr/pr-creation-url>
```

**Output With Warnings**

```
## Commit & Push (with warnings)

**Warnings:**
- Branch is behind remote by X commits
- Sensitive file detected: .env

**Action taken:** Proceeded with user confirmation

**Commit:** <commit-hash>
...
```

**Guardrails**

- Always check git status before committing
- Always check branch sync status before push
- Warn about sensitive files before committing
- Use conventional commit message format
- Include Co-Authored-By line for AI-generated code
- Never use `--no-verify` or skip hooks unless explicitly requested
- Never force push without explicit user confirmation
- Stage all relevant files including openspec artifacts
- Show generated commit message for user confirmation

**Error Handling**

- If no changes to commit: Inform user and exit
- If branch behind remote: Warn and suggest pull first
- If push fails: Show error message and suggest resolution
- If commit hooks fail: Show error and do not proceed
- If sensitive files detected: Warn and ask for confirmation

**Sensitive File Patterns**

Check for these patterns in file names:
- `.env`, `.env.local`, `.env.*.local`
- `*secret*`, `*password*`, `*credential*`
- `*.pem`, `*.key`, `*.p12`, `*.jks`
- `application-*.yml`, `application-*.properties` (if contain secrets)
