# Phase 6: 提交合并推送 (Merge & Push)

## Step20：预提交检查

```bash
git status
git branch --show-current
git fetch origin
git ls-remote origin HEAD >/dev/null 2>&1
```

- `git ls-remote` 失败 → **AskQuestion**：`检查网络/权限后重试` / `跳过推送阶段，仅本地提交` / `终止流程`
- 分支落后或分叉 → **AskQuestion**：`执行 git pull --rebase` / `继续（不 rebase）` / `终止流程`
- 敏感文件扫描 → 检查以下模式：
  - 环境/密钥：`.env`、`.env.*`、`*.key`、`*.pem`、`*.p12`、`*.pfx`
  - 云凭据：`credentials.json`、`service-account.json`、`*.secret`
  - 私钥块（文件内容含 `-----BEGIN.*PRIVATE KEY-----`）
  - 发现则警告并**逐一**确认：`排除该文件` / `确认提交该文件（高风险）` / `终止流程`

## Step21：暂存并提交

**分步暂存（禁止 `git add -A`）**：

```bash
# 1. 仅暂存已跟踪文件
git add -u
# 2. 显式添加 openspec 目录
git add openspec/
# 3. 逐个审查未跟踪文件：排除编译产物、IDE 配置、敏感文件
git status --porcelain | grep '^??' | cut -c4-
```
- 对每个未跟踪文件 **AskQuestion**：`添加` / `排除（加入 .gitignore）` / `终止流程`
- 使用 conventional commit 格式（`feat`/`fix`/`perf`/`refactor`/`docs`/`test`/`chore`）

**展示完整提交清单**（`git diff --cached --stat` + `git diff --cached --name-only`），**[决策点 6] AskQuestion**：
- `确认提交` → 提交
- `修改提交信息` → 文本消息收集后提交
- `取消暂存，重新选择文件` → 回到Step21 开头
- `终止流程` → 不提交，展示恢复指引

## Step22：推送到远程

```bash
git push origin <current-branch>
```

推送失败 → **AskQuestion**：`执行 pull --rebase 后重试` / `终止流程`

## Step23：[决策点 7] 合并分支（仅当决策点 5b 选择「合并」时执行）

**前置校验**：
1. 确认当前在 source 分支上：`git branch --show-current`
   - 若不在 source 分支：**AskQuestion**：`切换到 source 分支后继续` / `终止流程`
2. 检查 target 分支是否有未提交修改（可能导致 checkout 失败）：
   ```bash
   git stash list  # 记录当前 stash 状态
   git checkout <target-branch> 2>&1
   ```
   - checkout 失败 → **AskQuestion**：`stash 当前修改后重试` / `终止流程`
3. 确认 source 分支的所有提交已推送（避免合并后丢失）：
   ```bash
   git log origin/<source-branch>..HEAD --oneline
   ```
   - 有未推送提交 → 警告用户确认

列出可用分支，**AskQuestion** 询问目标分支（`master`/`main`/`qa`/`develop`/其他）。

**AskQuestion** 询问合并策略：`Standard merge`（推荐）/ `Squash merge` / `No-ff merge`

```bash
git fetch origin <target-branch>
git checkout <target-branch>
git pull origin <target-branch>
# Standard merge：git merge <source-branch> --no-edit
# Squash merge：git merge --squash <source-branch> && git commit -m "<message>" --no-edit
# No-ff merge：git merge --no-ff <source-branch> --no-edit
git push origin <target-branch>
git checkout <source-branch>
```

> 所有 merge 必须使用 `--no-edit` 以避免非交互式环境中编辑器卡死。
> Squash merge 需先执行 `git merge --squash <source-branch>`，再单独 `git commit`。**注意**：Squash merge 不会自动创建 merge commit，commit message 应包含原分支变更摘要。

出现冲突 → **AskQuestion**：`中止合并（git merge --abort）` / `使用对方版本（git checkout --theirs <file>）` / `使用我方版本（git checkout --ours <file>）` / `暂停手动解决`

## Step24：合并后操作

**AskQuestion**：`保留源分支（推荐）` / `删除本地和远程源分支`

## Step25：版本标签（可选）

合并后 **AskQuestion**：`创建版本标签` / `跳过标签`

若创建标签：
1. 按项目约定确定标签名（如 `v1.2.3`），无约定时以交互方式询问用户
2. 执行以下命令创建并推送标签
```bash
   git tag -a <tag-name> -m "<message>"
   git push origin <tag-name>
```

## Step26：展示最终摘要

动态生成摘要（跳过的阶段标记「⏭️ 已跳过」），包含：change 名称、归档路径、审查报告路径、各阶段状态、决策点选择、提交信息与变更统计。
