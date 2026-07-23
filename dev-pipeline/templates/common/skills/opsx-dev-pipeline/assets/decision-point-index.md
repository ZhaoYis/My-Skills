# dev-pipeline 决策点索引

> 本文件仅作决策点导航索引，不是规则正文；统一动作语义、保守恢复原则与跨阶段规则以 `assets/recovery-guardrails-appendix.md` 与相关 `references/phase-*.md` 为准。

本文件只保留当前 skill 仍需要的决策点索引与统一语义，不再保留历史梳理步骤。

## 1. 权威来源规则

为避免摘要层与执行层不一致，决策点信息遵循以下优先级：

1. `references/phase-*.md` 正文优先
2. `assets/recovery-guardrails-appendix.md` 负责跨阶段总览、恢复说明与降级规则
3. `SKILL.md` 只负责摘要、索引与入口说明，不单独定义新的执行语义

## 2. 决策点总表

| ID | Phase | 触发条件 | 主要选项 | 下一步 | 恢复续接点 | 权威来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | Phase 0 | 用户提供已有 change 且 change 存在 | 从当前阶段继续 / 从头开始（新建 change） / 终止流程 | 按状态续接到 Phase 1/2/3/5/6 | 由续接判断结果决定 | `references/phase-0-entrance.md` | 续接判断需覆盖已归档后的 git 场景 |
| 1c | Phase 1 | 制品生成前的需求理解确认 | 确认需求理解，开始生成制品（推荐） / 补充/修改需求理解 / 终止流程 | 确认后进入步骤 3 生成制品；补充则回到本决策点 | 当前 Phase 1 | `references/phase-1-propose.md` | B 类：探索→提案硬桥梁 |
| 1 | Phase 1 | 制品生成完成后进入提案门禁 | 确认提案，开始实施 / 提案不符合预期，我要补充/修改 / 终止流程 | 确认后进 Phase 2；修改则回到本决策点 | 当前 Phase 1 | `references/phase-1-propose.md` | 提案实施强门禁 |
| 1a | Phase 1 | 新建 change 时名称冲突 | 在已有 change 上继续 / 创建新名称 | 继续当前 change 或重新命名后继续 Phase 1 | 当前 Phase 1 | `references/phase-1-propose.md` | 名称冲突分支 |
| 2a | Phase 2 | `openspec instructions apply` 返回 `state: blocked` | 回到 Phase 1 补充制品 / 终止流程 | 回 Phase 1 或退出 | Phase 1 | `references/phase-2-apply.md` | apply 前置不足 |
| 2b | Phase 2 | 逐任务实施中遇到阻塞 | 提供补充说明 / 跳过此任务 / 终止流程 | 继续当前任务、跳过后继续或退出 | 当前 Phase 2 | `references/phase-2-apply.md` | 局部任务级分支 |
| 2 | Phase 2 | 所有任务完成 | 进入代码审查 / 暂停流水线，手动调整后继续 / 跳过审查，继续后续流程 / 终止流程 | 审查进 Phase 3；跳过审查进 Phase 5，再到 Phase 4 | Phase 3 | `references/phase-2-apply.md` | 跳过审查不应直接归档 |
| 3 | Phase 3 | 审查完成，按严重度分流 | 生成修复提案并应用 / 直接修复并重新审查 / 暂停流水线，手动调整后继续 / 继续后续流程 / 终止流程 | fix 提案走 3a 子流程；直接修复后回审查；继续后续流程进 Phase 5 | 当前 Phase 3 | `references/phase-3-review.md` | 主审查分流点 |
| 3a | Phase 3.1 | 用户选择生成修复提案并应用 | 确认提案，开始实施 / 提案不符合预期，我要补充/修改 / 终止流程 | 确认后执行 fix change 的 Phase 2；修改则留在子流程；终止则退出子流程 | fix 子流程内部或回原 change 的 Phase 5 | `references/phase-3.1-fix-review.md` | 复用 Phase 1 的三选项语义 |
| 4a | Phase 4 | 归档前发现未完成任务 | 继续归档 / 回到实施阶段 / 终止流程 | 继续归档、回 Phase 2 或退出 | Phase 2 | `references/phase-4-archive.md` | 高风险归档前分支 |
| 4b | Phase 5 | 审查完成、进入归档前单元测试门禁 | 编写/补充单元测试并运行通过 / 跳过单测 / 暂停流水线 | 通过或跳过后进 Phase 4 | Phase 5 | `references/phase-5-unit-tests.md` | 必经门禁，不得默认跳过 |
| 4c | Phase 4 | 归档完成后、决策点 4 之前（存在知识库时） | 沉淀知识到知识库（推荐） / 跳过沉淀，直接结束归档 | 沉淀后进决策点 4；跳过则直接进决策点 4 | Phase 4 步骤 16 | `references/phase-4-archive.md` | B 类：追加不覆盖；无知识库时自动跳过 |
| 4 | Phase 4 | 归档完成后 | 提交代码并合并到目标分支 / 仅提交并推送（不合并） / 终止流程 | 进入 Phase 6 或退出 | Phase 6 | `references/phase-4-archive.md` | 提交与合并的选择 |
| 5a | Phase 6 | 预提交检查发现分支落后或分叉 | pull --rebase / 继续后续流程（不先 rebase） / 终止流程 | 继续提交、保留风险继续或退出 | 当前 Phase 6 | `references/phase-6-merge-push.md` | 条件触发决策点 |
| 5b | Phase 6 | 预提交检查发现敏感文件 | 排除敏感文件后继续后续流程 / 继续后续流程（包含敏感文件） / 终止流程 | 继续或退出 | 当前 Phase 6 | `references/phase-6-merge-push.md` | 必须显式警告 |
| 5 | Phase 6 | 展示提交信息后 | 确认提交 / 修改提交信息 / 终止流程 | commit、重新编辑 message 或退出 | 当前 Phase 6 | `references/phase-6-merge-push.md` | 修改提交信息需自由文本 |
| 5c | Phase 6 | 推送失败 | pull --rebase 后重试 / 终止流程 | 重试推送或退出 | 当前 Phase 6 | `references/phase-6-merge-push.md` | 推送失败恢复 |
| 6 | Phase 6 | 决策点 4 选择”提交代码并合并”后 | 目标分支选择 / 合并策略选择 | 进入 merge | 当前 Phase 6 | `references/phase-6-merge-push.md` | 合并分支 |
| 6a | Phase 6 | 合并冲突 | 中止合并 / 使用对方版本 / 使用我方版本 / 暂停，手动解决 | 继续合并或退出 | 当前 Phase 6 | `references/phase-6-merge-push.md` | 合并冲突处理 |
| 6b | Phase 6 | 合并成功后 | 保留源分支 / 删除本地和远程源分支 | 完成最终收尾 | 当前 Phase 6 | `references/phase-6-merge-push.md` | 合并后分支清理 |

## 3. 统一动作语义

本节仅保留索引级术语对照；统一动作语义的规则正文以 `assets/recovery-guardrails-appendix.md` **§3.2** 为准。

- 优先使用 `继续后续流程`
- 优先使用 `暂停流水线，手动调整后继续`
- `终止流程` 统一表示结束当前流水线，不再自动推进后续 Phase
- 需要自由文本补充时，优先使用 `提案不符合预期，我要补充/修改` 或 `提供补充说明`
- fix-review 子流程复用 Phase 1 决策点 1 的三选项语义

## 4. 关键续接规则

本节仅保留导航摘要；已有 change 的续接与保守恢复原则以 `assets/recovery-guardrails-appendix.md` **§3.2** 与 `references/phase-0-entrance.md` 为准。

- 制品未完成 → Phase 1
- 制品已完成但任务未完成 → Phase 2
- 任务已完成且无审查报告 → Phase 3
- 任务已完成且已有审查报告、但未归档 → Phase 5
- 已归档后按 git 状态续接 Phase 6

## 5. 维护入口

- 流程入口：`SKILL.md`
- Phase 正文：`references/phase-*.md`
- 恢复与总览：`assets/recovery-guardrails-appendix.md`
