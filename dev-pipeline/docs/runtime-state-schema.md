# Pipeline Runtime State Schema

> 版本：v1.0 · 2026-06
> 目标：定义流水线运行时状态的持久化结构，支持跨会话暂停/恢复。

---

## 1. 设计原则

1. **与 change metadata 分离**：`change metadata` 管变更语义（是什么变更），`runtime state` 管执行进度（进行到哪一步）。二者必须独立存储。
2. **所有异步阶段必须可恢复**：PR pending、CI 等待、用户暂停——任何需要跨会话续接的阶段都要写 runtime state。
3. **幂等恢复**：已完成阶段不重复执行破坏性操作；PR 已存在则续接不重新创建；CI pending 不空转等待。
4. **默认保守**：runtime state 不替用户做决定。`delivery_mode` 未设置时不假设默认值。

---

## 2. 存储位置

```
<project-root>/openspec/runtime-state.yaml
```

选择 `openspec/` 而不是 `.knowledge/` 或独立目录的原因：
- `openspec/` 是流水线的操作空间，runtime state 描述的是流水线的执行进度
- 同一个 git 仓库，便于纳入版本追踪（可选）

---

## 3. Schema 定义

```yaml
# ── 必填字段 ──

change_id: string             # 当前变更的唯一标识
branch: string                # 当前工作分支
current_phase: string         # 当前所在阶段（枚举值见下文）
last_completed_gate: string   # 最后一个通过的门禁名称

# ── 交付模式 ──

delivery_mode: enum           # push_only | local_merge | pr

# ── PR 模式专用（仅 delivery_mode = pr 时）──

pr:
  number: int?                # PR 编号
  url: string?                # PR URL
  status: enum?               # open | merged | closed
  title: string?              # PR 标题
  base_branch: string?        # 目标分支
  created_at: string?         # 创建时间 (ISO 8601)

# ── CI 状态（仅 delivery_mode = pr 时）──

ci:
  status: enum                # pending | passed | failed | unknown
  last_checked_at: string?    # 最后检查时间 (ISO 8601)
  checks_url: string?         # CI checks 页面 URL
  failure_category: enum?     # code_failure | flaky_failure | infra_failure | config_permission_failure | unknown
  total_checks: int?          # 总检查数
  passed_checks: int?         # 通过的检查数
  failed_checks: int?         # 失败的检查数

# ── 等待状态 ──

pending_action:
  type: enum                  # ready | wait_user | wait_ci | wait_deploy | wait_fix
  detail: string              # 人类可读的描述
  since: string?              # 进入等待状态的时间 (ISO 8601)

# ── 各门禁结果 ──

results:
  unit: enum                  # passed | failed | skipped | degraded_manual | not_applicable
  integration: enum
  verify: enum
  e2e: enum
  security: enum

# ── 决策历史（审计用）──

decisions:
  - id: string                # 决策点编号（如 "1", "4", "6-pr"）
    at: string                # 做出决策的时间 (ISO 8601)
    choice: string            # 选择的选项
    reason: string?           # 选择理由

# ── 时间戳 ──

created_at: string            # 流水线创建时间 (ISO 8601)
updated_at: string            # 最后更新时间 (ISO 8601)
```

---

## 4. 枚举值定义

### 4.1 `current_phase`

| 值 | 含义 |
|----|------|
| `pre_pipeline` | 流水线尚未启动（在 analysis/design 阶段） |
| `phase0_entrance` | Phase 0 — 入口预检 |
| `phase1_propose` | Phase 1 — 提案编写 |
| `phase2_apply` | Phase 2 — 提案应用 |
| `phase3_review` | Phase 3 — 代码审查 |
| `phase5_unittest` | Phase 5 — 单测门禁 |
| `phase4_archive` | Phase 4 — 归档 |
| `phase6_push` | Phase 6 — 推送 |
| `phase6_merge` | Phase 6 — 合并 |
| `phase7_pr_created` | Phase 7 — PR 已创建 |
| `phase7_ci_pending` | Phase 7 — 等待 CI |
| `phase7_ci_triage` | Phase 7 — CI 失败分诊 |
| `phase7_pr_merge` | Phase 7 — PR 合并 |
| `completed` | 流水线完成 |
| `terminated` | 流水线终止 |

### 4.2 `delivery_mode`

| 值 | 含义 |
|----|------|
| `push_only` | 仅推送，不合并 |
| `local_merge` | 本地合并到目标分支 |
| `pr` | 创建 PR，等待 CI，合并 PR |

### 4.3 Gate results

| 值 | 含义 |
|----|------|
| `passed` | 自动化检查通过 |
| `failed` | 自动化检查失败 |
| `skipped` | 经显式决策跳过 |
| `degraded_manual` | 未自动执行，仅生成人工清单 |
| `not_applicable` | 当前变更不适用 |

---

## 5. 幂等恢复规则

### 5.1 恢复入口

Phase 0 启动时，必须先读取 `openspec/runtime-state.yaml`：

```
文件不存在？ → 首次执行，正常开始 Phase 0
文件存在但 updated_at < 24h？ → 续接执行
文件存在但 completed/terminated？ → 询问用户是否重新开始
```

### 5.2 各状态的恢复行为

| `current_phase` | 恢复行为 |
|-----------------|---------|
| `phase0_entrance` ~ `phase4_archive` | 从该阶段重新开始（幂等：已生成的产物跳过，但提案 approve 等决策点重新询问） |
| `phase6_push` | 检查 git remote：已推送则跳过步骤 19，未推送则执行 |
| `phase6_merge` | 检查 git log：已合并则跳过步骤 20-21，未合并则执行 |
| `phase7_pr_created` | 检查 PR 是否存在：存在则读取当前状态，不存在则重新创建 |
| `phase7_ci_pending` | 检查 CI 最新状态：仍 pending → 暂停；passed → 进入 merge；failed → 进入 triage |
| `phase7_ci_triage` | 读取上次失败分类，进入修复回路或重新检查 |
| `phase7_pr_merge` | 检查 PR 是否已合并：已合并 → 完成；未合并 → 执行合并 |
| `completed` | 输出最终摘要，不重复任何操作 |
| `terminated` | 询问是否重新开始或从上次断点续接 |

### 5.3 绝对不重复的操作

| 操作 | 条件检查 |
|------|---------|
| `openspec new change` | 检查 `openspec/changes/<id>/` 是否存在 |
| `gh pr create` | 检查 runtime state 中 `pr.number` 是否存在 |
| `gh pr merge` | 检查 PR `state === 'open'` 且 CI `status === 'passed'` |
| `openspec archive` | 检查 change 是否在 `archive/` 中 |
| deploy 脚本 | 检查 `results` 中是否已有 deploy 记录 |

---

## 6. 示例

### 6.1 首次执行时（Phase 0 生成）

```yaml
change_id: add-todo-due-date
branch: feature/add-todo-due-date
current_phase: phase0_entrance
last_completed_gate: ''
delivery_mode: ''
pr: {}
ci:
  status: unknown
pending_action:
  type: ready
  detail: 流水线开始执行
results:
  unit: not_applicable
  integration: not_applicable
  verify: not_applicable
  e2e: not_applicable
  security: not_applicable
decisions: []
created_at: '2026-06-27T10:00:00Z'
updated_at: '2026-06-27T10:00:00Z'
```

### 6.2 PR 创建后 CI 等待中

```yaml
change_id: add-todo-due-date
branch: feature/add-todo-due-date
current_phase: phase7_ci_pending
last_completed_gate: pr-created
delivery_mode: pr
pr:
  number: 123
  url: https://github.com/org/repo/pull/123
  status: open
  title: 'feat: add todo due date field'
  base_branch: main
  created_at: '2026-06-27T10:30:00Z'
ci:
  status: pending
  last_checked_at: '2026-06-27T10:31:00Z'
  checks_url: https://github.com/org/repo/pull/123/checks
pending_action:
  type: wait_ci
  detail: 等待 CI 完成后继续
  since: '2026-06-27T10:30:30Z'
results:
  unit: passed
  integration: not_applicable
  verify: passed
  e2e: degraded_manual
  security: not_applicable
decisions:
  - id: '4-ext'
    at: '2026-06-27T10:25:00Z'
    choice: pr
    reason: 全栈项目选择 PR 模式进行 CI 验证
created_at: '2026-06-27T10:00:00Z'
updated_at: '2026-06-27T10:31:00Z'
```
