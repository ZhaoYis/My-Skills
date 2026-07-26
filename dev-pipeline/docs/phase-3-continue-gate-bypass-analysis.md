# Phase 3 "继续后续流程" 跳过所有门禁问题分析

## 问题现象

Phase 3 代码审查完成后，用户选择 "继续后续流程 (Recommended)"，系统直接跑完了：
- ❌ Phase 4（单测门禁）— 被跳过
- ❌ Phase 5（归档确认）— `archive.mjs -y` 自动执行
- ❌ Phase 6（提交/推送/合并决策点）— 全部自动执行

**没有任何门禁和用户确认点**，代码未经单测、归档未经确认、提交未经审查就直接推送。

## 执行日志关键片段

```
⏺ User answered: 继续后续流程 (Recommended)

⏺ Phase 5. Archiving with spec sync.        ← Phase 4 被跳过！
⏺ Bash(node ... archive.mjs "add-beginner-tutorial" -y)  ← -y 自动确认！
⏺ Archived with 4 spec syncs. Now committing and pushing.  ← 无确认！
⏺ Bash(git add ... && git commit ...)        ← 无决策点！
⏺ Bash(git push ...)                          ← 无决策点！
⏺ 流水线完成
```

状态中的关键信息：`"executionMode":"hybrid"`

---

## 根因分析

### 真正的根因只有两个，其余是症状

| 层级 | 分类 | 说明 |
|------|------|------|
| **根因 A** | 代码层 | `executionMode: hybrid` 禁用了门禁强制执行，且 `transition` 命令从未被调用 |
| **根因 B** | 模板层 | Phase 3 "继续后续流程" 措辞模糊，模型理解为"全自动跑完" |
| 症状 1 | → 根因 A | `allowedTransition()` 在 hybrid 模式下允许任意向前跳转 |
| 症状 2 | → 根因 A | `applyGateInference()` 在 hybrid 模式下自动批准门禁 |
| 症状 3 | → 根因 A | `record-phase` 偷偷将 `pipeline` 降级为 `hybrid` |
| 症状 4 | → 根因 B | Phase 4 决策点从未触发 |
| 症状 5 | → 根因 B | `archive.mjs -y` 自动执行，无确认 |

**优先级：根因 A > 根因 B。** 修了 A，即使模型误解指令，系统也会在 Phase 4/5/6 挡住。修了 B 只治标。

---

### 根因 A 详细分析（代码层）

#### A1：`allowedTransition()` — hybrid 模式任意向前跳转

**文件**：`templates/common/skills/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs`

`allowedTransition()` 函数（第 240-257 行）：

```javascript
// pipeline 模式：严格邻接表
const allowed = {
  0: [0, 1], 1: [1, 2], 2: [1, 2, 3, 4],
  3: [2, 3, 4], 4: [4, 5], 5: [1, 2, 5, 6], 6: [6],
};

// 非 pipeline 模式：任意向前跳转
if (state.executionMode !== 'pipeline') {
  if (to > from) return true;  // ← 致命！Phase 3 可以直接跳到 Phase 5/6
  if (to === 1 || to === 2) return true;
}
return allowed[from]?.includes(to) ?? false;
```

#### A2：`applyGateInference()` — hybrid 模式自动批准门禁

`applyGateInference()` 函数（第 263-273 行）在非 pipeline 模式下**自动批准**提案和实现门禁：

```javascript
if (state.executionMode === 'pipeline') return;  // pipeline 模式不做推断
// 非 pipeline：已到过 Phase 2+ → 自动批准提案
if (!state.decisions.proposalApproved && stateHasBeenToPhase(state, 2)) {
  state.decisions.proposalApproved = true;  // ← 自动跳过！
}
// 非 pipeline：已到过 Phase 3+ → 自动确认实现
if (!state.decisions.implementationConfirmed && stateHasBeenToPhase(state, 3)) {
  state.decisions.implementationConfirmed = true;  // ← 自动跳过！
}
```

#### A3：`record-phase` 强制切换 hybrid — 应删除

`record-phase` 命令（第 591 行）将 `executionMode` 从 `pipeline` 强制切换为 `hybrid`：

```javascript
if (state.executionMode === 'pipeline') {
  state.executionMode = 'hybrid';
}
```

**问题**：每次 `record-phase` 调用都永久降级安全模型。这是副作用过载——独立记录阶段状态不应改变执行模式。

**决策**：删除此行。`pipeline` 模式永远保持 `pipeline`，`executionMode` 字段保留但不再用于门禁判断，仅作为审计标记。

#### A4：Phase 之间 transition 从未被调用

`validateGates()` 函数（第 275-297 行）定义了 4 个强制门禁：

| 门禁 | 触发条件 | 要求 |
|------|---------|------|
| 提案批准 | 进入 Phase 2 | `decisions.proposalApproved === true` |
| 实现确认 | Phase 2 → Phase 3+ | `decisions.implementationConfirmed === true` |
| 单测门禁 | 进入 Phase 5 | `tests.status` ∈ `{passed, skipped, debt-recorded}` |
| 归档+验证+交付决策 | 进入 Phase 6 | `verify.status` ∈ `{passed, skipped}` ∧ `archivePath` 已设 ∧ `postArchiveAction` 已设 |

**但这些门禁只在 `transition` 命令中被调用**（第 686-694 行）。从执行日志看，模型直接执行了：
- `archive.mjs -y` → 绕过 Phase 4 transition
- `git commit` / `git push` → 绕过 Phase 5/6 transition

**从不调用 `dev-pipeline-state.mjs transition` → 门禁系统形同虚设。**

---

### 根因 B 详细分析（模板层）

#### B1：Phase 3 "继续后续流程" 语义模糊

**文件**：`templates/common/skills/opsx-dev-pipeline/references/phase-3-review.md.hbs`

Branch B（仅有建议级别问题，第 44-48 行）：

```markdown
1. **`继续后续流程`** — Phase4（推荐）
2. `生成修复提案并应用` — 修复子流程
3. `暂停流水线，手动调整后继续`
4. `终止流程`
```

"继续后续流程" 的设计意图是：**跳过修复当前审查发现的问题，进入 Phase 4**。但模型将其理解为 **"所有后续流程都可以自动执行"** 的绿色通行证。

**缺少的关键约束**：
- 没有说明 "继续后续流程" 后必须进入 Phase 4 决策点 4
- 没有说明不得跳过 Phase 4/5/6 的任何决策点
- 没有要求先执行 `transition` 命令

#### B2：`archive.mjs -y` 自动确认所有选项 — 防御纵深

**文件**：`templates/common/skills/opsx-dev-pipeline/scripts/archive.mjs`

Phase 5 执行了 `archive.mjs "add-beginner-tutorial" -y`，`-y` flag 跳过了：
- Verify 确认
- Delta spec sync 选择
- 归档确认

虽然代码门禁修复后，模型在到达 `archive.mjs -y` 前会被 transition 挡住，但模板层也应加上约束作为**防御纵深**：

```markdown
**禁止在未经用户显式确认的情况下使用 `-y` flag。**
`archive.mjs -y` 只能在用户通过 {{askTool}} 确认归档选项后执行。
```

#### B3：Phase 4 单测决策点被完全跳过

**文件**：`templates/common/skills/opsx-dev-pipeline/references/phase-4-unit-tests.md.hbs`

Phase 4 决策点 4 标注了 **"不得默认跳过"**（第 9 行）：

```markdown
**{{askTool}}**（不得默认跳过）：
1. `需要：编写/补充单元测试并运行通过后再继续`
2. `不需要：跳过单测环节`
3. `暂停流水线，稍后继续`
```

但因为 Phase 3 的 "继续后续流程" 直接跳到了 Phase 5，这个决策点从未触发。

---

## 修复方案

### ✅ 修复 1：`dev-pipeline-state.mjs` — 核心代码修复（根因 A）

#### ✅ 1a：`allowedTransition` — 始终走严格邻接表 + 累积门禁检查

```javascript
function allowedTransition(from, to, state) {
  const allowed = {
    0: [0, 1], 1: [1, 2], 2: [1, 2, 3, 4],
    3: [2, 3, 4], 4: [2, 4, 5], 5: [1, 2, 5, 6], 6: [6],
  };

  // 始终使用严格邻接表——不再区分 executionMode
  if (allowed[from]?.includes(to)) return true;

  // 跨 Phase 向前跳转：必须通过累积门禁验证
  // 遍历 from→to 之间每个 Phase 的入口门禁
  if (to > from) {
    for (let phase = from + 1; phase <= to; phase++) {
      const gates = validateGates(state, phase - 1, phase);
      if (gates && gates.length > 0) return false;
    }
    return true;
  }

  return false;
}
```

关键变更：
- **删除 `executionMode` 分支**——不再区分 pipeline/hybrid/standalone
- **跨 Phase 跳转必须通过累积门禁检查**——遍历中间所有 Phase 入口门禁
- **`to === 1 || to === 2` 的任意回退**不再无条件允许（仅通过邻接表允许的回退才放行）

#### ✅ 1b：`validateGates` — 支持中间 Phase 门禁遍历

当前 `validateGates` 以 `(from, to)` 为参数，需确保对任意相邻 Phase 对都能正确检查。现有逻辑已覆盖：
- `to === 2` → 提案批准
- `from === 2 && to >= 3` → 实现确认
- `to === 5` → 单测门禁
- `to === 6` → 归档+验证+交付决策

修改 `from === 2 && to >= 3` 为 `from === 2 && to >= 3`（保持不变），在累积遍历中会以 `(2, 3)` 调用，正确触发。

#### ✅ 1c：删除 `record-phase` 中的 hybrid 降级

```javascript
// 删除这两行：
// if (state.executionMode === 'pipeline') state.executionMode = 'hybrid';
```

`pipeline` 模式永远保持 `pipeline`。`executionMode` 字段保留但不再用于门禁判断，仅作为审计标记。

#### ✅ 1d：`applyGateInference` — 删除或限制范围

`applyGateInference` 在非 pipeline 模式下自动批准门禁。由于不再区分 executionMode，有两个选择：
- **方案一（推荐）**：完全删除 `applyGateInference`——所有门禁必须显式通过
- **方案二**：保留但仅在特定场景（如 `standalone` 模式的手动操作）下使用

推荐方案一，与其他修复保持一致。

---

### ✅ 修复 2：`phase-3-review.md.hbs` — 明确 "继续后续流程" 语义和边界（根因 B1）

在 Branch A 和 Branch B 的 "继续后续流程" 选项后添加硬性约束：

```markdown
**重要：「继续后续流程」仅跳过修复当前审查发现的问题。选择此项后必须：**

1. 先执行 `transition "<name>" 4 14` 进入 Phase 4 决策点 4
2. 等待用户在 Phase 4 决策点 4 的显式选择
3. 按 Phase 4 → Phase 5 → Phase 6 顺序逐阶段推进，每阶段必经其决策点
4. **禁止**跳过任何后续决策点直接执行归档、提交或推送命令
```

---

### ✅ 修复 3：`phase-4-unit-tests.md.hbs` — 强制 transition 进入 Phase 5（根因 B3）

在决策点 4 的每个出口添加 transition 命令要求：

```markdown
进入 Phase 5 前必须执行：
node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs transition "<name>" 5 15
若 transition 失败（test-gate-required），必须回到决策点 4。
```

---

### ✅ 修复 4：`phase-5-archive.md.hbs` — 禁止自动使用 `-y` flag（根因 B2，防御纵深）

```markdown
**禁止在未经用户显式确认的情况下使用 `-y` flag。**
`archive.mjs -y` 只能在用户通过 {{askTool}} 确认归档选项后执行。
```

同时在 Step19（决策点 5b）后添加强制 transition：

```markdown
进入 Phase 6 前必须执行：
node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs transition "<name>" 6 20
若 transition 失败，检查并补齐缺失的门禁（verify.status、archivePath、postArchiveAction）。
```

---

### ✅ 修复 5：`SKILL.md.hbs` — 添加全局 transition 约束

在最小执行约束中增加：

```markdown
- 每个 Phase 的「继续后续流程」选项仅跳过当前 Phase 的剩余工作，
  不得跳过后续 Phase 的任何决策点。从当前 Phase 切换到下一 Phase 时
  必须先执行 `transition` 命令并通过门禁验证。若 transition 失败，
  必须展示失败原因并等待用户显式选择。
- 禁止跳过中间 Phase 直接进入后续 Phase。Phase 推进必须按顺序进行，
  且每阶段必经其决策点。
```

---

### ✅ 修复 6：单元测试 — `allowedTransition` + `validateGates` 覆盖

新增单元测试覆盖以下场景：

| 分类 | 测试用例 | 预期 |
|------|---------|------|
| 相邻跳转 | 0→1, 1→2, 2→3, 3→4, 4→5, 5→6 | ✅ 允许 |
| 回退 | 2→1, 3→2, 4→2, 5→1, 5→2 | ✅ 允许（邻接表定义） |
| 跨 Phase 跳转（门禁满足） | 3→5（单测已跳过） | ✅ 允许 |
| 跨 Phase 跳转（门禁不满足） | 3→6（单测未通过） | ❌ 拒绝 test-gate-required |
| 跨 Phase 跳转（门禁不满足） | 3→6（verify 未通过） | ❌ 拒绝 verify-gate-required |
| 跨 Phase 跳转（门禁不满足） | 2→5（实现未确认） | ❌ 拒绝 implementation-confirmation-required |
| Phase 6 门禁 | 5→6（archivePath 为空） | ❌ 拒绝 archive-required |
| Phase 6 门禁 | 5→6（postArchiveAction 未设） | ❌ 拒绝 post-archive-decision-required |
| Phase 6 门禁 | 5→6（全部满足） | ✅ 允许 |
| 非法跳转 | 1→5（提案未批准） | ❌ 拒绝 proposal-approval-required |
| 同 Phase | 3→3, 4→4 | ✅ 允许 |
| 累积门禁 | 2→6（遍历 3,4,5,6 入口） | ❌ 拒绝（第一个不满足的门禁） |

---

## 决策记录

| # | 决策 | 结论 |
|---|------|------|
| 根因优先级 | 以根因 A（代码门禁）为主，根因 B（模板措辞）为辅 | 先修代码，再修模板 |
| `allowedTransition` 修复粒度 | 始终走严格邻接表，跨 Phase 跳转须通过累积门禁检查 | 删除 executionMode 分支 |
| `record-phase` 的 hybrid 切换 | **删除**，pipeline 永远保持 pipeline | executionMode 保留为审计标记 |
| `applyGateInference` | **删除**，所有门禁必须显式通过 | 不再自动批准 |
| `archive.mjs -y` 模板约束 | **保留**修复 4，作为防御纵深 | 两层防线 |
| 验证策略 | **单元测试**覆盖 `allowedTransition` + `validateGates` 边界组合 + 手动端到端验证 | 硬核验证 |

---

## 修改文件清单

| # | 文件 | 修改类型 | 说明 |
|---|------|---------|------|
| ✅ 1 | `templates/.../scripts/dev-pipeline-state.mjs` | 修改 | 删除 executionMode 分支、累积门禁检查、删除 hybrid 降级、删除 applyGateInference |
| ✅ 2 | `templates/.../references/phase-3-review.md.hbs` | 修改 | 明确 "继续后续流程" 边界，强制 transition |
| ✅ 3 | `templates/.../references/phase-4-unit-tests.md.hbs` | 修改 | 强制 transition 进入 Phase 5 |
| ✅ 4 | `templates/.../references/phase-5-archive.md.hbs` | 修改 | 禁止自动 `-y`，强制 transition 进入 Phase 6 |
| ✅ 5 | `templates/.../SKILL.md.hbs` | 修改 | 添加全局 transition 约束 |
| ✅ 6 | `test/integration/dev-pipeline-state.test.mjs` | **新增** | 单元测试覆盖 allowedTransition + validateGates |
| ✅ 7 | `test/integration/pipeline-state.test.ts`、`test/integration/init-matrix.test.ts` | 修改 | 更新旧行为断言并验证模板约束渲染结果 |
| ✅ 8 | `test-space/snake-game/.{claude,cursor,codex}/.../opsx-dev-pipeline/` | 同步 | 渲染后同步到 Claude/Cursor/Codex |

## 验证方法

### 单元测试

```bash
npx vitest run test/integration/dev-pipeline-state.test.mjs
```

覆盖场景见修复 6 的测试用例表。

### 端到端验证

1. 在 `test-space/snake-game` 中运行 `/opsx-dev-pipeline`，提供简单需求
2. 推进到 Phase 3 审查完成（仅有建议级别问题）
3. 选择 "继续后续流程"
4. **验证**：模型必须展示 Phase 4 决策点 4（是否需要单测），使用 AskUserQuestion
5. **验证**：选择 "跳过单测" 后，模型必须执行 `transition "<name>" 5 15`
6. **验证**：归档前模型必须展示 verify 和 delta spec sync 确认
7. **验证**：归档后模型必须展示 Phase 6 提交/推送/合并决策点
8. **验证**：直接执行 `archive.mjs -y` 而不先 transition 时，transition 命令应拒绝跨 Phase 跳转
