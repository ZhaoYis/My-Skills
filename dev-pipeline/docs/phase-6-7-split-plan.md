# Phase 6 拆分方案：Merge & Push → Commit & Push + Merge & Deliver

## 背景

当前 Phase 6 (`phase-6-merge-push.md.hbs`) 包含 279 行、7 个步骤（Step 20-26），覆盖了从预提交检查到最终标签创建的完整交付流程。由于模板过长，大模型在执行时容易不聚焦，需要将 **Merge & Push** 拆分为两个独立阶段：

- **Phase 6 (Commit & Push)**：提交 + 源分支推送
- **Phase 7 (Merge & Deliver)**：合并 + 目标推送 + 完成

## 拆分设计

### 步骤分配

| 阶段 | 步骤范围 | 内容 |
|------|---------|------|
| Phase 6 (Commit & Push) | Step 20-22 | 预提交检查 → 分步暂存与提交 → 源分支推送 |
| Phase 7 (Merge & Deliver) | Step 23-26 | 目标分支合并 → 合并后验证与推送 → 完成与状态提交 → 分支清理与标签 |

### 交付路径

- **local-only**：Phase 6 Step 22 完成，在 Phase 6 调用 `complete`
- **push-only**：Phase 6 Step 22 完成，在 Phase 6 调用 `complete`
- **merge**：Phase 6 Step 22 → `transition 7 23` → Phase 7 Step 23-26 → 在 Phase 7 调用 `complete`

### 状态机变更

```javascript
// allowedTransition
6: [6, 7],  // Phase 6 可留在原地或进入 Phase 7
7: [7],      // Phase 7 是终点

// validateGates — Phase 7 入口门禁（追加在现有 Phase 6 门禁之后）
if (to === 7) {
  if (state.decisions.postArchiveAction !== 'merge') {
    return ['merge-gate-required', '进入 Phase7 前必须记录 postArchiveAction=merge'];
  }
  if (!state.delivery.commitSha) {
    return ['commit-required', '进入 Phase7 前必须记录 delivery.commitSha'];
  }
  if (!state.delivery.sourcePushed) {
    return ['source-push-required', '进入 Phase7 前必须推送源分支'];
  }
}

// complete 命令 — 允许 Phase 6 或 Phase 7（简化方式）
if (state.currentPhase < 6) {
  emitError('pipeline-not-delivered', '只有 Phase6 或 Phase7 可以标记流水线完成', ...);
}

// record-phase 的 phase 范围校验: phase < 0 || phase > 7（原 > 6）
// transition 的 toPhase 范围校验: toPhase < 0 || toPhase > 7（原 > 6）
```

---

## 需要修改的文件清单

### 一、核心模板 (7 个文件)

#### 1. 新建：`templates/common/skills/opsx-dev-pipeline/references/phase-6-commit-push.md.hbs`
- 从原 `phase-6-merge-push.md.hbs` 提取 Step 20-22
- 在 Step 22 末尾增加分支逻辑：
  - `local-only` → 直接进入完成流程（26.1/26.2/26.3 简化版）
  - `push-only` → 推送后进入完成流程
  - `merge` → `transition "<name>" 7 23` 进入 Phase 7

#### 2. 新建：`templates/common/skills/opsx-dev-pipeline/references/phase-7-merge-deliver.md.hbs`
- 从原 `phase-6-merge-push.md.hbs` 提取 Step 23-26
- Step 23: 目标分支与合并（保持原样）
- Step 24: 合并后验证与目标推送（保持原样）
- Step 25: 完成状态、提交流水线记录（简化，去掉 non-merge 路径）
- Step 26: 源分支清理与标签（保持原样，去除与 Step 25 的交叉引用）

#### 3. 删除：`templates/common/skills/opsx-dev-pipeline/references/phase-6-merge-push.md.hbs`

#### 4. 修改：`templates/common/skills/opsx-dev-pipeline/SKILL.md.hbs`
- Phase 引用表：将 Phase 6 行改为 `提交与推送`，新增 Phase 7 行 `合并与交付`
- Mermaid 流程图：更新 Phase 6/7 节点和连线
- 执行约束：更新 Phase 范围引用（如 "Phase 0 到 Phase 6" → "Phase 0 到 Phase 7"）

#### 5. 修改：`templates/common/skills/opsx-dev-pipeline/references/phase-5-archive.md.hbs`
- Step 19 决策点：`merge` 选项的描述更新为进入 Phase 6+7
- `transition` 命令保持不变（仍为 `transition "<name>" 6 20`）

#### 6. 修改：`templates/common/skills/opsx-dev-pipeline/references/phase-0-entrance.md.hbs`
- 恢复逻辑中 `decisions.postArchiveAction` 缺失的引用更新

#### 7. 修改：`templates/common/skills/opsx-dev-pipeline/references/phase-3-review.md.hbs`
- "Phase4 → Phase5 → Phase6" → "Phase4 → Phase5 → Phase6 → Phase7"

---

### 二、状态机脚本 (1 个文件)

#### 8. 修改：`templates/common/skills/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs`

具体变更：
- `allowedTransition`：`6: [6, 7]`, `7: [7]`
- `validateGates`：新增 Phase 7 入口门禁（`postArchiveAction === 'merge'`）
- `complete` 判断：`currentPhase !== 6 && currentPhase !== 7`
- `record-phase` 的 phase 范围校验：`phase > 7`（原 `phase > 6`）
- `transition` 的 phase 范围校验：`toPhase > 7`（原 `toPhase > 6`）
- 错误消息中的 "Phase6" 改为 "Phase6 或 Phase7"

---

### 三、资产清单 (1 个文件)

#### 9. 修改：`src/core/assets/manifest.ts`
- `templateFiles` 数组中：
  - 删除 `'phase-6-merge-push.md.hbs'`
  - 新增 `'phase-6-commit-push.md.hbs'`
  - 新增 `'phase-7-merge-deliver.md.hbs'`

---

### 四、测试框架 (4 个文件)

#### 10. 修改：`src/harness/types.ts`
- `PhaseId` 联合类型：删除 `'phase-6-merge-push'`，新增 `'phase-6-commit-push'` 和 `'phase-7-merge-deliver'`
- `ALL_PHASES` 数组：同上
- `PHASE_META` 对象：更新两个新 phase 的元数据

#### 11. 修改：`src/harness/DeterministicPipelineExecutor.ts`
- `executePhase` switch：拆分 `case 'phase-6-merge-push'` 为两个 case
- `executePhase6`：只做 commit + push（Step 20-22）
- 新增 `executePhase7`：merge + target push + complete（Step 23-26）
- `executePhase5`：根据 `postArchiveAction` 决定 transition 到 Phase 6 还是 Phase 7

#### 12. 修改：`src/harness/AgentPhaseRunner.ts`
- `getPhaseSpecificInstructions` switch：拆分 Phase 6 case

#### 13. 修改：`src/validators/PhaseValidators.ts`
- 拆分 `validatePhase6` 为 `validatePhase6`（commit + push 验证）和 `validatePhase7`（merge + deliver 验证）
- `PHASE_VALIDATORS` 映射：更新两个新 phase 的 key

---

### 五、E2E 测试场景 (7 个文件)

#### 14-20. 修改场景文件：
- `scenarios/happy-path/fullstack-todo-full-flow.test.ts`
- `scenarios/happy-path/codex-fullstack-full-flow.test.ts`
- `scenarios/happy-path/cursor-fullstack-full-flow.test.ts`
- `scenarios/happy-path/backend-only-full-flow.test.ts`
- `scenarios/delivery-variants/push-only.test.ts`
- `scenarios/delivery-variants/skip-review.test.ts`
- `scenarios/delivery-variants/skip-tests.test.ts`

每个文件变更模式相同，但各场景的 Phase 7 行为不同：

| 场景 | postArchiveAction | 总 Phase 数 | Phase 7 行为 |
|------|-------------------|-------------|-------------|
| fullstack-todo-full-flow | merge (默认) | 8 | 包含，执行完整 merge 流程 |
| backend-only-full-flow | merge (默认) | 8 | 包含，执行完整 merge 流程 |
| codex-fullstack-full-flow | merge (默认) | 8 | 包含，执行完整 merge 流程 |
| cursor-fullstack-full-flow | merge (默认) | 8 | 包含，执行完整 merge 流程 |
| push-only | push-only | 7 | **过滤掉**（`phases: ALL_PHASES.filter(p => p !== 'phase-7-merge-deliver')`） |
| skip-review | merge (默认) | 7 | 包含（过滤掉 Phase 3，但保留 Phase 7） |
| skip-tests | merge (默认) | 8 | 包含 |

关键设计：push-only 和 local-only 场景需要在 `phases` 数组中过滤掉 `'phase-7-merge-deliver'`，因为 Phase 7 只在 merge 模式下执行。对于 merge 模式的场景，`currentPhase` 断言从 `6` 改为 `7`（因为 `complete` 在 Phase 7 调用）。

---

### 六、集成测试 (3 个文件)

#### 21. 修改：`test/integration/init-matrix.test.ts`
- 工具期望列表中将 `phase-6-merge-push.md` 替换为 `phase-6-commit-push.md` 和 `phase-7-merge-deliver.md`
- 阶段文件存在性检查循环中更新 phase 6 的名称映射

#### 22. 修改：`test/integration/git-delivery.test.ts`
- `describe('Phase6 isolated Git delivery commands', ...)` 的 describe 名称更新

#### 23. 修改：`test/integration/pipeline-state.test.ts`
- `currentPhase === 6` 断言可能需要更新为 `currentPhase === 6 || currentPhase === 7`
- transition 测试中 Phase 6 相关的断言更新

---

### 七、文档 (约 15 个文件)

#### 24-38. 修改文档文件：
- `README.md`
- `docs/metrics/pipeline-state-fields.md`
- `docs/feature-inventory.md`
- `docs/pipeline-state-final-commit-fix.md`
- `docs/phase-3-continue-gate-bypass-analysis.md`
- `docs/standalone-skills-state-integration-plan.md`
- `docs/share-doc/practice-guide.md`
- `docs/share-doc/practice-guide-v3.md`
- `docs/share-doc/pipeline-decision-points.md`
- `docs/share-doc/tech-sharing-guide.md`
- `docs/portal-website/portal-content-strategy.md`
- `docs/portal-website/portal-content-strategy-v2.md`
- `docs/[todo]hermes-architecture-design.md`
- `docs/ask-tool-unification-plan.md`

变更模式：将 "Phase 6" 引用更新为 "Phase 6 和 Phase 7"，将步骤范围 20-26 更新为 20-22（Phase 6）和 23-26（Phase 7）。

---

### 八、test-space 已安装副本 (约 9 个文件)

#### 39-47. 修改 `test-space/snake-game/` 下的文件：
- **新建**：`.claude/skills/opsx-dev-pipeline/references/phase-6-commit-push.md`
- **新建**：`.claude/skills/opsx-dev-pipeline/references/phase-7-merge-deliver.md`
- **删除**：`.claude/skills/opsx-dev-pipeline/references/phase-6-merge-push.md`
- **修改**：`.claude/skills/opsx-dev-pipeline/SKILL.md`
- **修改**：`.claude/skills/opsx-dev-pipeline/references/phase-5-archive.md`
- **修改**：`.claude/skills/opsx-dev-pipeline/references/phase-3-review.md`
- **修改**：`.claude/skills/opsx-dev-pipeline/references/phase-0-entrance.md`
- **修改**：`.claude/skills/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs`
- **修改**：`opsx-dev-pipeline.json`

---

### 九、metrics-server 部署快照 (可选)

#### 48. `.collector/repo-191/` 下的文件
- 与 test-space 模式相同，更新已部署的 pipeline 副本

---

## 验证策略

1. **状态机测试**：运行 `test/integration/pipeline-state.test.ts` 和 `test/integration/dev-pipeline-state.test.mjs`，确保所有 transition 正确
2. **Init 测试**：运行 `test/integration/init-matrix.test.ts`，确保模板文件正确安装
3. **Git 交付测试**：运行 `test/integration/git-delivery.test.ts`，确保合并策略仍然有效
4. **E2E 场景**：运行所有 7 个 E2E 场景，覆盖三种交付路径
5. **手动验证**：在 `test-space/snake-game` 中实际运行 `opsx-dev-pipeline` 技能，验证完整流程

---

## 实施顺序

按依赖关系排列，建议按以下顺序执行：

1. **状态机** (`dev-pipeline-state.mjs`) — 必须最先完成，所有后续步骤依赖它
2. **核心模板** (新建 `phase-6-commit-push.md.hbs`, `phase-7-merge-deliver.md.hbs`；删除 `phase-6-merge-push.md.hbs`；修改 `SKILL.md.hbs`, `phase-5-archive.md.hbs`, `phase-0-entrance.md.hbs`, `phase-3-review.md.hbs`)
3. **资产清单** (`manifest.ts`) — 注册新模板文件
4. **测试框架类型** (`types.ts`) — 定义新 PhaseId
5. **测试框架执行器** (`DeterministicPipelineExecutor.ts`, `AgentPhaseRunner.ts`) — 实现新阶段逻辑
6. **测试验证器** (`PhaseValidators.ts`) — 验证新阶段输出
7. **E2E 测试场景** (7 个文件) — 更新断言
8. **集成测试** (3 个文件) — 更新文件引用
9. **文档** (~15 个文件) — 更新描述
10. **test-space 副本** — 从模板重新生成
11. **全量测试** — 运行完整测试套件验证