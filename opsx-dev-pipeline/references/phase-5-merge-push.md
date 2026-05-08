## Phase 5: 提交合并推送 (Merge & Push)

16. **预提交检查**

    ```bash
    git status
    git branch --show-current
    git stash list
    git fetch origin
    ```

    若存在 stash：在摘要中**提示**用户注意，避免与本次提交混淆；不自动 pop。

    检查分支同步状态（`git status` 对比远程）：
    - **如果落后远程或分支分叉**：使用 **AskQuestion tool** 询问：
      - `执行 git pull --rebase 后继续` - 运行 `git pull --rebase origin <branch>`，如果 rebase 产生冲突则提示冲突文件，使用 AskQuestion 询问：`手动解决后继续` / `git rebase --abort 并终止`
      - `忽略，直接提交（推送时可能失败）` - 继续提交流程
      - `终止流程` - 退出

    扫描敏感路径与敏感文件名模式：`.env`、`.env.local`、`.env.*.local`；路径或文件名含 `secret` / `password` / `credential`；`*.key`、`*.pem`、`*.p12`、`*.jks`；以及内容明显含 `api_key` / `token`（与凭据连写）的配置文件。对已跟踪的 `application-*.yml` / `application-*.properties` 仅在疑似含明文密钥时告警。
    **如果检测到敏感文件**：列出文件并使用 **AskQuestion tool** 询问：
    - `排除敏感文件后继续` - 使用 `git reset HEAD <敏感文件>` 从暂存区移除后提交
    - `包含敏感文件继续提交` - 用户确认风险后继续
    - `终止流程` - 退出

17. **暂存变更并提交**

    ```bash
    git add -A
    ```

    排除不应提交的文件（编译产物 `target/`、IDE 配置 `.idea/`、日志 `*.log`），用 `git reset HEAD <file>` 移除。始终包含 openspec 文件（archive、specs、review）。

    根据变更含义选择 **conventional commit** 类型（示例）：`feat`、`fix`、`perf`、`refactor`、`docs`、`test`、`chore`、`style`、`ci`；单行描述简明；可多行正文。默认附带：

    ```
    Co-Authored-By: Claude <noreply@anthropic.com>
    ```

    展示提交信息，使用 **AskQuestion tool** 询问：

    **[决策点 5] 选项：**
    - `确认提交` - 使用生成的信息提交
    - `修改提交信息` - 选择后，通过文本消息向用户询问自定义提交信息（不使用 AskQuestion tool），等待用户回复后使用其输入的信息提交
    - `取消提交` - 不提交，展示恢复指引后退出（用户可稍后**从本 Phase 步骤 16 起**自行执行暂存、提交与推送）

    **若无任何可提交变更**（已无 diff、且工作区干净）：告知用户并结束本 Phase，不强行 `git commit`。

    执行提交（使用 heredoc）：
    ```bash
    git commit -m "$(cat <<'EOF'
    <commit-message>
    EOF
    )"
    ```

18. **推送到远程**

    ```bash
    git push origin <current-branch>
    ```

    **如果推送失败**，使用 **AskQuestion tool** 询问：
    - `执行 pull --rebase 后重试` - 运行 `git pull --rebase origin <branch>`；如果 rebase 产生冲突，提示冲突文件并使用 AskQuestion 询问：`手动解决后继续`（用户解决后运行 `git rebase --continue` + 重新 push）/ `git rebase --abort 并终止`；如果 rebase 成功，重新 push
    - `终止流程` - 退出（提示：提交若已保存在本地，可稍后执行 `git push origin <branch>`，步骤同本 Phase §18）

19. **[决策点 6] 合并分支（仅当用户在决策点 4 选择"提交代码并合并"时）**

    **合并前自检**（对齐内联合并流程）：
    - 运行 `git status`：须无未暂存/未提交变更（除非当前流程与用户选择明确允许留有 WIP）；若有，**AskQuestion**：`先 stash 再继续` / `先提交再继续` / `终止流程`。
    - 记录源分支名 `<source-branch>`（当前分支）。
    - **若**存在 `origin/<source-branch>`：**建议** `git log origin/<source-branch>..HEAD --oneline` 无未推送提交再合并；若有未推送提交，**AskQuestion** 是否在合并前补跑 §18 推送或仍继续（并说明风险）。
    - 在满足 §18 **门禁**前提下再执行后续步骤：进入本步前应尽量保证 §18 已成功 push；若仅因网络未完成 push，应先处理或由用户确认再继续。

    列出可用分支（`git branch -a`），使用 **AskQuestion tool** 询问目标分支：

    **选项（根据实际存在的分支动态生成）：**
    - `master` / `main`（如果存在）
    - `qa`（如果存在）
    - `stg`（如果存在）
    - `develop`（如果存在）
    - `其他（手动输入）`

    使用 **AskQuestion tool** 询问合并策略：
    - `Standard merge` - 标准合并（默认）
    - `Squash merge` - 压缩合并
    - `No-ff merge` - 非快进合并

    执行合并（先更新目标分支）：
    ```bash
    git fetch origin <target-branch>
    git checkout <target-branch>
    git pull origin <target-branch>
    ```

    根据所选策略执行：
    - **Standard merge**: `git merge <source-branch> -m "Merge branch '<source-branch>' into <target-branch>"`
    - **Squash merge**: `git merge --squash <source-branch>` → `git commit -m "Merge branch '<source-branch>' into <target-branch> (squashed)"`
    - **No-ff merge**: `git merge --no-ff <source-branch> -m "Merge branch '<source-branch>' into <target-branch>"`

    合并成功后推送并切回：
    ```bash
    git push origin <target-branch>
    git checkout <source-branch>
    ```

    **如果出现冲突**，先运行 `git diff --name-only --diff-filter=U` 列出冲突文件，然后使用 **AskQuestion tool** 询问：
    - `中止合并` - 执行 `git merge --abort` + `git checkout <source-branch>`，展示恢复指引后退出
    - `使用对方版本 (theirs)` - 执行 `git checkout --theirs .` + `git add .` 后继续 push
    - `使用我方版本 (ours)` - 执行 `git checkout --ours .` + `git add .` 后继续 push
    - `暂停，手动解决` - 展示冲突文件列表，提示用户手动解决后执行 `git add .` → `git commit` → `git push origin <target-branch>` → `git checkout <source-branch>`，然后退出

20. **合并后操作**

    合并成功后，使用 **AskQuestion tool** 询问：
    - `保留源分支（默认）` - 不做额外操作
    - `删除本地和远程源分支` - 执行 `git branch -d <source>` + `git push origin --delete <source>`，并留在目标分支

21. **展示最终摘要**

    根据实际执行路径动态生成摘要（跳过的阶段标记为"⏭️ 已跳过"），包含：
    - change 名称、归档路径、审查报告路径（含多轮 round 文件）
    - 各阶段状态表（提案/应用/审查/归档/提交/合并）
    - 提交信息和变更统计（文件数、新增行、删除行）
