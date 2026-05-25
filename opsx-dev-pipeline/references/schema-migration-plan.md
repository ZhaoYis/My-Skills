# 基于 `yzw-workflow` 的 schema-aware 流水线重构实施方案

## 1. 目标与范围

### 1.1 重构目标

将当前 `opsx-dev-pipeline` 从“默认 OpenSpec schema 的流程包装器”升级为“**schema-aware 的流程编排技能**”，优先支持 `yzw-workflow`，并保留对默认 schema 的兼容与降级路径。

### 1.2 设计原则

- **流程编排留在 skill**：Phase 0–6、决策点、暂停/恢复、review/fix-cr、unit test、commit/push/merge 仍由 skill 控制
- **制品与上下文规则下沉到 schema**：artifact 集合、依赖、模板、apply context、stack rules、verify 命令映射优先由 schema / `openspec/config.yaml` 驱动
- **兼容优先**：不改成仅支持 `yzw-workflow`，而是实现 `default schema + yzw-workflow enhanced path`
- **避免双写规则**：`references/` 仅保留流程规则；artifact/rules/context/verify 规则尽量引用 schema/config，不在文档中复制一份

### 1.3 不纳入本次重构的范围

以下内容不建议放入 schema，本次仍保留在 skill：

- Git commit message 生成与确认
- push / pull --rebase / merge / conflict resolution
- review 报告落盘格式
- 最终摘要格式
- AskQuestion 决策点交互

---

## 2. 现状与问题

## 2.1 当前 skill 的主要耦合点

当前 skill 对 OpenSpec 默认 schema 的耦合主要体现在：

1. **默认 artifact 集合假设**
   - Phase 1 默认围绕 `proposal.md / design.md / specs / tasks.md`
   - 未显式支持 `adr.md` 等自定义 artifact

2. **项目规范来源较弱**
   - 当前主要依赖 `openspec/config.yaml -> AGENTS.md -> CLAUDE.md`
   - 尚未把 `config.yaml` 中更细粒度的 stack-aware context/rules 作为一等输入

3. **verify / archive 门禁未与 schema 对齐**
   - 当前归档阶段主要关注 status / delta specs / archive
   - `yzw-workflow` 中已定义的 verify 前置规则尚未纳入主流程

4. **测试命令解析偏仓库启发式**
   - 当前 Phase 5 优先通过 `package.json / pom.xml / go.mod ...` 猜测命令
   - 尚未优先基于 schema 的 stack 映射推导验证/测试命令

## 2.2 `yzw-workflow` 已具备的基础能力

`yzw-workflow` 已经提供：

- artifact 定义：`proposal / adr / specs / design / tasks`
- artifact 依赖关系：`tasks` 依赖 `specs + design`
- apply 阶段 context 合并策略：`shared + stacks`
- stack 维度规则：`backend / frontend`
- verify 命令映射：backend / frontend / all
- 流程性约束：测试前置、全部任务完成后 verify，再 archive

结论：`yzw-workflow` 已足以作为 skill 重构的规则源。

---

## 3. 重构后的目标架构

## 3.1 两层职责模型

### A. Schema 适配层

负责解释“当前项目的 OpenSpec schema 是什么，以及这对流水线意味着什么”。

输出统一能力：

- schema 名称
- 期望 artifact 集合
- 项目基准上下文
- apply context
- verify 命令
- archive 前置策略
- stack 信息

### B. Flow Orchestrator（现有 skill 主体）

继续负责：

- Phase 0–6 编排
- 决策点与 AskQuestion
- review / fix-cr
- 暂停 / 终止 / 恢复
- commit / push / merge

## 3.2 推荐能力接口（概念层）

建议在文档与脚本层先统一这 6 个能力：

1. `detectSchema(change?)`
2. `listExpectedArtifacts(change)`
3. `resolveProjectBaseline(change)`
4. `resolveApplyContext(change)`
5. `resolveVerifyCommand(change)`
6. `resolveArchivePolicy(change)`

说明：
- 第一阶段不要求实现成编程语言内正式接口
- 可先通过 shell 脚本 + 文档约定实现

---

## 4. 里程碑与实施步骤

## 里程碑 1：引入 schema-aware 识别层

### 目标

让 skill 能识别当前项目是否使用 `yzw-workflow`，并把 schema 识别结果带入后续 Phase。

### 涉及文件

- `references/phase-0-entrance.md`
- `SKILL.md`
- `references/recovery-guardrails-appendix.md`
- 新增 `references/schema-adapter.md`
- 新增 `scripts/opsx-detect-schema.sh`

### 改动内容

#### 4.1.1 新增 `scripts/opsx-detect-schema.sh`

职责：

- 读取 `openspec/config.yaml`
- 输出 JSON：
  - `schema`
  - `hasProjectMd`
  - `hasConfigYaml`
  - `supportsStacks`
  - `changeHasOpenSpecYaml`
  - `stacks`

建议输出示例：

```json
{
  "schema": "yzw-workflow",
  "hasProjectMd": false,
  "hasConfigYaml": true,
  "supportsStacks": true,
  "changeHasOpenSpecYaml": true,
  "stacks": ["backend", "frontend"]
}
```

#### 4.1.2 更新 Phase 0

在 `phase-0-entrance.md` 增加：

- preflight 后读取 schema
- 若 schema=`yzw-workflow`：
  - 标记当前 change 是否包含 `.openspec.yaml`
  - 标记是否已有 `stacks`
- 将该信息纳入后续续跑判断与摘要输出

#### 4.1.3 新增 `references/schema-adapter.md`

内容建议包括：

- 默认 schema 与 `yzw-workflow` 的差异矩阵
- artifact 集合对照
- baseline/context/verify/archive 差异
- 降级策略

### 验收标准

- skill 能在 Phase 0 确认当前 schema
- skill 文档明确说明 `yzw-workflow` 的增强路径
- 默认 schema 项目不受影响

---

## 里程碑 2：让 Phase 1/2 由 schema 驱动 artifact 与 context

### 目标

让 Propose / Apply 不再依赖默认 artifact 集合，而是按 schema 动态工作，特别是支持 `adr` 与 stack-aware context。

### 涉及文件

- `references/phase-1-propose.md`
- `references/phase-2-apply.md`
- `SKILL.md`
- 新增 `scripts/opsx-change-context.sh`
- 新增 `scripts/opsx-ensure-change-meta.sh`
- 视需要更新：
  - `scripts/opsx-instructions.sh`
  - `scripts/opsx-instructions-apply.sh`
  - `scripts/opsx-selftest.sh`

### 改动内容

#### 4.2.1 Phase 1 改为按 schema 展示 artifact

当前 Phase 1 中默认摘要为：

- proposal.md
- design.md
- delta specs
- tasks.md

应改为：

- 根据 `listExpectedArtifacts(change)` 动态展示
- 对 `yzw-workflow`，展示：
  - proposal
  - adr
  - specs
  - design
  - tasks

#### 4.2.2 决策点 1 的门禁改造

在用户选择“确认提案，开始实施”前：

- 除已有规则外，再校验 schema-required artifacts 是否齐全
- 对 `yzw-workflow`，至少应校验：
  - proposal 已完成
  - specs 已完成
  - design 已完成（若 schema/项目要求）
  - tasks 已完成
  - adr 的要求以 schema 定义为准

#### 4.2.3 引入 `.openspec.yaml` / `stacks`

新增 `scripts/opsx-ensure-change-meta.sh`：

职责：

- 检查 `openspec/changes/<name>/.openspec.yaml`
- 若 schema=`yzw-workflow` 且未声明 `stacks`：
  - 让用户选择 backend / frontend / both
  - 将结果写入 `.openspec.yaml`

建议最晚在 Phase 1 Step 3 完成该动作。

#### 4.2.4 Apply 上下文合并脚本化

新增 `scripts/opsx-change-context.sh`：

职责：

- 读取 `openspec/config.yaml`
- 读取 change 下 `.openspec.yaml`
- 合并：
  - `shared.context`
  - 选中 stack 的 context
  - 相关 rules
  - standards 文档清单
  - AGENTS.md / CLAUDE.md 兜底信息
- 输出结构化 JSON / markdown 摘要供 Phase 2 使用

#### 4.2.5 Phase 2 文案升级

在 `phase-2-apply.md` 中加入：

- 若 schema=`yzw-workflow`：
  - Apply 除读取 OpenSpec `contextFiles` 外
  - 还需读取 stack-aware context 与 rules
  - 代码实现需对齐所选 stack 的 standards 文档

### 验收标准

- `yzw-workflow` 项目能正确展示 `adr`
- Phase 1 不再默认写死 artifact 集合
- change 可在早期补齐 `.openspec.yaml`
- Apply 可按 backend/frontend/fullstack 获得差异化上下文

---

## 里程碑 3：将 verify gate 前移到 archive 前

### 目标

把 `yzw-workflow` 中“全部 tasks 完成 -> verify -> archive”的规则纳入主流程，而不是只在文档里提及。

### 涉及文件

- `references/phase-4-archive.md`
- `references/recovery-guardrails-appendix.md`
- 新增 `scripts/opsx-resolve-verify.sh`
- 可选新增 `scripts/opsx-run-verify.sh`
- 视需要更新 `SKILL.md`

### 改动内容

#### 4.3.1 新增 `scripts/opsx-resolve-verify.sh`

职责：

- 输入：change 名称
- 输出：基于 schema/stacks 解析出的 verify 命令

规则建议：

- only backend -> `./scripts/validate.sh backend`
- only frontend -> `./scripts/validate.sh frontend`
- backend + frontend -> `make validate` 或 `./scripts/validate.sh all`
- 默认 schema -> 回退到仓库启发式或无 verify 定义

#### 4.3.2 调整 Phase 4 结构

建议将当前 Phase 4 步骤重排为：

- 12：检查制品与任务状态
- 13：执行 verify gate
- 14：delta specs 同步决策
- 15：执行 archive
- 16：归档后进入决策点 4

#### 4.3.3 verify gate 行为

若 schema=`yzw-workflow`：

- 未完成 tasks -> 不允许直接 archive
- verify 未通过 -> 不允许 archive
- verify 失败时提供选项：
  - 修复后重试
  - 暂停流水线
  - 终止流程

#### 4.3.4 Appendix 更新

在 `recovery-guardrails-appendix.md` 中加入：

- verify 是 archive 前置条件（schema-aware）
- unit tests 与 verify 的职责区分

### 验收标准

- `yzw-workflow` 下，未 verify 成功不能 archive
- verify 失败流程有明确恢复路径
- 默认 schema 仍支持原有 archive 流程

---

## 里程碑 4：让 Review / Unit Tests 变成 stack-aware

### 目标

让审查与测试命令优先遵循 schema/context，而非仅依赖仓库文件猜测。

### 涉及文件

- `references/phase-3-review.md`
- `references/phase-5-unit-tests.md`
- `references/recovery-guardrails-appendix.md`
- 复用：
  - `scripts/opsx-change-context.sh`
  - `scripts/opsx-resolve-verify.sh`

### 改动内容

#### 4.4.1 Review 基准增强

当 schema=`yzw-workflow` 时：

review baseline =

- `shared.context`
- stack.context
- 对应 standards 文档
- AGENTS.md / CLAUDE.md 补充规则

重点检查方向：

- backend：API 设计、数据库、命名、事务、测试规范
- frontend：组件结构、状态管理、TS 风格、测试规范
- fullstack：两者叠加 + 跨端契约一致性

#### 4.4.2 Phase 5 测试命令优先级调整

测试命令解析优先级建议改为：

1. schema/stacks 派生的验证或测试命令
2. `openspec/config.yaml` 明示规则
3. 仓库构建文件推导
4. 让用户确认

说明：

- verify 命令与单元测试命令不是同一个概念
- 对部分项目可允许 verify 覆盖 unit test 命令，但须在 schema/仓库约定中明确

### 验收标准

- backend/frontend/fullstack 的 review 关注点可区分
- 单测命令不再完全依赖仓库启发式猜测

---

## 5. 文件级改造清单

## 5.1 文档文件

### 必改

- `SKILL.md`
- `references/phase-0-entrance.md`
- `references/phase-1-propose.md`
- `references/phase-2-apply.md`
- `references/phase-3-review.md`
- `references/phase-4-archive.md`
- `references/phase-5-unit-tests.md`
- `references/recovery-guardrails-appendix.md`

### 新增

- `references/schema-adapter.md`
- `references/schema-migration-plan.md`（本文）

## 5.2 脚本文件

### 必改

- `scripts/opsx-selftest.sh`
- 视需要更新：
  - `scripts/opsx-instructions.sh`
  - `scripts/opsx-instructions-apply.sh`

### 新增

- `scripts/opsx-detect-schema.sh`
- `scripts/opsx-change-context.sh`
- `scripts/opsx-ensure-change-meta.sh`
- `scripts/opsx-resolve-verify.sh`
- 可选：`scripts/opsx-run-verify.sh`

---

## 6. 推荐实施顺序

按推荐优先级执行：

1. **先做识别，不先改流程**
   - `opsx-detect-schema.sh`
   - `references/schema-adapter.md`
   - Phase 0 文档更新

2. **再做 Propose / Apply 适配**
   - 支持 `adr`
   - 支持 `.openspec.yaml` / `stacks`
   - apply context 合并

3. **再做 verify / archive 门禁**
   - verify 命令解析
   - Phase 4 前置 gate

4. **最后做 Review / Unit Tests 细化**
   - stack-aware 审查
   - stack-aware 测试命令

原因：

- 识别层是后续所有逻辑的前提
- Phase 1/2 是与 schema 耦合最深的部分
- verify gate 会改变主流程，应在上下文与 stacks 稳定后引入
- review/test 适合作为增强项最后落地

---

## 7. 风险与规避策略

## 7.1 规则双写与漂移

### 风险

- `openspec/config.yaml` 一套 rules
- `references/` 再复制一套
- 长期容易不一致

### 规避

- `references/` 中尽量只描述“读取 schema/config 并执行”
- 少把 stack rules 原文复制进 phase 文档

## 7.2 过度依赖 OpenSpec JSON 结构

### 风险

- 不同版本 CLI 的 JSON 字段可能变化

### 规避

- 尽量把 JSON 解析集中在少数脚本里
- `references/` 不直接依赖具体字段细节
- 继续保留 appendix 中“以实际 CLI 输出为准”的降级说明

## 7.3 把 Git 生命周期错误下沉到 schema

### 风险

- schema 承担了它不擅长的 commit/push/merge 职责

### 规避

- 明确边界：Git 生命周期仍由 skill 控制
- schema 仅输出 verify/baseline/context/rules

## 7.4 `.openspec.yaml` 缺失导致后续阶段分支复杂

### 风险

- Apply / Review / Verify / Test 都需要 stacks，但若在后期才补，会增加兜底逻辑

### 规避

- 最晚在 Phase 1 Step 3 补齐 `.openspec.yaml`

---

## 8. 测试与回归建议

## 8.1 自测场景矩阵

建议至少覆盖以下场景：

1. 默认 schema 项目：
   - 新建 change
   - propose -> apply -> archive

2. `yzw-workflow` + backend：
   - 自动识别 schema
   - 补 `.openspec.yaml`
   - 得到 backend verify 命令

3. `yzw-workflow` + frontend：
   - apply context 含 frontend standards
   - Phase 5 测试命令优先按 frontend 路径推导

4. `yzw-workflow` + fullstack：
   - shared + backend + frontend context 合并
   - verify 命令映射为 all / make validate

5. archive 前 verify 失败：
   - 不允许直接 archive
   - 能暂停 / 修复 / 重试

6. Phase 3 fix-cr 流程：
   - 不因 schema 变化破坏现有提案门禁

## 8.2 `opsx-selftest.sh` 升级建议

新增以下验证：

- 检测 schema 识别脚本输出
- 检测 `.openspec.yaml` 缺失/存在两种场景
- 检测 `opsx-resolve-verify.sh` 三类 stack 输出
- 检测默认 schema 路径不受影响

---

## 9. v1 实施建议

### 9.1 推荐的 v1 完成标准

本次先做到：

- schema 探测
- 支持 `adr`
- 补齐 `.openspec.yaml` / `stacks`
- apply context 合并
- archive 前 verify gate
- test 命令优先按 schema 推导

### 9.2 v1 暂不做

- 将 review 规则完全 schema 插件化
- 将 Git 提交流程完全 schema 化
- 多 schema 插件注册框架

结论：

v1 的目标是“**支持 `yzw-workflow` 的 schema-aware pipeline**”，不是“一次性做成完全通用的 schema framework”。

---

## 10. 建议的下一步执行动作

建议下一轮直接进入实现前 planning，并按以下顺序落任务：

1. 新增 `references/schema-adapter.md`
2. 新增 `scripts/opsx-detect-schema.sh`
3. 更新 `references/phase-0-entrance.md`
4. 新增 `scripts/opsx-ensure-change-meta.sh`
5. 更新 `references/phase-1-propose.md`
6. 新增 `scripts/opsx-change-context.sh`
7. 更新 `references/phase-2-apply.md`
8. 新增 `scripts/opsx-resolve-verify.sh`
9. 更新 `references/phase-4-archive.md`
10. 更新 `references/phase-5-unit-tests.md`
11. 更新 `references/phase-3-review.md`
12. 更新 `scripts/opsx-selftest.sh`

如果进入实现阶段，建议按上述顺序拆 Task，逐个落地并配合 `opsx-selftest.sh` 做回归。
