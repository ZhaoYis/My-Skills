# 独立 OpenSpec 技能纳入 Pipeline 状态机管理 — 实现方案

> 日期: 2026-07-26 | 状态: ✅ 已实现并通过全量验证

---

## 一、背景与问题

### 现状

当前 `opsx-dev-pipeline` 通过 `openspec/.pipeline-state/<change>.json` 管理 Phase 0-7 的状态迁移，完整追踪决策、门禁和交付信息。

但用户直接使用独立命令时：

```
/opsx:propose "add-login"  ──→  ❌ 无状态文件
/opsx:apply "add-login"    ──→  ❌ 仍无状态
/opsx-dev-pipeline          ──→  Phase 0 检测到 change 存在但无状态
                                 → "按检测结果重建状态？" ← 用户困惑
```

### 核心矛盾

独立技能（`openspec-propose`、`openspec-apply-change` 等）由 **OpenSpec CLI** (`openspec init`) 生成和维护，完全不感知 `opsx-dev-pipeline` 的状态机。而 pipeline 的状态管理是**外挂**在 OpenSpec 之上的。

### 目标

让独立技能执行时也能参与 `.pipeline-state` 状态机，使得 pipeline 后续介入时可以**精确恢复**，无需从文件系统猜测。

---

## 二、方案选型：包装模式（方案 A）

### 核心思路

```
用户敲 /opsx:propose
       │
       ▼
  增强版 opsx/commands/propose.md  ──→  Pre-flight: 检查/初始化状态
       │                                     │
       │                                     ├─ 存在 → 校验 phase 合法性
       │                                     └─ 不存在 → init + executionMode: standalone
       │
       ▼
  调用 openspec-propose SKILL.md（原逻辑不变）    ← Skill 本体零修改
       │
       ▼
  Post-flight: record-phase + decision + transition
```

**关键设计决策**：

| # | 决策 | 说明 |
|---|------|------|
| 1 | **包装模式** | Command 入口文件加入状态检查/写入，Skill 本体不变 |
| 2 | **覆盖策略** | `init` 时用增强版 command 文件覆盖 OpenSpec 原生入口，注册为 pipeline managed asset |
| 3 | **Gate 补偿** | 策略 3（分级）：过程 gate 推断，测试/验证 gate 重检，交付方式 gate 必须确认 |
| 4 | **explore 命令** | 只读上下文，不产生状态变更 |
| 5 | **向后兼容** | Schema v1→v2 需用户确认，默认 executionMode=pipeline |

---

## 三、状态 Schema v2 设计

### 3.1 完整结构

```jsonc
{
  "schemaVersion": 2,          // 从 1 升级
  "_version": 3,               // 乐观锁版本号，每次 saveState 自增
  "changeName": "add-login",
  "sourceBranch": "feature/add-login",
  "targetBranch": "main",
  "currentPhase": 2,
  "currentStep": 6,
  "status": "active",

  // ── v2 新增字段 ──
  "executionMode": "hybrid",
  // "pipeline"   — 全程由 opsx-dev-pipeline 驱动
  // "standalone" — 全程由独立 /opsx:* 命令驱动
  // "hybrid"     — 混合模式，部分 phase 由独立命令完成

  "phaseHistory": [
    {
      "phase": 1,
      "step": 5,
      "executedBy": "openspec-propose",
      "status": "completed",
      // "in-progress" — phase 进行中被中断
      // "completed"   — phase 已完成
      // "abandoned"   — phase 被放弃
      "startedAt": "2026-07-26T10:00:00Z",
      "completedAt": "2026-07-26T10:15:00Z",
      "decisions": {
        "requirementsConfirmed": true,
        "proposalApproved": true
      },
      "gatesBypassed": []
    }
  ],
  "gatesBypassed": ["review-skipped"],

  // ── 原有字段保持不变 ──
  "decisions": {},
  "review": { "round": 0, "reportPath": null, "status": "pending" },
  "tests": { "command": null, "attempts": 0, "status": "pending", "detail": null },
  "verify": { "command": null, "attempts": 0, "status": "pending", "detail": null },
  "archivePath": null,
  "delivery": { "commitSha": null, "mergeCommitSha": null, "sourcePushed": false, "targetPushed": false, "tag": null },
  "createdAt": "2026-07-26T10:00:00Z",
  "updatedAt": "2026-07-26T11:00:00Z"
}
```

### 3.2 字段语义

| 字段 | 类型 | 说明 |
|------|------|------|
| `_version` | number | 乐观锁版本号，每次 `saveState` 自增。命令读取时记录此值，写入时检查是否仍匹配——不匹配则拒绝写入并返回并发冲突错误 |
| `executionMode` | enum | 当前执行模式。pipeline 全程驱动 / standalone 独立命令 / hybrid 混合 |
| `phaseHistory[]` | array | 每个 phase 的审计记录：谁执行的、状态、何时开始/完成、做了什么决策、跳过了哪些 gate |
| `phaseHistory[i].phase` | number | Phase 编号 0-6 |
| `phaseHistory[i].executedBy` | string | 执行者标识：`"openspec-propose"` / `"pipeline"` 等 |
| `phaseHistory[i].status` | enum | `"in-progress"`（中断）/ `"completed"`（完成）/ `"abandoned"`（放弃）。Phase 0 恢复时据此区分处理策略 |
| `phaseHistory[i].startedAt` | string | phase 开始时间（ISO 8601）。首次进入 phase 时设置，不随完成时间覆盖 |
| `phaseHistory[i].completedAt` | string | phase 完成时间（ISO 8601）。`record-phase` 完成时设置。`in-progress` 状态下此字段为 null |
| `phaseHistory[i].decisions` | object | 该 phase 完成时的 decisions 快照 |
| `phaseHistory[i].gatesBypassed` | string[] | 该 phase 中被跳过的 gate 名称 |
| `gatesBypassed[]` | string[] | 全局被绕过的 gate 汇总 |

---

## 四、Phase-to-Skill 映射

| Skill | Phase | 记录的关键决策 | 满足的 Gate | Phase Step |
|-------|-------|---------------|-------------|------------|
| `openspec-propose` | 1 | `requirementsConfirmed`, `proposalApproved` | `proposalApproved` (→ Phase 2) | 3-5 |
| `openspec-apply-change` | 2 | `implementationConfirmed`, `reviewDisposition` | `implementationConfirmed` (→ Phase 3/4) | 6-8 |
| `openspec-verify-change` | 5 (verify) | (使用 `attempt verify`) | `verify.status` (→ Phase 6) | 16 |
| `openspec-sync-specs` | 5 (sync) | 无 | 无 | 17 |
| `openspec-archive-change` | 5 (archive) | `postArchiveAction` | `archivePath`, `postArchiveAction` (→ Phase 6) | 15, 18-19 |
| `openspec-explore` | N/A | 无 | 无 | N/A |

---

## 五、Gate 补偿策略（策略 3：分级处理）

```
┌──────────────────────────────────────────────────────────────┐
│ Gate                    │ 策略      │ 行为                    │
├──────────────────────────┼──────────┼─────────────────────────┤
│ proposalApproved        │ infer     │ phaseHistory 有 Phase    │
│                          │           │ 2+ 记录 → 自动 true     │
│ implementationConfirmed │ infer     │ phaseHistory 有 Phase    │
│                          │           │ 3+ 记录 → 自动 true     │
│ tests.status            │ reverify  │ 未记录 → 询问用户:       │
│                          │           │ passed/failed/skipped/  │
│                          │           │ 重跑                    │
│ verify.status           │ reverify  │ 未记录 → 询问用户        │
│ postArchiveAction       │ confirm   │ 任何模式都必须询问:      │
│                          │           │ merge/push-only/local   │
└──────────────────────────────────────────────────────────────┘
```

**推断原则**：如果独立技能已经完成了某个 phase 之后的 phase，说明用户在语义上已经隐式通过了前面的 gate。例如：如果 `phaseHistory` 中有 Phase 2 (apply) 的记录，说明用户已经看了提案并决定实施 → `proposalApproved` 可安全推断为 true。

**确认原则**：`postArchiveAction`（merge vs push-only）无法从任何文件事实推断——这是纯用户意图，必须询问。

---

## 六、状态迁移规则扩展

### 6.1 `allowedTransition` — executionMode 感知

```javascript
function allowedTransition(from, to, executionMode = 'pipeline') {
  const base = {
    0: [0, 1],
    1: [1, 2],
    2: [1, 2, 3, 4],
    3: [2, 3, 4],
    4: [4, 5],
    5: [1, 2, 5, 6],
    6: [6],
  };

  // pipeline 模式：严格迁移
  if (executionMode === 'pipeline') {
    return base[from]?.includes(to) ?? false;
  }

  // standalone / hybrid 模式：
  // - 允许向前跳 phase（跳过中间步骤，记录在 gatesBypassed）
  // - 回退限于 Phase 1 或 2（修复回路）
  if (to > from) return true;
  if (to === 1 || to === 2) return true;
  return base[from]?.includes(to) ?? false;
}
```

### 6.2 `applyGateInference` — 推断 + 持久化（在 gate 校验前执行）

推断逻辑从 `validateGates` 中分离出来，在 `transition` 命令中先执行、先持久化，再用更新后的 state 做 gate 校验。这样推断是可审计的，且不与 validate 的只读语义混淆。

```javascript
function applyGateInference(state) {
  const mode = state.executionMode || 'pipeline';
  if (mode === 'pipeline') return;  // pipeline 模式不做推断

  // 推断：phaseHistory 中有 Phase 2+ 记录 → 用户隐式确认了提案
  if (!state.decisions.proposalApproved && hasPhaseInHistory(state, 2)) {
    state.decisions.proposalApproved = true;
  }
  // 推断：phaseHistory 中有 Phase 3+ 记录 → 用户隐式确认了实施完成
  if (!state.decisions.implementationConfirmed && hasPhaseInHistory(state, 3)) {
    state.decisions.implementationConfirmed = true;
  }
  // 注意：tests.status、verify.status、postArchiveAction 不做推断
  // 这些由 Phase 0 恢复时显式询问用户（reverify / confirm 策略）
}

function hasPhaseInHistory(state, minPhase) {
  return (state.phaseHistory || []).some(e => e.phase >= minPhase);
}
```

### 6.3 `validateGates` — 保持纯函数，只读不写

```javascript
function validateGates(state, from, to) {
  if (to === 2 && state.decisions.proposalApproved !== true) {
    return ['proposal-approval-required', '进入 Phase2 前必须记录 proposalApproved=true'];
  }
  if (from === 2 && to >= 3 && state.decisions.implementationConfirmed !== true) {
    return ['implementation-confirmation-required', '离开 Phase2 前必须确认实施摘要'];
  }
  if (to === 5 && !['passed', 'skipped', 'debt-recorded'].includes(state.tests.status)) {
    return ['test-gate-required', '进入 Phase5 前必须记录测试状态'];
  }
  if (to === 6) {
    if (!['passed', 'skipped'].includes(state.verify.status))
      return ['verify-gate-required', '进入 Phase6 前必须记录 verify 通过或经用户确认跳过'];
    if (!state.archivePath)
      return ['archive-required', '进入 Phase6 前必须记录归档路径'];
    // postArchiveAction 任何模式下都必须用户显式选择，不做推断
    if (!['merge', 'push-only', 'local-only'].includes(state.decisions.postArchiveAction))
      return ['post-archive-decision-required', '进入 Phase6 前必须记录归档后交付方式'];
  }
  if (to === 7) {
    if (state.decisions.postArchiveAction !== 'merge')
      return ['merge-gate-required', '进入 Phase7 前必须记录 postArchiveAction=merge'];
    if (!state.delivery.commitSha)
      return ['commit-required', '进入 Phase7 前必须记录 delivery.commitSha'];
    if (!state.delivery.sourcePushed)
      return ['source-push-required', '进入 Phase7 前必须推送源分支'];
  }
  return null;
}
```

### 6.4 `transition` 命令中的调用顺序

```javascript
// transition 命令处理中：
applyGateInference(state);                                   // 1. 推断缺失的 gate
const inferred = await saveState(root, state);               // 2. 持久化推断结果
if (!inferred) return;                                       // 3. 写入失败则退出

const gateError = validateGates(state, state.currentPhase, toPhase);  // 4. 用已持久化的 state 校验
if (gateError) {
  emitError(gateError[0], gateError[1], 'complete-required-gate', EXIT_INVALID_TRANSITION);
} else {
  state.currentPhase = toPhase;
  state.currentStep = toStep;
  state.status = 'active';
  if (await saveState(root, state)) output({ status: 'ok', state });
}
```

---

## 七、新增状态命令

### 7.1 `record-phase`

```bash
node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs record-phase "<change>" <phase> <step> <executed-by> [--start] [--abandon] [bypassed-gates...]
```

行为：
1. 校验 phase 范围 0-6
2. 查找 `phaseHistory` 中是否存在同一 phase、同一 `executedBy` 且 `status: "in-progress"` 的 entry（Phase 5 可同时包含 verify/sync/archive，必须避免串写）：
   - **存在且不带 `--start`** → 更新该 entry：`status: "completed"`, `completedAt`, `decisions`, `gatesBypassed`
   - **不存在或带 `--start`** → 追加新 entry：`status: "in-progress"`, `startedAt`, `completedAt: null`
   - **带 `--abandon`** → 标记 entry 为 `status: "abandoned"`
3. 若 bypassed-gates 非空，追加到 `state.gatesBypassed`
4. 若当前 `executionMode === 'pipeline'`（即首次 record-phase），切换为 `'hybrid'`
5. 乐观锁检查 + 原子写入状态文件

**断续恢复示例**：

```
# 首次 apply（开始）
node ... record-phase "add-login" 2 6 openspec-apply-change --start
# → phaseHistory: [{ phase: 2, status: "in-progress", startedAt: "...", completedAt: null }]

# 第二天继续 apply（完成）
node ... record-phase "add-login" 2 6 openspec-apply-change
# → 找到 in-progress entry → 更新 status: "completed", completedAt: "..."
```

### 7.2 `migrate-schema`

```bash
node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs migrate-schema "<change>" [--confirm]
```

行为：
- 已是 v2 → 返回 `{ status: 'ok', reason: 'already-v2', state }`
- 无 `--confirm` → 返回 `{ status: 'prompt', reason: 'migration-requires-confirmation', detail: '...' }`
- 带 `--confirm` → 升级字段，保留所有 v1 数据，写回

### 7.3 乐观锁并发保护

每次 `saveState` 时 `_version` 自增。每个命令在 `loadState` 时记录当前 `_version`（内存字段 `_readVersion`），在 `saveState` 时检查磁盘文件的 `_version` 是否仍等于 `_readVersion`。

```javascript
async function loadState(root, changeName) {
  // ... 读取文件 ...
  const state = JSON.parse(raw);
  state._readVersion = state._version;  // 内存快照，不写入磁盘
  return state;
}

async function saveState(root, state) {
  // 重新读取磁盘上的当前版本，检测并发修改
  const currentOnDisk = await tryReadState(root, state.changeName);
  if (currentOnDisk && currentOnDisk._version !== state._readVersion) {
    emitError(
      'pipeline-state-concurrent-modification',
      `状态文件已被其他会话修改（读取版本: ${state._readVersion}，磁盘版本: ${currentOnDisk._version}）`,
      'reload-state-and-retry',
      EXIT_STATE_IO,
    );
    return false;
  }
  state._version = (state._version || 0) + 1;
  state.updatedAt = new Date().toISOString();
  // ... 原子写入（临时文件 + rename）...
}
```

**设计要点**：
- `_readVersion` 是内存中的临时字段，不写入磁盘
- 冲突时返回结构化错误 `reason: 'pipeline-state-concurrent-modification'`，由 Agent 决定重试或暂停
- 单用户、单终端场景几乎不会触发；多终端场景提供安全网

### 7.4 状态一致性自检

`saveState` 成功后，调用方可选执行验证：

```bash
node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs get "<change>"
```

验证返回的 state 与写入后的预期一致（currentPhase、decisions 等关键字段）。如不一致，输出警告提示用户检查。

## 八、Command 模板设计

### 8.1 模板结构模式

所有 6 个 command 模板遵循统一的三段式结构：

```markdown
---
name: "OPSX: <Name>"
description: <描述>
allowed-tools: Bash(openspec:*)
---

## Pipeline Integration (v2)

### Pre-flight: State Awareness
1. 推断 change 名称
2. 读取 pipeline state → 校验 phase 合法性
3. 无状态时初始化（standalone 模式）

### Execute
加载并遵循 `{{skillsDir}}/openspec-<name>/SKILL.md` 的完整逻辑

### Post-flight: Record State
1. 记录 phase 完成（`record-phase`）
2. 记录 decisions
3. 执行 phase transition
4. 展示状态感知的输出摘要
```

### 8.2 各模板关键差异

| 模板 | pre-flight 特殊逻辑 | post-flight 特殊逻辑 |
|------|--------------------|--------------------|
| `propose.md.hbs` | Phase 0/1 正常；Phase 2+ 警告 | record decisions: requirementsConfirmed, proposalApproved; transition 2 6 |
| `apply.md.hbs` | Phase 2 继续；Phase 3+ 允许（修复） | record decision: implementationConfirmed; **AskQuestion** 下一步：跳过审查进入测试/归档 → transition 4 13 / 继续审查 → transition 3 9（提示用 pipeline）/ 暂停 |
| `archive.md.hbs` | 检查 verify/test gate | set archivePath; **AskQuestion** postArchiveAction; transition 6 20 |
| `verify.md.hbs` | 检查是否有 change | attempt verify; record-phase 5 16 |
| `sync.md.hbs` | 检查是否有 change | record-phase 5 17 |
| `explore.md.hbs` | 检查 active change → 展示上下文 | 无状态变更 |

### 8.3 `propose.md.hbs` 示例

```markdown
---
name: "OPSX: Propose"
description: Propose a new change with all artifacts generated in one step
allowed-tools: Bash(openspec:*)
category: Workflow
tags: [workflow, artifacts, experimental]
---

Propose a new change — create the change and generate all artifacts in one step.

## Pipeline Integration (v2)

### Pre-flight: State Awareness

1. **Detect change name** from user input. If none provided, ask via AskUserQuestion.

2. **Check pipeline state:**
   ```bash
   node {{skillsDir}}/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs get "<name>"
   ```

   **If exit code 0 (state exists):**
   - Check `currentPhase` and `executionMode`
   - Phase 0/1 → Normal. Continue to Execute.
   - Phase 2+ → Warn: "Pipeline suggests work is already in progress."
     - AskQuestion: "Re-propose (update artifacts)" / "Continue from current phase" / "Cancel"
   - executionMode "standalone" or "hybrid" → Note: continuing in hybrid mode

   **If exit code 10 (not found):**
   - Initialize state in standalone mode:
     ```bash
     CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
     node {{skillsDir}}/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs init "<name>" "$CURRENT_BRANCH"
     node {{skillsDir}}/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs transition "<name>" 1 3
     ```

### Execute

Load and follow `{{skillsDir}}/openspec-propose/SKILL.md`.

Implement the original openspec-propose logic: create change directory, generate artifacts in dependency order, handle user confirmations.

### Post-flight: Record State

After the proposal is complete and user has confirmed:

```bash
# Record phase completion
node {{skillsDir}}/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs record-phase "<name>" 1 5 openspec-propose

# Record decisions
node {{skillsDir}}/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs decision "<name>" requirementsConfirmed true
node {{skillsDir}}/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs decision "<name>" proposalApproved true

# Transition to Phase 2
node {{skillsDir}}/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs transition "<name>" 2 6
```

### State-Aware Output

After completion, show:

- Change name and location
- Pipeline phase: ✅ Phase 1 complete
- Next actions:
  - **Standalone mode**: "Run `/opsx:apply <name>` to implement"
  - **Pipeline takeover**: "Run `/opsx-dev-pipeline <name>` for the full gated pipeline"
```

### 8.4 Command 模板防御性设计

Command 模板是 AI Agent 在运行时解析的 Markdown 指令。为提高可靠性，每个模板必须包含以下防御机制：

**a. Exit Code 速查表**

每个涉及 `dev-pipeline-state.mjs` 命令的步骤必须附带：

```markdown
| exit code | reason | 行动 |
|-----------|--------|------|
| 0 | 成功 | 读取返回的 state，继续下一步 |
| 10 | 状态不存在 | 执行 init + transition |
| 11 | 非法迁移/gate 未满足 | 暂停，展示详情给用户确认 |
| 12 | IO 错误/并发冲突 | 重试一次；仍失败则暂停，报告用户 |
```

**b. 状态一致性自检**

Post-flight 所有状态命令执行完毕后，必须：
1. 执行 `get "<change>"` 验证状态落地
2. 对比 `currentPhase` 是否与预期一致
3. 不一致 → 显式警告用户，不得静默继续

**c. 硬性约束声明**

在模板开头声明：
> **状态命令失败时，不得静默继续。** 任何 `dev-pipeline-state.mjs` 命令返回非零 exit code 时，必须暂停并报告用户。禁止跳过 pre-flight 或 post-flight。

**d. 顺序依赖标注**

在 post-flight 中显式标注命令之间的依赖关系：
```markdown
### Post-flight: Record State

以下命令**必须按序执行**，每步完成后检查 exit code：

1. `record-phase`  ← 必须先执行，后续 gate 推断依赖 phaseHistory
2. `decision`      ← 依赖 record-phase 已写入
3. `transition`    ← 依赖 decision 已写入（gate 校验需要 proposalApproved）
```

---

## 九、Phase 0 恢复增强

### `phase-0-entrance.md` 新增 2.c 节

```markdown
### 2.c 检测到非 pipeline 执行模式

当状态中 `executionMode` 为 `standalone` 或 `hybrid` 时：

1. **展示 phaseHistory 摘要**（时间线形式）：
   ```
   检测到 change 由独立命令完成：
   ✅ Phase 1 (propose) — openspec-propose — 2026-07-26 10:15
   ✅ Phase 2 (apply)   — openspec-apply-change — 2026-07-26 11:00
   ⬚ Phase 3 (review)  — 被跳过 [gatesBypassed: review-skipped]
   ⬚ Phase 4 (tests)   — 未执行
   ```

2. **展示 gatesBypassed 清单**

3. **执行 gate 补偿询问：**
   - `tests.status` 未记录 → AskQuestion: "测试是否已通过？" → passed / failed / skipped / 重新运行
   - `verify.status` 未记录 → AskQuestion: "验证是否已通过？" → passed / failed / skipped / 重新验证
   - `postArchiveAction` 未记录 → AskQuestion: "如何交付？" → merge / push-only / local-only

4. **确认续接方式**（AskQuestion）：
   - "从当前 Phase 继续（推荐）" → 直接进入当前 phase
   - "重新开始完整流水线" → 重置到 Phase 0，executionMode 改为 pipeline
   - "终止流程" → 退出
```

---

## 十、文件变更清单

| # | 文件 | 操作 | 风险 |
|---|------|------|------|
| 1 | `templates/common/skills/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs` | **修改**: v2 schema + record-phase + migrate-schema + allowedTransition 扩展 + validateGates 扩展 | 高 |
| 2 | `templates/common/commands/opsx/propose.md.hbs` | **新建** | 中 |
| 3 | `templates/common/commands/opsx/apply.md.hbs` | **新建** | 中 |
| 4 | `templates/common/commands/opsx/archive.md.hbs` | **新建** | 中 |
| 5 | `templates/common/commands/opsx/verify.md.hbs` | **新建** | 中 |
| 6 | `templates/common/commands/opsx/sync.md.hbs` | **新建** | 低 |
| 7 | `templates/common/commands/opsx/explore.md.hbs` | **新建** | 低 |
| 8 | `src/core/assets/manifest.ts` | **修改**: 新增 6 个 asset definition | 低 |
| 9 | `templates/common/skills/opsx-dev-pipeline/references/phase-0-entrance.md` | **修改**: 新增 2.c standalone/hybrid 恢复 | 中 |
| 10 | `templates/common/skills/opsx-dev-pipeline/references/phase-5-archive.md` | **修改**: Step 16 增加 standalone 感知注释 | 低 |
| 11 | `templates/common/skills/opsx-dev-pipeline/SKILL.md.hbs` | **修改**: 状态协议段落增加新命令 | 低 |
| 12 | `test/integration/pipeline-state.test.ts` | **修改**: 新增 v2 测试用例 | 中 |

---

## 十一、实施顺序

| 步骤 | 内容 | 风险 |
|------|------|------|
| 1 | ✅ `dev-pipeline-state.mjs`: init 产出 schemaVersion 2 + 新增 mutablePaths | 低 |
| 2 | ✅ `dev-pipeline-state.mjs`: 新增 `migrate-schema` 命令 | 低 |
| 3 | ✅ `dev-pipeline-state.mjs`: 新增 `record-phase` 命令 | 低 |
| 4 | ✅ `dev-pipeline-state.mjs`: 修改 `allowedTransition`（executionMode 参数） | 中 |
| 5 | ✅ `dev-pipeline-state.mjs`: 修改 `validateGates`（分级补偿） | 高 |
| 6 | ✅ `pipeline-state.test.ts`: 新增 v2 测试 | 中 |
| 7 | ✅ 创建 6 个 command 模板 `.hbs` 文件 | 中 |
| 8 | ✅ `manifest.ts`: 注册 6 个新 asset | 低 |
| 9 | ✅ `phase-0-entrance.md`: 新增 standalone/hybrid 恢复 | 中 |
| 10 | ✅ `phase-5-archive.md`: 增加 standalone 感知 | 低 |
| 11 | ✅ `SKILL.md.hbs`: 更新状态协议 | 低 |
| 12 | ✅ 全量验证: typecheck + lint + test + pack:check | 中 |

---

## 十二、测试策略

### 单元测试 (Vitest)

- `init` 产出 schemaVersion 2 + executionMode pipeline + 空 phaseHistory/gatesBypassed
- `record-phase` 追加 phaseHistory + pipeline → hybrid 自动切换
- `migrate-schema` 无 --confirm 返回 prompt，带 --confirm 升级，已 v2 幂等
- standalone 模式允许 Phase 1 → 3 前向跳转（pipeline 模式拒绝）
- 多次 record-phase 构建完整历史 + gatesBypassed 汇总
- `proposalApproved` gate 在 hybrid 模式下自动推断（phaseHistory 有 Phase 2）
- `postArchiveAction` 在任何模式下都不能自动通过

### 模板测试

- 6 个 `.hbs` 模板正确渲染，`{{skillsDir}}` / `{{commandsDir}}` 变量替换无误
- 渲染后产物包含正确的 `dev-pipeline-state.mjs` 命令路径

### E2E 验证

```bash
npm run typecheck     # 零错误
npm run build         # 零错误
npm run lint          # 零阻断
npm test              # 97 现有 + 新增 v2 测试
npm run pack:check    # 产物完整性
```

---

## 十三、向后兼容

| 场景 | 处理 |
|------|------|
| 现有 v1 状态文件 | 继续正常工作；Phase 0 检测到 v1 时提示迁移（需确认） |
| `init` 新 change | 直接产出 v2 schema |
| `migrate-schema` 无 --confirm | 返回结构化 prompt，不修改文件 |
| `migrate-schema --confirm` | 升级到 v2，保留所有 v1 字段 |
| 已 v2 再次 migrate | 幂等返回 `already-v2` |
| 默认 `executionMode` | `"pipeline"` — 与 v1 行为完全一致 |
| `record-phase` 对 v1 状态 | 如果 v1 状态文件存在，先要求迁移到 v2 |
| 用户使用增强版 command 入口 | 静默自动初始化状态（不询问），确保每次独立命令都加入状态追踪。若用户确实不想追踪状态，可绕过 command 入口直接调用 SKILL.md |

---

## 十四、关键设计原理

### 为什么 `record-phase` 是独立命令而不是扩展 `transition`

`transition` 是 gated、受限的操作（必须满足 gate 条件）。`record-phase` 是 append-only 审计日志，如实记录发生了什么，无论 gate 状态。两者职责分离，保持状态机迁移逻辑的纯净性。

### 为什么 `executionMode` 在首次 `record-phase` 时从 pipeline 切换到 hybrid

这是给 Phase 0 恢复的信号：有部分 phase 是在 pipeline 外部完成的。pipeline 可以利用 phaseHistory 精确重建进度，并执行 gate 补偿。

### 为什么 explore 不产生状态变更

Explore 是一个纯思考辅助工具，不产生任何制品。但它可以读取当前 active change 的上下文（phase、decisions），给用户提供更好的探索体验。

### 为什么 command 模板引用 Skill 路径而不是内嵌逻辑

保持了 Skill 行为的单一事实来源（OpenSpec 生成的 SKILL.md 文件）。Command 入口只是薄包装，加入状态感知。OpenSpec 升级 Skill 时不会影响包装逻辑。
