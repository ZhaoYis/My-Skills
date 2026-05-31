# opsx-dev-pipeline 决策点盘点

本文件用于落实优化方案中的 Step A1：梳理现有决策点与流程分支。

目标不是重写整套流程，而是先建立一份统一、可执行的盘点基线，明确：

- 决策点有哪些
- 每个决策点的权威来源在哪里
- 触发条件、可选动作、下一步分别是什么
- 哪些地方已经一致，哪些地方存在冲突、缺失或引用错误
- 现有测试材料能覆盖到哪里，哪些仍缺行为级验证

## 权威来源规则

为避免后续继续出现“摘要层和执行层不一致”的问题，本盘点采用以下优先级：

1. **Phase 正文优先**：具体执行语义以对应 `references/phase-*.md` 正文为准
2. **附录负责总览**：跨阶段编号、恢复说明与降级规则以 `references/recovery-guardrails-appendix.md` 为总览来源
3. **SKILL.md 为摘要层**：流程图、索引和说明必须与上述两类文件保持一致，但不单独定义新的执行语义

## 决策点总表

| ID | Phase / Step | 触发条件 | 选项 | 下一步 | 恢复续接点 | AskQuestion fallback | 权威来源 | 当前状态 | 备注 |
|---|---|---|---|---|---|---|---|---|---|
| 0 | Phase 0 / Step 2a | 用户提供已有 change 且 change 存在 | 从 Phase X 继续 / 从头开始（新建 change）/ 终止流程 | 按状态续接到 Phase 1/2/3/5/6 | 由续接判断结果决定 | 编号选项 | `references/phase-0-entrance.md` | 语义不完整 | 需补“已归档、已推送、未合并”续接说明 |
| 1 | Phase 1 / Step 4 | 制品生成完成后进入提案门禁 | 确认提案，开始实施 / 提案不符合预期，我要补充/修改 / 终止流程 | 确认后进 Phase 2；修改则回到本决策点 | 当前 Phase 1 | 编号选项 | `references/phase-1-propose.md` | 一致 | 提案实施强门禁 |
| 1a | Phase 1 / Step 3 | 新建 change 时名称冲突 | 在已有 change 上继续 / 创建新名称 | 继续当前 change 或重新命名后继续 Phase 1 | 当前 Phase 1 | 编号选项 | `references/phase-1-propose.md` | 一致 | 无明显冲突 |
| 2a | Phase 2 / Step 5 | `openspec instructions apply` 返回 `state: blocked` | 回到 Phase 1 补充制品 / 终止流程 | 回 Phase 1 或退出 | Phase 1 Step 3/3.a | 编号选项 | `references/phase-2-apply.md` | 一致 | 与附录一致 |
| 2b | Phase 2 / Step 6 | 逐任务实施中遇到阻塞 | 提供补充说明 / 跳过此任务 / 终止流程 | 继续当前任务、跳过后继续或退出 | 当前 Phase 2 | 编号选项 | `references/phase-2-apply.md` | 一致 | 局部任务级分支 |
| 2 | Phase 2 / Step 7 | 所有任务完成 | 进入代码审查 / 暂停流水线，手动调整后继续 / 跳过审查，继续后续流程 / 终止流程 | 审查进 Phase 3；跳过审查进 Phase 5，再到 Phase 4 | 暂停后从 Phase 3 继续 | 编号选项 | `references/phase-2-apply.md` | 冲突 | 文件描述层曾出现“跳过审查直接归档”旧说法，应统一为 Phase 5 → Phase 4 |
| 3 | Phase 3 / Step 11 | 审查完成，按严重度分流 | 生成修复提案并应用 / 直接修复并重新审查 / 暂停流水线，手动调整后继续 / 继续后续流程 / 终止流程 | fix 提案走 3a 子流程；直接修复后回审查；继续后续流程进 Phase 5 | 暂停后回到 Phase 3 | 编号选项 | `references/phase-3-review.md` | 基本一致 | 11a/11b/11c 细项不同，但主语义稳定 |
| 3a | Phase 3.1 / Step c | 用户在决策点 3 选择“生成修复提案并应用” | 确认提案，开始实施 / 提案不符合预期，我要补充/修改 / 终止流程 | 确认后执行 fix change 的 Phase 2；修改则留在子流程；终止则退出子流程 | fix 子流程内部或回原 change Phase 5 | 编号选项 | `references/phase-3.1-fix-review.md` | 冲突 | 附录总览写成“确认修复 / 修改提案 / 放弃修复”，应以 Phase 1 三选项语义为准 |
| 4a | Phase 4 / Step 12 | 归档前发现未完成任务 | 继续归档 / 回到实施阶段 / 终止流程 | 继续归档、回 Phase 2 或退出 | Phase 2 | 编号选项 | `references/phase-4-archive.md` | 一致 | 高风险归档前分支 |
| 4b | Phase 5 / Step 16 | 审查完成、进入归档前单元测试门禁 | 需要：编写/补充单元测试并运行通过 / 不需要：跳过单测 / 暂停流水线 | 通过或跳过后进 Phase 4 | 暂停后从 Phase 5 Step 16 继续 | 编号选项 | `references/phase-5-unit-tests.md` | 一致 | 必经门禁，不得默认跳过 |
| 4 | Phase 4 / Step 16 | 归档完成后 | 提交代码并合并到目标分支 / 仅提交并推送（不合并）/ 终止流程 | 进入 Phase 6 或退出 | Phase 6 | 编号选项 | `references/phase-4-archive.md` | 一致 | 需与 SKILL 摘要同步 |
| 5a | Phase 6 / Step 17 | 预提交检查发现分支落后/分叉 | pull --rebase / 继续后续流程（不先 rebase） / 终止流程 | 继续提交、保留风险继续或退出 | 当前 Phase 6 | 编号选项 | `references/phase-6-merge-push.md` | 一致 | 条件触发决策点 |
| 5b | Phase 6 / Step 17 | 预提交检查发现敏感文件 | 排除敏感文件后继续后续流程 / 继续后续流程（包含敏感文件） / 终止流程 | 继续或退出 | 当前 Phase 6 | 编号选项 | `references/phase-6-merge-push.md` | 一致 | 必须显式警告 |
| 5 | Phase 6 / Step 18 | 展示提交信息后 | 确认提交 / 修改提交信息 / 终止流程 | commit、重新编辑 message 或退出 | 当前 Phase 6 | 编号选项 + 文本输入 | `references/phase-6-merge-push.md` | 一致 | 修改提交信息需自由文本 |
| 5c | Phase 6 / Step 19 | 推送失败 | pull --rebase 后重试 / 终止流程 | 重试推送或退出 | 当前 Phase 6 | 编号选项 | `references/phase-6-merge-push.md` | 一致 | 条件触发决策点 |
| 6 | Phase 6 / Step 20 | 决策点 4 选择“提交代码并合并”后 | 目标分支选择 / 合并策略选择 | 进入 merge | 当前 Phase 6 | 编号选项 | `references/phase-6-merge-push.md` | 一致 | 需避免与 Phase 5 编号混淆 |
| 6a | Phase 6 / Step 20 | 合并冲突 | 中止合并 / 使用对方版本 / 使用我方版本 / 暂停，手动解决 | 继续合并或退出 | 当前 Phase 6 | 编号选项 | `references/phase-6-merge-push.md` | 一致 | 冲突处理分支 |
| 6b | Phase 6 / Step 21 | 合并成功后 | 保留源分支 / 删除本地和远程源分支 | 完成最终收尾 | 当前 Phase 6 | 编号选项 | `references/phase-6-merge-push.md` | 一致 | 合并后分支处理 |

## 关键续接路径盘点

### Phase 0 已有 change 续接判断

当前已定义的续接路径：

- `applyRequires` 制品未完成 → `Phase 1 Step 3`
- 制品已完成但任务未完成 → `Phase 2`
- 任务已完成且无审查报告 → `Phase 3`
- 任务已完成且已有审查报告、但未归档 → `Phase 5`
- 已归档且工作区有未提交变更 → `Phase 6`
- 已归档且已提交但未推送 → `Phase 6 Step 19`

当前缺口：

- **已归档、已推送、未合并** 的续接说明缺失
- Step A1 建议统一为：从 `Phase 6 Step 20` 继续处理目标分支和合并策略

## 已识别冲突与缺口

### 1. Phase 2 “跳过审查”去向描述不一致

- 问题文件：`references/phase-2-apply.md`
- 问题表现：description 层有“跳过审查直接归档”的旧表述，而正文 Step 7 明确写为先进入 `Phase 5`，再进入 `Phase 4`
- 统一建议：以正文和 Phase 5 门禁要求为准，统一为：
  - `Phase 2 -> Phase 5 -> Phase 4`

### 2. 决策点 3a 选项标签不一致

- 问题文件：
  - `references/phase-3.1-fix-review.md`
  - `references/recovery-guardrails-appendix.md`
- 问题表现：
  - `phase-3.1-fix-review.md` 明确要求复用 `Phase 1` 的三选项
  - 附录总览将其写成“确认修复 / 修改提案 / 放弃修复（清理 change）”
- 统一建议：
  - 3a 应保持与 `Phase 1 决策点 1` 同一套选项标签
  - “放弃 fix change、回原 change 流程”保留为选后行为说明，而非替代选项标签

### 3. Phase 4 步骤编号引用错误

- 问题文件：`references/phase-4-archive.md`
- 问题表现：Step 15 误写为“步骤 13 关于 delta 的选择”，实际 delta 选择发生在 Step 14
- 统一建议：修正文案引用，不改变流程语义

### 4. Phase 4 description 与正文步骤范围不一致

- 问题文件：`references/phase-4-archive.md`
- 问题表现：description 写“全局步骤 12–15，含决策点 4”，但正文实际覆盖到 Step 16
- 统一建议：description 应与正文一致，覆盖 `12–16`

### 5. Phase 0 续接说明不完整

- 问题文件：`references/phase-0-entrance.md`
- 问题表现：description 和正文都未完整覆盖“已归档、已推送、未合并”的恢复入口
- 统一建议：补充该分支，并在摘要层同步

## 分层说明

### SKILL.md

角色：摘要层与全局流程入口。

职责：
- 给出 Phase 索引
- 给出流程顺序与决策点总览
- 强化全局 guardrails

注意：
- 不应单独定义与 phase 正文冲突的新执行语义
- 一旦 phase/recovery 文档调整，`SKILL.md` 必须同步

### references/phase-*.md

角色：执行层。

职责：
- 定义每个 Phase 的进入条件、步骤、决策点、下一步
- 对当前 Phase 的具体行为给出权威描述

### references/recovery-guardrails-appendix.md

角色：总览层与恢复层。

职责：
- 提供 AskQuestion fallback
- 提供 Error Handling
- 提供中断恢复与决策点总览

注意：
- 可以压缩摘要，但不应与 phase 正文语义冲突

## 测试覆盖基线与缺口

`tests/pipeline-branch-matrix.md` 可作为本步骤的覆盖对象基线，但它只代表：

- 预期需要覆盖哪些决策点和分支
- 哪些 phase/恢复路径已经被纳入矩阵

它**不等于**：

- 每个分支都已经通过行为级测试
- 每个恢复路径都有可追溯日志

### 当前可作为基线的材料

- `tests/pipeline-branch-matrix.md`
- `tests/comprehensive-pipeline-test.sh`
- `tests/advanced-pipeline-test.sh`
- `tests/comprehensive-test-results.log`
- `tests/pipeline-test-findings.md`

### 当前主要缺口

- 缺少多数决策点的逐条行为验证
- 缺少恢复分支的真实执行日志
- 缺少 Phase 6 大部分分支的行为级验证
- 缺少 fix-cr 子流程与 archive 未完成项分支的可追溯验证
- 现有 branch coverage 材料存在路径/执行环境问题，不能直接作为通过证据

## Step A2 文案统一规则

为减少不同 Phase 间的动作语义漂移，后续所有决策点文案统一遵循以下规则：

- 优先使用 `继续后续流程`，避免与带风险判断色彩的 `忽略问题` 混用
- 优先使用 `暂停流水线，手动调整后继续`，避免在不同 Phase 间出现“手动修复后继续”“手动调整后继续”等多套表达
- `终止流程` 统一表示结束当前流水线，不再自动推进后续 Phase
- 需要用户通过自由文本补充时，统一使用 `提案不符合预期，我要补充/修改` 或 `提供补充说明`，不使用模糊短语
- 需要退出当前可选环节并进入主干下一阶段时，统一使用 `继续后续流程`
- fix-review 子流程继续复用 Phase 1 决策点 1 的三选项，不单独发明另一套标签

这些规则的权威落点仍为各 `references/phase-*.md` 正文；附录与 `SKILL.md` 仅做同步摘要。

## Step A1 结论

Step A1 的核心结论如下：

1. 当前流程结构整体清晰，主干顺序稳定
2. 决策点的权威执行语义应继续以 `phase-*.md` 正文为准
3. `recovery-guardrails-appendix.md` 适合作为统一总览，但需修正与正文不一致的部分
4. `SKILL.md` 是摘要层，必须在修正文档后同步收敛
5. 在进入 Step A2 之前，至少应先完成以下文档修正：
   - `references/phase-2-apply.md`
   - `references/phase-3.1-fix-review.md`
   - `references/phase-4-archive.md`
   - `references/phase-0-entrance.md`
   - `references/recovery-guardrails-appendix.md`
   - `SKILL.md`
