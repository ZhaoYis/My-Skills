# Phase 5: 提案归档 (Archive)

## Step15：检查制品和任务完成状态

```bash
bash <SKILL_ROOT>/scripts/dev-pipeline-change-status.sh "<name>"
```

若存在未完成任务，**AskQuestion**：`继续归档` / `回到 Phase 2 继续实施` / `终止流程`

## Step16：archive 前 verify 门禁

- 若 `openspec/config.yaml` 或项目约定有 verify 命令，先执行并确保通过
- verify 失败 → **AskQuestion**（决策点 5a）：`修复后重试 verify` / `回到 Phase 2 修复代码` / `回到 Phase 1 修改提案（需求或设计有误）` / `暂停流水线` / `终止流程`
  - **verify 重试最多 3 轮**，超过后强制暂停并提示人工介入
- 无法确定 verify 命令 → 请求用户手动确认

## Step17：Delta spec 同步检查

检查 `openspec/changes/<name>/specs/` 下是否有 delta specs。若有，展示变更摘要，**AskQuestion**：
- `同步到主 specs（推荐）` → Step18 使用 `-y`（无 `--skip-specs`）
- `不同步，直接归档` → Step18 使用 `-y --skip-specs`

## Step18：执行归档

```bash
bash <SKILL_ROOT>/scripts/dev-pipeline-archive.sh "<name>" -y [--skip-specs]
```

## Step19：[决策点 5b] 归档后操作

**AskQuestion**：
- `提交代码并合并到目标分支` → Phase 6 完整流程（执行Step23 合并）
- `仅提交并推送（不合并）` → Phase 6 commit + push 后结束（跳过Step23）
- `终止流程` → 退出
