# Phase6: 提交、推送与合并

## 步骤索引

1. Step20：读取状态与预提交检查
2. Step21：分步暂存与提交门禁
3. Step22：源分支推送门禁
4. Step23：目标分支与合并门禁
5. Step24：合并后验证与目标推送门禁
6. Step25：源分支清理与标签
7. Step26：完成状态与摘要

## 通用安全规则

- 所有命令在 Git 仓库根目录执行；先读取 `dev-pipeline-state.mjs get`，状态与 Git 事实不一致时立即暂停。
- commit、source push、merge、target push、删除本地分支、删除远程分支、创建标签和推送标签分别确认，禁止合并确认。
- 禁止 `git add -A`、`git push --force`、`git branch -D`、未经逐文件确认的全局 ours/theirs。
- 任一步失败时先记录 `pause` 和失败事实，不得谎报完成或自动选择破坏性恢复方案。

## Step20：读取状态与预提交检查

```bash
node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs get "<name>"
git status --short
git branch --show-current
git remote -v
```

1. 当前分支必须等于状态中的 `sourceBranch`；否则询问切换或暂停。
2. 无 `origin` 时询问：`配置远程后继续` / `仅本地提交` / `终止流程`。仅本地提交时记录 `postArchiveAction=local-only`。
3. 有远程时执行 `git fetch --prune origin`；失败后只能重试、转为仅本地交付或终止。
4. 扫描 `.env`、`.env.*`、`*.key`、`*.pem`、`*.p12`、`*.pfx`、`credentials.json`、`service-account.json`、`*.secret` 和私钥块。
5. 敏感文件逐一确认排除、保留或终止；不得将“推荐排除”当作自动决定。

## Step21：[决策点 6] 分步暂存与提交

```bash
git add -u
git add openspec/
git status --porcelain
```

逐一审查未跟踪文件，只显式 `git add -- <path>`。展示：

```bash
git diff --cached --stat
git diff --cached --name-only
git diff --cached --check
```

询问：`确认提交` / `修改提交信息` / `取消暂存并重选` / `终止流程`。确认后先记录：

```bash
node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs decision "<name>" commitApproved true
git commit -m "<conventional-commit-message>"
node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs set "<name>" delivery.commitSha '"<commit-sha>"'
```

hook 失败时修复后重试；`--no-verify` 必须作为新的高风险决策单独确认。

## Step22：源分支推送门禁

`postArchiveAction=local-only` 时跳过本 Step 和所有远程动作。否则展示 source branch、remote URL、待推送提交：

```bash
git log --oneline "origin/<source-branch>..HEAD"
```

询问：`确认推送源分支` / `暂不推送` / `终止流程`。确认后：

```bash
node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs decision "<name>" sourcePushApproved true
git push origin "<source-branch>"
node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs set "<name>" delivery.sourcePushed true
```

推送失败不得自动 rebase。先 fetch 并展示 ahead/behind，再询问 `pull --rebase`、保持本地等待人工处理或终止。

`postArchiveAction=push-only` 到此完成交付，进入 Step26。

## Step23：[决策点 7] 目标分支与合并

只有 `postArchiveAction=merge` 执行本 Step。

1. **先选择目标分支，再执行任何 checkout/switch**。列出本地和远程分支，询问 target branch。
2. 使用 `git check-ref-format --branch "<target-branch>"` 校验，确认 target 不等于 source，然后记录：
   ```bash
   node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs set "<name>" targetBranch '"<target-branch>"'
   ```
3. 确认工作区干净且源提交已推送，再准备目标分支：
   ```bash
   git fetch origin "<target-branch>"
   git switch "<target-branch>" || git switch -c "<target-branch>" --track "origin/<target-branch>"
   git pull --ff-only origin "<target-branch>"
   ```
4. 询问合并策略：`Standard merge` / `Squash merge` / `No-ff merge`，记录 `mergeStrategy`。
5. 展示 `git log --oneline "<target-branch>..<source-branch>"` 和 diff，再单独询问 `确认本地合并` / `取消`。
6. 确认后记录 `mergeApproved=true`，执行对应命令：
   ```bash
   # Standard
   git merge "<source-branch>" --no-edit

   # Squash；不要向 git commit 传 --no-edit
   git merge --squash "<source-branch>"
   git commit -m "<squash-message>"

   # No-ff
   git merge --no-ff "<source-branch>" --no-edit
   ```

### 冲突处理

先运行 `git diff --name-only --diff-filter=U` 展示冲突文件。询问：`中止合并` / `逐文件解决` / `暂停人工处理`。

- Standard/No-ff 中止：`git merge --abort`。
- Squash 中止：展示 `ORIG_HEAD` 后，经确认执行 `git reset --merge ORIG_HEAD`。
- 逐文件解决时说明当前位于 target：`--ours` 是 target，`--theirs` 是 source。每个文件单独选择并执行 `git add -- <file>`。
- 只有 `git diff --name-only --diff-filter=U` 为空后才允许完成提交。

合并成功后记录 `delivery.mergeCommitSha`。

## Step24：合并后验证与目标推送

在 target HEAD 上重新执行状态中记录的 verify 和 tests 命令。任一失败则禁止 push，记录失败并暂停；回滚本地合并必须再次显式确认。

验证通过后展示：

```bash
git log -1 --oneline
git diff --stat "origin/<target-branch>..HEAD"
```

询问：`确认推送目标分支` / `保留本地合并，暂不推送` / `终止流程`。确认后：

```bash
node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs decision "<name>" targetPushApproved true
git push origin "<target-branch>"
node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs set "<name>" delivery.targetPushed true
```

## Step25：源分支清理与标签

只有 target push 成功后才能进入本 Step。先验证 source 已包含在远程 target：

```bash
git fetch origin
git merge-base --is-ancestor "<source-branch>" "origin/<target-branch>"
```

分别询问是否删除本地和远程源分支。本地只允许 `git branch -d "<source-branch>"`；远程删除使用 `git push origin --delete "<source-branch>"`，不得使用强制删除兜底。

标签必须基于 target HEAD。先校验标签不存在并展示目标提交，再分别确认创建和推送：

```bash
git rev-parse -q --verify "refs/tags/<tag-name>"
git tag -a "<tag-name>" -m "<message>"
git push origin "<tag-name>"
node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs set "<name>" delivery.tag '"<tag-name>"'
```

## Step26：完成状态与摘要

只有以下交付结果之一成立时才执行 `complete`：仅本地提交完成、source push 完成、或 target push 完成。

```bash
node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs complete "<name>"
```

展示 change、归档路径、审查报告、测试/verify 结果、各决策、提交 SHA、source/target push、合并策略、分支清理和标签结果。跳过项明确标记，不得用“完成”掩盖暂停或失败。
