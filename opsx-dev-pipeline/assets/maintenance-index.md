# opsx-dev-pipeline 维护映射与联动检查

本页用于维护 `SKILL.md`、`references/`、`scripts/`、`assets/` 之间的映射关系，以及高频改动场景下的联动检查清单。

使用原则：
- 先在本页定位受影响范围，再去改具体文件
- Phase 与跨阶段规则正文分别以 `references/phase-*.md` 与 `assets/recovery-guardrails-appendix.md` 为准
- 决策点索引以 `assets/decision-point-index.md` 为准
- 脚本输出契约以 `assets/script-io-conventions.md` 为准
- 恢复与异常导航以 `assets/failure-recovery-index.md` 为准
- 回归入口优先使用 `bash tests/run-all.sh`（统一入口）；快速契约自检可用 `scripts/opsx-selftest.sh`

## 2. 文档类型分层与约束

| 文档类型 | 文件 | 允许承载的内容 | 禁止承载的内容 |
| --- | --- | --- | --- |
| 入口文档 | `SKILL.md` | 入口摘要、阅读顺序、Phase 导航、权威来源地图 | 长规则正文、第二份决策规则、第二份恢复总则 |
| 正文文档 | `references/phase-*.md`、`assets/recovery-guardrails-appendix.md` | 执行步骤、命令、阶段内决策点、跨阶段规则、Error Handling | 历史测试记录、仅维护用途的索引矩阵 |
| 索引文档 | `assets/decision-point-index.md`、`assets/failure-recovery-index.md`、`assets/maintenance-index.md` | 导航、矩阵、反查关系、维护说明 | 第二份规则正文、与正文冲突的解释段 |
| 专题文档 | `assets/schema-adapter-summary.md`、`assets/script-io-conventions.md` | schema 差异、脚本 I/O 契约、专题约束 | 与 Phase 正文冲突的流程主线定义 |
| 历史记录 / 测试输出 | `tests/logs/*.log` | 测试结果、历史结论、归档记录 | 当前规范权威、自动检查的唯一事实来源 |

维护约束：
- 历史记录不得充当规则权威来源
- 索引文档不得重新发明规则正文
- 入口文档不得扩写成长规则说明
- 如需新增规则，优先判断应写入 `references/phase-*.md` 还是 `assets/recovery-guardrails-appendix.md`

## 3. plan-first 维护流程

1. 先识别本次改动类型
2. 定位主权威文件
3. 列出需要同步更新的摘要层 / 索引层 / 支撑文件
4. 先改正文，再改索引，最后改入口摘要
5. 运行对应验证脚本与手工检查
6. 做一次单源一致性检查，确认没有产生第二份规则正文

## 2. 变更类型 → 权威文件矩阵

| 变更类型 | 主权威文件 | 次级索引 / 维护文件 | 入口摘要文件 | 必查脚本 / 测试 |
| --- | --- | --- | --- | --- |
| 决策点选项变化 | `references/phase-*.md` | `assets/decision-point-index.md`、`assets/maintenance-index.md` | `SKILL.md` | `tests/comprehensive-pipeline-test.sh`、`tests/final-validation.sh` |
| 决策自动化分级变化 | `assets/recovery-guardrails-appendix.md` | `assets/decision-point-index.md`、`assets/maintenance-index.md` | `SKILL.md` | `tests/final-validation.sh` |
| 已有 change 续接规则变化 | `references/phase-0-entrance.md`、`assets/recovery-guardrails-appendix.md` | `assets/decision-point-index.md`、`assets/failure-recovery-index.md`、本页 | `SKILL.md` | `tests/comprehensive-pipeline-test.sh`、`tests/final-validation.sh` |
| AskQuestion fallback 变化 | `assets/recovery-guardrails-appendix.md` | `assets/decision-point-index.md`、本页 | `SKILL.md` | `tests/final-validation.sh` |
| Error Handling 变化 | `assets/recovery-guardrails-appendix.md` | `assets/failure-recovery-index.md`、本页 | `SKILL.md` | `tests/integrity-check.sh`、`tests/final-validation.sh` |
| schema-aware 规则变化 | `assets/schema-adapter-summary.md`、`assets/recovery-guardrails-appendix.md` | `assets/failure-recovery-index.md`、本页 | `SKILL.md` | `bash scripts/opsx-selftest.sh`、schema 相关流程测试 |
| verify 解析规则变化 | `references/phase-4-archive.md`、`assets/script-io-conventions.md` | `assets/failure-recovery-index.md`、本页 | `SKILL.md` | `bash scripts/opsx-selftest.sh`、`tests/integrity-check.sh` |
| 脚本 I/O 变化 | `assets/script-io-conventions.md` | 所有关联 `references/phase-*.md`、本页 | `SKILL.md` | `bash scripts/opsx-selftest.sh`、`bash -n scripts/*.sh` |
| Phase 门禁 / 顺序变化 | 对应 `references/phase-*.md` | `assets/decision-point-index.md`、`assets/failure-recovery-index.md`、本页 | `SKILL.md` | `tests/comprehensive-pipeline-test.sh`、`tests/final-validation.sh` |

## 3. 变更类型 → 同步更新矩阵

| 变更类型 | 必须同步检查的文件 | 同步重点 |
| --- | --- | --- |
| 决策点选项变化 | `SKILL.md`、`assets/decision-point-index.md`、相关 `references/phase-*.md`、本页 | 入口摘要、索引表、阶段正文是否一致 |
| 决策自动化分级变化 | `SKILL.md`、`assets/decision-point-index.md`、`assets/recovery-guardrails-appendix.md`、本页 | 摘要描述、索引术语、唯一正文位置 |
| 已有 change 续接规则变化 | `SKILL.md`、`references/phase-0-entrance.md`、`assets/recovery-guardrails-appendix.md`、`assets/decision-point-index.md`、`assets/failure-recovery-index.md`、本页 | 入口判断、保守恢复、索引摘要 |
| AskQuestion fallback 变化 | `SKILL.md`、`assets/recovery-guardrails-appendix.md`、相关 phase 文件、`assets/decision-point-index.md` | 所有决策点降级文案 |
| Error Handling 变化 | `SKILL.md`、`assets/recovery-guardrails-appendix.md`、`assets/failure-recovery-index.md`、相关 phase 文件 | 异常场景与恢复动作 |
| schema-aware 规则变化 | `SKILL.md`、`assets/schema-adapter-summary.md`、`references/phase-2-apply.md`、`references/phase-4-archive.md`、`references/phase-5-unit-tests.md`、`assets/failure-recovery-index.md` | custom schema 路径与门禁边界 |
| verify 解析规则变化 | `assets/script-io-conventions.md`、`references/phase-4-archive.md`、`assets/failure-recovery-index.md`、本页 | verify 候选、失败恢复、脚本契约 |
| 脚本 I/O 变化 | `assets/script-io-conventions.md`、所有消费该脚本的 phase 文档、`SKILL.md`、本页 | 参数、字段、退出码、调用方假设 |
| Phase 门禁 / 顺序变化 | `SKILL.md`、相关 `references/phase-*.md`、`assets/decision-point-index.md`、`assets/failure-recovery-index.md`、本页 | Phase 导航、流程图、索引与恢复矩阵 |

## 4. 变更类型 → 验证矩阵

| 变更类型 | 自动验证 | 手工检查 |
| --- | --- | --- |
| 决策点选项变化 | `tests/comprehensive-pipeline-test.sh`、`tests/final-validation.sh` | 从 `SKILL.md` 能否快速定位到正确决策点正文 |
| 决策自动化分级变化 | `tests/final-validation.sh` | 检查是否只剩 appendix 一份正文 |
| 已有 change 续接规则变化 | `tests/comprehensive-pipeline-test.sh`、`tests/final-validation.sh` | 演练 `baseline-resume-existing-change` |
| AskQuestion fallback 变化 | `tests/final-validation.sh` | 检查编号选项与 phase 文案是否一致 |
| Error Handling 变化 | `tests/integrity-check.sh`、`tests/final-validation.sh` | 随机抽 3 个失败场景跳转到正文 |
| schema-aware 规则变化 | `bash scripts/opsx-selftest.sh` | 演练 `baseline-custom-schema-fullstack-mainline` |
| verify 解析规则变化 | `bash scripts/opsx-selftest.sh`、`tests/integrity-check.sh` | 检查 verify 失败路径是否仍能导航到 appendix |
| 脚本 I/O 变化 | `bash scripts/opsx-selftest.sh`、`bash -n scripts/opsx-preflight.sh scripts/opsx-detect-schema.sh scripts/opsx-change-context.sh scripts/opsx-resolve-verify.sh scripts/opsx-selftest.sh` | 核对调用文档是否引用了最新字段 |
| Phase 门禁 / 顺序变化 | `tests/comprehensive-pipeline-test.sh`、`tests/final-validation.sh` | 检查流程图、Phase 表与 phase 正文是否一致 |

## 6. 自动检查排除策略

在做完整性扫描、grep 残留检查、结构校验时，应优先区分“当前规范”与“历史输出”：

- 通常应排除：
  - `tests/logs/*.log`
  - 仅用于记录历史结论的 markdown
- 若扫描目标是“规范残留”或“硬编码残留”，历史测试输出默认不作为权威输入
- 若扫描目标是“用户可见说明”或“对外文档”，可按需要把历史 markdown 纳入结果
- 验证脚本中的路径假设若依赖当前目录结构，改动结构时必须同步更新对应 `tests/*.sh`

## 7. 常见遗漏点清单

- 改了 `assets/recovery-guardrails-appendix.md`，没同步 `assets/decision-point-index.md`
- 改了脚本字段或退出码，没同步 `assets/script-io-conventions.md`
- 改了已有 change 续接规则，没同步 `SKILL.md` 与 `assets/failure-recovery-index.md`
- 改了 verify 逻辑，没同步 `references/phase-4-archive.md` 与 `assets/failure-recovery-index.md`
- 改了 phase 门禁或顺序，没同步 `SKILL.md` 的 Phase 导航或流程图
- 改了 schema-aware 规则，没同步 `assets/schema-adapter-summary.md`
- 改了索引文档后，又在其中重新写回第二份规则正文

## 8. Phase / reference / script 主映射表

| Phase | 步骤范围 | 主 references 文件 | 直接调用脚本 | 复用脚本 | 无脚本/人工步骤 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | 1–2 | `references/phase-0-entrance.md` | `opsx-preflight.sh`、`opsx-detect-schema.sh`、`opsx-change-status.sh`、`opsx-list-changes.sh` | - | 入口问询、续接判断 | 负责环境预检、schema 探测、change 续接入口 |
| 1 | 3–4 | `references/phase-1-propose.md` | `opsx-new-change.sh`、`opsx-change-status.sh`、`opsx-instructions.sh`、`opsx-ensure-change-meta.sh` | `opsx-validate-change.sh` | 提案澄清与确认 | 负责新建 change、生成制品、补齐 change 元数据 |
| 2 | 5–7 | `references/phase-2-apply.md` | `opsx-instructions-apply.sh` | `opsx-change-context.sh` | 逐任务处理、实施完成确认 | 自定义 schema 主路径优先复用 `opsx-change-context.sh` |
| 3 | 8–11 | `references/phase-3-review.md` | - | `opsx-change-context.sh` | git diff、代码审查、修复回环决策 | schema-aware 场景复用上下文脚本 |
| 3.1 | review 修复子流程 | `references/phase-3.1-fix-review.md` | `opsx-archive.sh` | `opsx-instructions-apply.sh` | 修复提案确认与恢复 | fix-review 会文字复用 Phase 2 Apply 路径 |
| 4 | 12–16 | `references/phase-4-archive.md` | `opsx-change-status.sh`、`opsx-resolve-verify.sh`、`opsx-archive.sh` | `opsx-validate-change.sh`、`opsx-change-context.sh` | 归档决策、归档后 git 选择 | `opsx-change-context.sh` 在 verify 解析失败时作回退补充 |
| 5 | 16 | `references/phase-5-unit-tests.md` | - | `opsx-change-context.sh` | 测试命令确认、门禁选择 | 主要复用 schema-aware 上下文 |
| 6 | 17–22 | `references/phase-6-merge-push.md` | - | - | 预提交、提交、推送、合并、删分支 | 主要是内联 git 流程 |
| 附录 | 跨阶段 | `assets/recovery-guardrails-appendix.md` | 说明性引用：`opsx-detect-schema.sh`、`opsx-archive.sh` | - | AskQuestion fallback、恢复、错误处理 | 规则汇总，不是主执行入口 |

## 9. 高复用脚本反向影响表

| 脚本名 | 被哪些 Phase 使用 | 关联 references | 调用性质 | 变更后必查项 |
| --- | --- | --- | --- | --- |
| `scripts/opsx-change-status.sh` | 0、1、4 | `phase-0-entrance.md`、`phase-1-propose.md`、`phase-4-archive.md` | 首选 | `SKILL.md` 入口摘要、Phase 续接说明、归档前状态判断、自测中的 change 状态断言 |
| `scripts/opsx-change-context.sh` | 2、3、4、5 | `phase-2-apply.md`、`phase-3-review.md`、`phase-4-archive.md`、`phase-5-unit-tests.md` | 首选 / 回退 / schema-aware only | schema/context/standards 说明、verify 回退逻辑、Phase 2/3/5 上下文复用、自定义 schema 自测 |
| `scripts/opsx-archive.sh` | 3.1、4 | `phase-3.1-fix-review.md`、`phase-4-archive.md` | 首选 | fix-review 归档路径、Phase 4 归档说明、归档后状态切换、自测中的 archive 断言 |
| `scripts/opsx-validate-change.sh` | 1、4 | `phase-1-propose.md`、`phase-4-archive.md` | 可选 | 提案门禁说明、归档前校验说明、`--strict` 透传、自测中的 validate 断言 |
| `scripts/opsx-detect-schema.sh` | 0、附录 | `phase-0-entrance.md`、`recovery-guardrails-appendix.md` | 首选 | schema 探测说明、custom schema 分支、archived change 探测、自测中的 schema 断言 |
| `scripts/opsx-resolve-verify.sh` | 4 | `phase-4-archive.md` | 首选 | verify 解析优先级、warning/fallback 语义、Phase 5→4 交接、自测中的 verify 命令断言 |

## 10. 维护时优先复用的资料

- 决策点与确认等级：`assets/decision-point-index.md`
- 脚本输出约定：`assets/script-io-conventions.md`
- 恢复与异常路径：`assets/failure-recovery-index.md`
- 脚本自检入口：`scripts/opsx-selftest.sh`
- 流程完整性与综合回归：
  - `tests/run-all.sh`（统一入口，默认跑 integrity + coverage + regression + validation）
  - `tests/integrity-check.sh`、`tests/final-validation.sh`（可由 run-all 单独调用：`--only integrity` / `--only validation`）
  - `tests/comprehensive-pipeline-test.sh`（兼容别名，等同 `--only regression`）

## 11. 回归基线资料入口

后续修改关键脚本、Phase 判路规则或恢复语义时，优先回查以下基线样例：

- `baseline-resume-existing-change`
- `baseline-skip-review-to-phase5-archive`
- `baseline-pause-resume-after-archive`
- `baseline-custom-schema-fullstack-mainline`
- `baseline-custom-schema-single-stack-verify`

当前关键脚本调用预算基线：
- `opsx-detect-schema.sh = 7`
- `opsx-change-status.sh = 6`
- `opsx-change-context.sh = 7`
- `opsx-resolve-verify.sh = 9`

推荐优先回查场景：
- 修改 `opsx-detect-schema.sh`、`opsx-change-status.sh`、`opsx-change-context.sh`、`opsx-resolve-verify.sh`
- 修改 Phase 0 / 4 / 5 的判路规则
- 修改暂停恢复、已归档后续接、custom schema / stacks 相关规则

样例来源优先级：
1. `scripts/opsx-selftest.sh`
2. `tests/pipeline-test/pipeline-branch-matrix.md`
3. `assets/failure-recovery-index.md`
