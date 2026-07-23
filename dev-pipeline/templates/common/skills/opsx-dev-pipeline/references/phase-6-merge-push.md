# Phase 6: 提交合并推送 (Merge & Push)

## 步骤 17：预提交检查

```bash
git status
git branch --show-current
git fetch origin
```

- 分支落后或分叉 → **AskQuestion**：`执行 git pull --rebase` / `继续（不 rebase）` / `终止流程`
- 敏感文件扫描（`.env`、`*.key`、`*.pem` 等）→ 发现则警告并确认

## 步骤 18：暂存并提交

```bash
git add -A
```

- 排除编译产物、IDE 配置；始终包含 openspec 文件
- 使用 conventional commit 格式（`feat`/`fix`/`perf`/`refactor`/`docs`/`test`/`chore`）

展示提交信息，**[决策点 6] AskQuestion**：
- `确认提交` → 提交
- `修改提交信息` → 文本消息收集后提交
- `终止流程` → 不提交，展示恢复指引

## 步骤 19：推送到远程

```bash
git push origin <current-branch>
```

推送失败 → **AskQuestion**：`执行 pull --rebase 后重试` / `终止流程`

## 步骤 20：[决策点 7] 合并分支（仅当决策点 5 选择「合并」时执行）

列出可用分支，**AskQuestion** 询问目标分支（`master`/`main`/`qa`/`develop`/其他）。

**AskQuestion** 询问合并策略：`Standard merge`（推荐）/ `Squash merge` / `No-ff merge`

```bash
git fetch origin <target-branch>
git checkout <target-branch>
git pull origin <target-branch>
git merge <source-branch>  # 或 --squash / --no-ff
git push origin <target-branch>
git checkout <source-branch>
```

出现冲突 → **AskQuestion**：`中止合并` / `使用对方版本` / `使用我方版本` / `暂停手动解决`

## 步骤 21：合并后操作

**AskQuestion**：`保留源分支（推荐）` / `删除本地和远程源分支`

## 步骤 22：展示最终摘要

动态生成摘要（跳过的阶段标记「⏭️ 已跳过」），包含：change 名称、归档路径、审查报告路径、各阶段状态、决策点选择、提交信息与变更统计。
