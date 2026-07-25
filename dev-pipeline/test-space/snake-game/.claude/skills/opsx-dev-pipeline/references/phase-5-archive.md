# Phase5: 提案归档 (Archive)

## Step15：检查制品和任务完成状态

```bash
node <SKILL_ROOT>/scripts/change-status.mjs "<name>"
```

若存在未完成任务，**AskQuestion**：`继续归档` / `回到 Phase2 继续实施` / `终止流程`

## Step16：archive 前 verify 门禁

- 若 `openspec/config.yaml` 或项目约定有 verify 命令，先执行并确保通过
- verify 失败 → **AskQuestion**（决策点 5a）：`修复后重试 verify` / `回到 Phase2 修复代码` / `回到 Phase1 修改提案（需求或设计有误）` / `暂停流水线` / `终止流程`
  - 每次执行后调用 `node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs attempt "<name>" verify passed` 或 `verify failed`
  - **verify 重试最多 3 轮**；第三次 `failed` 会强制暂停并返回非零，必须提示人工介入
- 无法确定 verify 命令 → 请求用户手动确认

执行前记录 `verify.command`，执行结果通过 `attempt` 记录，并在需要时记录 `verify.detail`；无适用命令时必须由用户确认并记录 `verify.status=skipped`。未记录 `passed` 或 `skipped` 时，状态机禁止进入 Phase6。

## Step17：Delta spec 同步检查

检查 `openspec/changes/<name>/specs/` 下是否有 delta specs。若有，展示变更摘要，**AskQuestion**：
- `同步到主 specs（推荐）` → Step18 使用 `-y`（无 `--skip-specs`）
- `不同步，直接归档` → Step18 使用 `-y --skip-specs`

## Step18：执行归档

```bash
node <SKILL_ROOT>/scripts/archive.mjs "<name>" -y [--skip-specs]
```

归档成功后从命令 JSON 或文件系统取得实际归档路径，并记录：
```bash
node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs set "<name>" archivePath '"<actual-archive-path>"'
```

## Step19：[决策点 5b] 归档后操作

**AskQuestion**：
- `提交代码并合并到目标分支` → Phase6 完整流程（执行Step23 合并）
- `仅提交并推送（不合并）` → Phase6 commit + push 后结束（跳过Step23）
- `终止流程` → 退出

进入 Phase6 前记录选择并迁移：
```bash
# 选择合并
node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs decision "<name>" postArchiveAction '"merge"'
# 或选择仅推送
node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs decision "<name>" postArchiveAction '"push-only"'
node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs transition "<name>" 6 20
```

修复子 change 使用 `postArchiveAction=local-only`。终止或暂停时记录状态，不得删除状态文件。
