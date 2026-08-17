# Review 状态集合化 & Review→Proposal 流程修复方案

## 问题概述

两个需要修复的 Bug：

### 问题 1：`review` 应该是集合，但当前是扁平对象

当前 `dev-pipeline-state.mjs` 中 `review` 状态的初始化（第 476 行）：

```javascript
review: { round: 0, reportPath: null, status: 'pending' }
```

每次调用 `attempt review <status>` 时（第 623-658 行）：
- 自增 `review.round` 计数器
- **覆盖** `review.status` 为新值
- **覆盖** `review.reportPath`（通过前一步 `set` 设置）

**后果**：当审查经过多轮（如：发现 issues → 修复 → 重新审查），每一轮的报告路径、状态、时间戳等历史信息全部丢失，只保留最后一轮。

### 问题 2：用户选择「根据 Review 生成 Proposal」时，系统跳过 Proposal 直接写代码

在 `phase-3-review.md.hbs` 的 Step12 决策点 3 中，当审查发现问题时，用户可以选择「生成修复提案并应用」。修复子流程的描述是：

> 1. 新建修复 change `fix-cr-<type>`
> 2. 初始化独立状态并生成制品（同 Phase1 Step4）
> 3. 修复提案门禁（同 Phase1 决策点 1）
> 4. 逐任务实施修复
> 5. 归档修复 change
> 6. 回到 Step10 重新审查

**实际行为**：AI 在执行时跳过步骤 2-3（生成 proposal.md 等制品、用户确认），直接开始改代码。

**根因分析**：
1. 修复子流程要求创建一个**独立的** fix change，流程过重，AI 倾向于走捷径
2. Phase 3 的允许跳转 `[2, 3, 4]`，没有回到 Phase 1 的路径
3. `DeterministicPipelineExecutor.ts` 的 `executePhase3` 完全未处理 `issues-found` 路径
4. 没有状态字段跟踪 fix proposal 的生成

---

## 设计方案

### 变更 1：将 `review` 从扁平对象重构为回合集合

**新 Schema：**

```json
{
  "review": {
    "currentRound": 2,
    "rounds": [
      {
        "round": 1,
        "reportPath": "openspec/review/2026-07-27-14-30-feature-fix-pipeline-review.md",
        "status": "issues-found",
        "timestamp": "2026-07-27 14:30:00",
        "decisions": {
          "reviewDisposition": "fix-and-rereview",
          "fixProposalPath": "openspec/changes/my-change/fix-proposal-round-1.md",
          "fixProposalGenerated": true,
          "fixProposalApproved": true,
          "fixApplied": true
        }
      },
      {
        "round": 2,
        "reportPath": "openspec/review/2026-07-27-15-00-feature-fix-pipeline-review-round-2.md",
        "status": "passed",
        "timestamp": "2026-07-27 15:00:00",
        "decisions": {}
      }
    ],
    "reportPath": "openspec/review/2026-07-27-15-00-feature-fix-pipeline-review-round-2.md",
    "status": "passed"
  }
}
```

**设计要点**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `review.currentRound` | `number` | 当前回合计数（替代原 `review.round`） |
| `review.rounds[]` | `array` | 每轮审查的历史记录集合 |
| `review.rounds[n].round` | `number` | 回合编号 |
| `review.rounds[n].reportPath` | `string \| null` | 该轮审查报告路径（可为 `null`，适用无变更可审等边界场景） |
| `review.rounds[n].status` | `string` | 该轮结果：`passed` / `issues-found` |
| `review.rounds[n].timestamp` | `string` | 记录时间 |
| `review.rounds[n].decisions` | `object` | 该轮时的 `state.decisions` 快照（自动捕获修复提案相关 decisions） |
| `review.reportPath` | `string \| null` | **兼容字段**：始终等于最后一轮的 `reportPath` |
| `review.status` | `string` | **兼容字段**：始终等于最后一轮的 `status` |

**向后兼容策略**：
- `review.status` 和 `review.reportPath` 保留在顶层，始终镜像最后一轮的值
- 现有的 validators 和测试引用 `review.status` 无需修改
- `review.round` 重命名为 `review.currentRound`，需要批量替换引用

### 变更 2：强制 Review → Fix Proposal 必须先生成提案文档

**核心思路**：不要求创建独立 fix change，而是在当前 change 内完成「审查发现 → 生成修复提案 → 用户确认 → 实施修复 → 重新审查」的闭环。修复提案路径通过 `decision` 命令记录，`attempt review` 时自动快照到该轮 round 条目的 `decisions` 中。

**流程改造**：

```
审查发现问题
  ↓
用户选择「生成修复提案并应用」
  ↓
AI 生成 fix proposal 文档（proposal.md 格式，描述修复范围和方法）
  ↓ 记录: decision fixProposalPath "..."
  ↓       decision fixProposalGenerated true
  ↓
【决策点 3a：修复提案确认】使用 {{askTool}}
  - 确认修复提案，开始修复 → 继续
  - 修改修复提案 → 回到提案编写
  - 终止流程 → 退出
  ↓ 记录: decision fixProposalApproved true
  ↓
AI 按提案逐任务实施修复
  ↓ 记录: decision fixApplied true
  ↓
重新审查（回到 Step10）
  → attempt review <status> 自动快照 decisions 到新 round 条目
```

**状态追踪方式**：只用 `decision` 命令，不新增 `mutablePaths` 字段。

- `decision fixProposalPath "..."` — 记录修复提案文档路径
- `decision fixProposalGenerated true` — 标记提案文档已生成
- `decision fixProposalApproved true` — 标记用户已批准提案
- `decision fixApplied true` — 标记修复已实施

`attempt review` 调用时自动对 `state.decisions` 做快照存入 round 条目。跨轮读取全局 `decisions` 的代码应理解其"当前值"语义；每轮独立快照确保历史记录不被覆盖。

---

## 设计决策汇总

以下决策已通过评审确认：

| # | 决策点 | 选择 |
|---|--------|------|
| 1 | Schema 版本策略 | 显式升级到 v3，通过 `migrate-schema --confirm` 触发 |
| 2 | 兼容字段命名 | 保留 `review.status` / `review.reportPath`，内部结构改为 `currentRound` + `rounds[]` |
| 3 | 上限检查逻辑 | 检查**连续**最近 3 轮是否都是 `issues-found`（中间有 `passed` 则重置） |
| 4 | 修复提案范围 | 内联在当前 change 内，生成 `fix-proposal-round-N.md`，不创建独立 fix change |
| 5 | `attempt` 前置校验 | 允许 `reportPath` 为 `null`（无变更可审等边界场景） |
| 6 | 修复提案追踪方式 | 只用 `decision` 命令，`attempt review` 自动快照 `decisions` 到 round 条目，不做自动清理 |
| 7 | Executor 改造范围 | 扩展 `executePhase3`，在 `ScenarioConfig` 新增 `reviewDisposition: 'fix-and-rereview'` |
| 8 | 迁移后暂存字段 | `review.reportPath` 重置为 `null`，新一轮审查从干净状态开始 |
| 9 | `mutablePaths` 去留 | **移除** `review.status`，只保留 `review.reportPath` |
| 10 | 是否加暂存字段 | **不加** `review.fixProposalPath` 到 `mutablePaths`，`decision` 命令已足够 |
| 11 | `ensureMetaFields` | 不修改。`attempt` 命令内部做防御性处理（`rounds` 非数组则初始化为 `[]`） |

---

## 修改文件清单

### 核心文件（模板源）：

| # | 文件 | 变更内容 |
|---|------|----------|
| 1 | `templates/common/skills/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs` | Schema v3、review 集合结构、`attempt` 命令重构、migration |
| 2 | `templates/common/skills/opsx-dev-pipeline/references/phase-3-review.md.hbs` | 修复子流程重写、决策点 3a 门禁 |
| 3 | `templates/common/skills/opsx-dev-pipeline/SKILL.md.hbs` | 新增 fix proposal 约束 |

### 测试文件：

| # | 文件 | 变更内容 |
|---|------|----------|
| 4 | `test/integration/pipeline-state.test.ts` | 新增 rounds 集合测试、migration 测试、更新 `review.round` → `review.currentRound` |
| 5 | `src/validators/PhaseValidators.ts` | 更新 `PipelineState` 接口、`validatePhase3` 断言 |
| 6 | `scenarios/error-recovery/review-fix-loop.test.ts` | 验证 rounds 历史、连续失败上限 |
| 7 | `src/harness/DeterministicPipelineExecutor.ts` | 增加 `fix-and-rereview` 路径 |

### 同步文件（模板变更后同步）：

| # | 文件 |
|---|------|
| 8 | `test-space/snake-game/.claude/skills/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs` |
| 9 | `test-space/snake-game/.cursor/rules/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs` |
| 10 | `test-space/snake-game/.codex/prompts/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs` |

---

## 实现步骤

### ✅ Step 1：`dev-pipeline-state.mjs` — Schema 升级

**✅ 1a. 升级 `SCHEMA_VERSION`：**

```javascript
const SCHEMA_VERSION = 3;  // 原值为 2
```

**✅ 1b. 更新 `init` 中的 review 初始值：**

```javascript
review: {
  currentRound: 0,
  rounds: [],
  reportPath: null,
  status: 'pending',
},
```

**✅ 1c. 更新 `mutablePaths`——移除 `review.status`，保留 `review.reportPath`：**

```javascript
const mutablePaths = new Set([
  'sourceBranch',
  'targetBranch',
  'executionMode',
  'featureInfo',
  'featureInfo.featureId',
  'featureInfo.featureUrl',
  'archivePath',
  'review.reportPath',
  // 'review.status',        ← 移除，由 attempt 命令自动维护
  'tests.command',
  'tests.status',
  'tests.detail',
  'verify.command',
  'verify.status',
  'verify.detail',
  'delivery.commitSha',
  'delivery.mergeCommitSha',
  'delivery.sourcePushed',
  'delivery.targetPushed',
  'delivery.tag',
]);
```

注意：`review.currentRound` 和 `review.rounds` **不**加入 `mutablePaths`，只能通过 `attempt` 命令自动管理。

**✅ 1d. 更新 `attemptRules`——counter 改为 `currentRound`：**

```javascript
const attemptRules = {
  review: {
    statuses: ['passed', 'issues-found'],
    failureStatus: 'issues-found',
    counter: 'currentRound',
  },
  tests: { statuses: ['passed', 'failed'], failureStatus: 'failed', counter: 'attempts' },
  verify: { statuses: ['passed', 'failed'], failureStatus: 'failed', counter: 'attempts' },
};
```

**✅ 1e. 重构 `attempt` 命令中的 review 处理——连续 3 轮检查：**

```javascript
} else if (command === 'attempt') {
  const [scope, attemptStatus] = args;
  const rule = attemptRules[scope];
  if (!rule?.statuses.includes(attemptStatus)) {
    // ... 错误处理（不变）
  } else if (scope === 'review') {
    // --- REVIEW: 管理 rounds 集合 ---
    // 防御性处理：未迁移的状态
    if (!Array.isArray(state.review.rounds)) {
      state.review.rounds = [];
      state.review.currentRound = Number(state.review.round) || 0;
    }

    const lastRecordedRound = Number(state.review.rounds.at(-1)?.round ?? 0);
    const nextRound = Math.max(
      Number(state.review.currentRound) || 0,
      lastRecordedRound,
      state.review.rounds.length,
    ) + 1;
    const reportPath = state.review.reportPath || null;
    state.review.currentRound = nextRound;

    const roundEntry = {
      round: nextRound,
      reportPath,
      status: attemptStatus,
      timestamp: formatLocalTime(),
      decisions: { ...state.decisions },
    };

    state.review.rounds.push(roundEntry);
    state.review.status = attemptStatus;
    state.review.reportPath = reportPath;  // 兼容字段镜像最后一轮

    // 上限检查：连续最近3轮是否都是 issues-found
    const lastThree = state.review.rounds.slice(-3);
    const limitReached =
      lastThree.length >= 3 &&
      lastThree.every((r) => r.status === 'issues-found');

    if (limitReached) {
      state.status = 'paused';
      state.pauseReason = 'review-attempt-limit-reached';
    }

    if (await saveState(root, state)) {
      if (limitReached) {
        output({
          status: 'error',
          reason: 'review-attempt-limit-reached',
          detail: 'review 已连续记录 3 轮 issues-found，流水线已暂停',
          nextAction: 'manual-intervention-required',
          state,
        }, EXIT_INVALID_TRANSITION);
      } else {
        output({ status: 'ok', state });
      }
    }
  } else {
    // tests / verify 逻辑不变
    // ...
  }
}
```

**✅ 1f. 新增 `migrateReviewToV3` 函数：**

```javascript
function migrateReviewToV3(state) {
  if (!Array.isArray(state.review?.rounds)) {
    const oldRound = Number(state.review?.round ?? 0);
    const oldStatus = String(state.review?.status ?? 'pending');
    const oldReportPath = state.review?.reportPath || null;

    const rounds = [];
    if (oldRound > 0 && oldStatus !== 'pending') {
      rounds.push({
        round: oldRound,
        reportPath: oldReportPath,
        status: oldStatus,
        timestamp: state.updatedAt || formatLocalTime(),
        decisions: { ...(state.decisions || {}) },
      });
    }

    state.review = {
      rounds,
      currentRound: oldRound,
      reportPath: null,   // 迁移后重置为 null，新一轮审查从干净状态开始
      status: oldStatus,
    };
  }

  state.schemaVersion = SCHEMA_VERSION;
  return state;
}
```

**✅ 1g. 增加旧版 Schema → V3 迁移链：**

```javascript
function migrateToLatestSchema(state) {
  state._version = diskVersion(state);
  state.executionMode = state.executionMode || 'pipeline';
  state.phaseHistory = Array.isArray(state.phaseHistory) ? state.phaseHistory : [];
  state.gatesBypassed = Array.isArray(state.gatesBypassed) ? state.gatesBypassed : [];
  return migrateReviewToV3(ensureMetaFields(state));
}
```

**✅ 1h. 更新 `migrate-schema` 命令：**

- 已是最新 → 输出 `already-v3`
- 需要迁移 → `migration-requires-confirmation` 提示（文案中提及 v3 / review rounds 集合）
- `--confirm` → 执行迁移，链式处理 V1→V2→V3

**✅ 1i. 更新 `record-phase` 的 Schema 版本校验文案**（"Schema v2" → "Schema v3"）。

### ✅ Step 2：`phase-3-review.md.hbs` — 修复子流程重写

**替换原修复子流程（第 70-78 行）为：**

```markdown
## 修复子流程（「生成修复提案并应用」）

**强制执行顺序，禁止跳过任何步骤：**

### Step R1：生成修复提案文档

根据审查报告确定修复 scope（如 `fix-cr-null-check`、`fix-cr-security`），
在 `openspec/changes/<name>/` 下创建 `fix-proposal-round-<N>.md`，内容包含：
- 问题描述（引用审查报告中的发现）
- 修复方案（具体到文件和修改内容）
- 影响范围评估

创建文件后记录：
```bash
node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs decision "<name>" fixProposalPath '"openspec/changes/<name>/fix-proposal-round-<N>.md"'
node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs decision "<name>" fixProposalGenerated true
```

**禁止在生成提案文档前修改任何源代码。**

### Step R2：修复提案门禁（用户确认）

使用 {{askTool}} 展示修复提案摘要，选项：
- `批准修复提案，开始实施` → 进入 Step R3
- `修改提案内容` → 回到 Step R1
- `放弃修复，回到决策点 3` → 回到 Step12

批准后记录：
```bash
node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs decision "<name>" fixProposalApproved true
```

**禁止在用户批准前修改任何源代码。**

### Step R3：实施修复

逐任务实施修复（参照 Phase2 Step6-7），完成后记录：
```bash
node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs decision "<name>" fixApplied true
```

### Step R4：重新审查

回到 Step10 重新执行代码审查。审查报告命名追加 `-round-N`。
新的审查结果通过 `attempt review <status>` 记录为新的一轮 rounds 条目，
该轮会**自动快照**当前的 decisions（包含 fixProposalPath 等）到 round 条目中。
```

**更新 Step12 决策点 3 选项文本：**

将「生成修复提案并应用」的描述改为：`生成修复提案并应用 → 执行下方「修复子流程」（必须先生成提案文档、经用户确认后再修改代码），完成后重新审查`

**更新第 64 行 `review.round` 引用：**

```
修复循环轮次以状态中的 `review.currentRound` 为准。
```

### ✅ Step 3：`SKILL.md.hbs` — 新增约束

在「执行约束」区域新增一条：

```markdown
- 代码审查发现问题后，选择「生成修复提案并应用」时必须先创建修复提案文档（`fix-proposal-round-N.md`）并等待用户确认，禁止跳过提案直接修改代码。修复提案路径通过 `decision fixProposalPath` 记录。
```

更新状态协议中的 `attempt` 命令说明，注明 review scope 会追加 rounds 条目。

### ✅ Step 4：更新测试文件

**✅ 4a. `test/integration/pipeline-state.test.ts`：**

- 将所有 `review.round` 引用替换为 `review.currentRound`
- 新增测试用例：
  - 多轮 review 后 `review.rounds` 包含所有历史记录
  - 每轮记录的 `timestamp`、`reportPath`、`status`、`decisions` 正确
  - 连续 3 轮 `issues-found` 触发暂停（中间有 `passed` 则重置）
  - V2→V3 migration：旧 `{ round, reportPath, status }` 正确转为 `rounds[]`
  - 迁移后 `review.reportPath` 为 `null`
  - `review.reportPath` / `review.status` 兼容字段始终等于最后一轮
  - `review.status` 不能通过 `set` 命令直接修改（已从 `mutablePaths` 移除）

**✅ 4b. `src/validators/PhaseValidators.ts`：**

- 更新 `PipelineState` 接口中的 `review` 类型：

```typescript
review: {
  rounds: Array<{
    round: number;
    reportPath: string | null;
    status: string;
    timestamp: string;
    decisions: Record<string, unknown>;
  }>;
  currentRound: number;
  status: string;
  reportPath: string | null;
};
```

- `validatePhase3` 断言更新为校验 `rounds` 数组：

```typescript
{
  description: 'Review attempt is recorded as passed',
  passed: state.review.rounds.length === 1 &&
    state.review.status === 'passed' &&
    state.review.rounds[0]?.status === 'passed',
}
```

**✅ 4c. `scenarios/error-recovery/review-fix-loop.test.ts`：**

- 更新 `LoopState` 接口匹配新结构
- 验证多轮 issues-found 后 `state.review.rounds.length === 3`
- 验证每轮的 `status === 'issues-found'`
- 验证 `state.review.currentRound === 3`、`state.status === 'paused'`
- 验证恢复后（passed）`rounds` 包含 4 条记录

**✅ 4d. `src/harness/DeterministicPipelineExecutor.ts`：**

- `executePhase3` 增加 `fix-and-rereview` 路径（当 `scenario.reviewDisposition === 'fix-and-rereview'` 时触发）
- Round 1：写入审查报告 → `attempt review issues-found` → 生成 fix proposal → 记录 decisions → 修复代码
- Round 2：写入新审查报告 → `attempt review passed` → transition 到 Phase 4
- 新增辅助函数 `addNullCheck`

**✅ 4e. `ScenarioConfig` 类型（`types.ts`）：**

- `reviewDisposition` 扩展为 `'review' | 'skip-review' | 'fix-and-rereview'`

**✅ 4f. Happy-path 测试（4 个文件）：**

将 `review: { round: 1, status: 'passed' }` 替换为：

```typescript
review: expect.objectContaining({
  currentRound: 1,
  status: 'passed',
  rounds: expect.arrayContaining([
    expect.objectContaining({ round: 1, status: 'passed' }),
  ]),
}),
```

**✅ 4g. `skip-review.test.ts`：**

将 `state.review.status` 读取更新为 `state.review.currentStatus`（或保持用 `status` 兼容字段），验证 `rounds` 为空。

### ✅ Step 5：同步 test-space 副本

将更新后的模板文件复制到 `test-space/snake-game/` 下三处安装位置。

---

## 验证方案

### 单元测试

```bash
# 状态机测试（27+ 用例 + 新增 migration/rounds 测试）
npx vitest run test/integration/pipeline-state.test.ts

# Gate 矩阵测试
node test/integration/dev-pipeline-state.test.mjs
```

### E2E 场景测试

```bash
# Review fix loop（3 轮连续失败 + 恢复）
npx vitest run scenarios/error-recovery/review-fix-loop.test.ts

# 全流程（含 review + fix-and-rereview）
npx vitest run scenarios/happy-path/fullstack-todo-full-flow.test.ts

# 跳过 review
npx vitest run scenarios/delivery-variants/skip-review.test.ts
```

### 手动验证场景

1. 启动 pipeline → 进入 Phase3 review
2. 审查发现问题 → 选择「生成修复提案并应用」
3. **验证**：AI 先生成了 `fix-proposal-round-1.md` 文档
4. **验证**：AI 使用 `{{askTool}}` 展示修复提案并等待确认
5. 确认后 → AI 实施修复 → 重新审查
6. **验证**：`review.rounds` 包含两轮记录（第一轮 issues-found + fix proposal decisions，第二轮 passed）

---

## 风险与注意事项

1. **向后兼容**：`review.reportPath` 和 `review.status` 顶层字段保留，现有代码中对这些字段的读取不受影响
2. **Migration**：旧状态文件通过 `migrate-schema --confirm` 自动升级，迁移后 `reportPath` 重置为 `null`
3. **数据一致性**：`review.currentRound` 和 `review.rounds` 只能通过 `attempt` 命令修改，`set` 命令不允许修改它们；`review.status` 已从 `mutablePaths` 移除
4. **Schema 版本**：升级到 v3，与 v2 的差异仅在 `review` 结构
5. **并发安全**：现有的乐观锁机制（`_version` + `_readVersion`）不变
6. **上限检查**：改为连续 3 轮 `issues-found` 检查（非累计），中间有 `passed` 自动重置
7. **修复提案追踪**：完全通过 `decision` 命令实现，`attempt review` 自动快照到 round 条目，不新增 `mutablePaths` 字段
