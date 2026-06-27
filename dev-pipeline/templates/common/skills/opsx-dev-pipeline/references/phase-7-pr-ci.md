---
name: phase-7-pr-ci
description: 全局步骤 23–27（PR 创建、CI 等待/消费、PR 合并、合并后操作、最终摘要）。仅当 delivery_mode = pr 时执行。与 Phase 6 步骤 20 本地合并互斥。
compatibility: 需要 gh CLI、git、可访问的 remote；Cursor 中推荐 AskQuestion。
---

## Phase 7: PR / CI 闭环 (Pull Request & CI Loop)

本 Phase 仅在 **Decision Point 4** 选择「创建 Pull Request」或 `delivery_mode = pr` 时生效。

> **核心约束**：
> - Phase 6 步骤 20（本地 merge）在 PR 模式下**禁止执行**
> - 所有异步阶段必须写入 `openspec/runtime-state.yaml`
> - 恢复时以 runtime state 为准，不重新创建已存在的 PR

---

### 步骤 23：[决策点 6c] 创建 Pull Request

**前置条件**：
- Phase 6 步骤 17–19 已完成（分支已推送）
- `gh` CLI 可用（否则走降级路径）

#### 23.1 检查前置状态

```bash
# 确认当前分支已推送
git branch --show-current
git log origin/<current-branch>..HEAD --oneline  # 应无未推送提交

# 读取 runtime state（续接场景）
bash <SKILL_ROOT>/scripts/dev-pipeline-read-runtime.sh
```

**续接处理**：
- 若 runtime state 显示 `pr.number` 已存在 → 进入步骤 23.3（幂等续接，不重新创建）
- 若 runtime state 显示 `current_phase = phase7_ci_pending` → 直接进入步骤 24（CI 等待）
- 若 runtime state 显示 `current_phase = phase7_ci_triage` → 直接进入步骤 25（CI 分诊）

#### 23.2 创建 PR

使用 **AskQuestion tool** 确认 PR 参数：

**选项**（基于 git 上下文动态生成）：

- **目标分支**：
  - `main` / `master`（若存在）
  - `develop`（若存在）
  - `其他（手动输入）`

- **PR 类型**：
  - `Ready for review` — 标准 PR（推荐默认）
  - `Draft` — 草稿 PR，不触发 CI

使用 `gh pr create`：

```bash
gh pr create \
  --base <target-branch> \
  --head <current-branch> \
  --title "<conventional-commit-title>" \
  --body "<pr-body-with-change-summary>" \
  [--draft]
```

**PR body 模板**（自动从 change 上下文生成）：

```markdown
## Summary

<change 摘要 — 从 proposal.md / design.md 自动提取>

## Changes

- <关键变更 1>
- <关键变更 2>

## Verification

- [ ] Unit tests passed
- [ ] Integration tests passed
- [ ] E2E tests passed
- [ ] Verify passed

🤖 Generated with [opsx-dev-pipeline](https://github.com/ZhaoYis/My-Skills)
```

#### 23.3 写入 Runtime State

PR 创建成功后，更新 `openspec/runtime-state.yaml`：

```yaml
current_phase: phase7_pr_created
delivery_mode: pr
pr:
  number: <PR_NUMBER>
  url: <PR_URL>
  status: open
  title: <PR_TITLE>
  base_branch: <TARGET_BRANCH>
  created_at: <ISO8601>
ci:
  status: pending
pending_action:
  type: wait_ci
  detail: 等待 CI 完成后继续
  since: <ISO8601>
```

#### 23.4 降级路径

若 `gh` CLI 不可用：

- 输出平台无关 PR 模板（包含 title、body、base/head 分支信息）
- 提示用户手动在 Web UI 创建 PR
- 将 runtime state 标记为 `pending_action.type: wait_user`
- **不阻塞流水线** — 用户可以手动创建 PR 后通知 agent 续接

---

### 步骤 24：CI 等待与消费

#### 24.1 检查 CI 状态

```bash
gh pr checks <PR_NUMBER>
# 或
gh pr view <PR_NUMBER> --json state,statusCheckRollup
```

#### 24.2 状态分支

| CI 状态 | 行为 |
|---------|------|
| **pending**（仍在运行） | 暂停流水线，输出 PR URL + 预计等待说明 + 续接指令。更新 runtime state：`current_phase: phase7_ci_pending`、`pending_action.type: wait_ci`、`ci.last_checked_at`。**不空转等待** |
| **passed**（全部通过） | 更新 runtime state：`current_phase: phase7_pr_merge`、`ci.status: passed`。进入步骤 26（合并 PR） |
| **failed**（有失败项） | 更新 runtime state：`current_phase: phase7_ci_triage`、`ci.status: failed`。进入步骤 25（CI 失败分诊） |

#### 24.3 CI 人机协作契约

| 场景 | 行为 |
|------|------|
| CI 仍在运行 | 暂停流水线，输出 PR URL + 预计等待说明，不空转 |
| 用户通知"CI 完成" | 恢复 Phase 7，重新拉取 checks 结果 |
| CI 失败且可归因为代码问题 | 回修复回路（Phase 2），默认最多自动重试 2 轮 |
| CI 失败但疑似基础设施波动 | 优先建议重试（`gh pr checks --retry`），不直接进入代码修复 |
| 无法获取 CI 数据 | 降级为人工日志模式（用户粘贴 CI 输出） |

---

### 步骤 25：[决策点 6d] CI 失败分诊

#### 25.1 失败分类

分析失败的 checks 并将每个失败归类：

| 分类 | 特征 | 建议动作 |
|------|------|---------|
| `code_failure` | 测试失败、编译错误、lint 错误 | 回到 Phase 2 修复代码，重新推送 |
| `flaky_failure` | 相同代码本次失败上次通过、超时重试后通过 | 建议重试（`gh pr checks --retry`） |
| `infra_failure` | 网络错误、容器启动失败、依赖下载失败 | 建议重试或等待；联系运维 |
| `config_permission_failure` | 401/403、缺少环境变量、secrets 不可用 | 人工介入——检查仓库设置 |
| `unknown` | 无法自动归类 | 展示日志，请用户判断 |

#### 25.2 分诊后动作

使用 **AskQuestion tool**：

- `修复代码后重试（推荐）` — 回到 Phase 2（`phase-2-apply.md`），修复后重新 commit + push。自动重试最多 2 轮，超过后强制暂停
- `直接重试 CI（不修改代码）` — 执行 `gh pr checks --retry`，回到步骤 24
- `暂停流水线，手动调整` — 展示恢复指引后退出
- `终止流程` — 退出

#### 25.3 修复回路

```
CI 失败（code_failure）
  → 回到 Phase 2 修复代码
  → Phase 3（快速 review 变更）
  → Phase 5（运行单测）
  → Phase 6 步骤 17–19（commit + push）
  → 回到 Phase 7 步骤 24（重新检查 CI）
  （最多 2 轮自动重试）
```

每次进入修复回路时，在 runtime state 中记录 `decisions` 条目以审计追踪。

---

### 步骤 26：[决策点 6e] 合并 Pull Request

**前置条件**：CI 状态为 `passed`

#### 26.1 合并前最终检查

```bash
gh pr view <PR_NUMBER> --json state,mergeable,reviewDecision,statusCheckRollup
```

确认：
- PR state 为 `OPEN`
- `mergeable` 不为 `CONFLICTING`
- 所有 status checks 通过

#### 26.2 选择合并策略

使用 **AskQuestion tool**：

- `Squash and merge（推荐）` — `gh pr merge <PR_NUMBER> --squash`
- `Create a merge commit` — `gh pr merge <PR_NUMBER> --merge`
- `Rebase and merge` — `gh pr merge <PR_NUMBER> --rebase`

> 该选择属于 **A 类：必须用户确认**；Squash 仅为推荐项，不得静默代选。

#### 26.3 执行合并

```bash
gh pr merge <PR_NUMBER> --<squash|merge|rebase>
```

合并成功后更新 runtime state：

```yaml
pr:
  status: merged
current_phase: completed
pending_action:
  type: ready
  detail: PR 已合并，流水线完成
```

---

### 步骤 27：合并后操作与最终摘要

#### 27.1 分支处理

使用 **AskQuestion tool**：

- `保留源分支（推荐默认）` — 切换到目标分支：`git checkout <target-branch> && git pull`
- `删除远程源分支` — 执行 `gh pr close <PR_NUMBER>`（若未合并）或 `git push origin --delete <source-branch>`（若已合并）

该决策点属于 **A 类：必须用户确认**。

#### 27.2 最终摘要

根据实际 PR/CI 路径动态生成摘要，包含：

- change 名称、PR URL、PR 编号
- CI 状态（总检查数、通过数、失败数）
- 失败分诊决定（若有）
- 合并策略
- **决策点 4** 的选择（PR 模式）
- 与本地 merge 互斥的确认：Phase 6 步骤 20 已正确跳过
- 各阶段状态表（提案 → 应用 → 审查 → 单测 → 归档 → 推送 → PR 创建 → CI → 合并）
