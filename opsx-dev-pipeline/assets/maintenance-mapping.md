# opsx-dev-pipeline 维护映射与联动检查

本页用于维护 `SKILL.md`、`references/`、`scripts/` 之间的映射关系，以及高频改动场景下的联动检查清单。

使用原则：
- 先在本页定位受影响范围，再去改具体文件
- 决策点语义以 `assets/decision-point-inventory.md` 为准
- 脚本输出契约以 `assets/script-output-conventions.md` 为准
- 恢复与异常路径以 `assets/failure-recovery-matrix.md` 为准
- 回归入口优先使用 `scripts/opsx-selftest.sh` 与 `tests/*.sh`

## 1. Phase / reference / script 主映射表

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
| 附录 | 跨阶段 | `references/recovery-guardrails-appendix.md` | 说明性引用：`opsx-detect-schema.sh`、`opsx-archive.sh` | - | AskQuestion fallback、恢复、错误处理 | 规则汇总，不是主执行入口 |

## 2. 高复用脚本反向影响表

| 脚本名 | 被哪些 Phase 使用 | 关联 references | 调用性质 | 变更后必查项 |
| --- | --- | --- | --- | --- |
| `scripts/opsx-change-status.sh` | 0、1、4 | `phase-0-entrance.md`、`phase-1-propose.md`、`phase-4-archive.md` | 首选 | `SKILL.md` 脚本表、Phase 续接说明、归档前状态判断、自测中的 change 状态断言 |
| `scripts/opsx-change-context.sh` | 2、3、4、5 | `phase-2-apply.md`、`phase-3-review.md`、`phase-4-archive.md`、`phase-5-unit-tests.md` | 首选 / 回退 / schema-aware only | schema/context/standards 说明、verify 回退逻辑、Phase 2/3/5 上下文复用、自定义 schema 自测 |
| `scripts/opsx-archive.sh` | 3.1、4 | `phase-3.1-fix-review.md`、`phase-4-archive.md` | 首选 | fix-review 归档路径、Phase 4 归档说明、归档后状态切换、自测中的 archive 断言 |
| `scripts/opsx-validate-change.sh` | 1、4 | `phase-1-propose.md`、`phase-4-archive.md` | 可选 | 提案门禁说明、归档前校验说明、`--strict` 透传、自测中的 validate 断言 |
| `scripts/opsx-detect-schema.sh` | 0、附录 | `phase-0-entrance.md`、`recovery-guardrails-appendix.md` | 首选 | schema 探测说明、custom schema 分支、archived change 探测、自测中的 schema 断言 |
| `scripts/opsx-resolve-verify.sh` | 4 | `phase-4-archive.md` | 首选 | verify 解析优先级、warning/fallback 语义、Phase 5→4 交接、自测中的 verify 命令断言 |

## 3. 文档维护触发矩阵

| 修改对象 | 需要同步检查的文件 | 检查内容 | 建议验证命令/测试 |
| --- | --- | --- | --- |
| 新增 / 删除 `scripts/opsx-*.sh` | `SKILL.md`、对应 `references/phase-*.md`、本页 | 脚本表是否同步、Phase 是否新增/删除调用、映射表是否补全 | `bash scripts/opsx-selftest.sh`、`tests/integrity-check.sh` |
| 脚本参数、输出字段或退出码变化 | `assets/script-output-conventions.md`、消费该脚本的 Phase 文档、附录、本页 | 参数说明、`status/reason/nextAction` 契约、逐脚本 I/O 分节、调用方文案与判断是否仍一致 | `bash scripts/opsx-selftest.sh`、`bash -n scripts/opsx-preflight.sh scripts/opsx-detect-schema.sh scripts/opsx-change-context.sh scripts/opsx-resolve-verify.sh scripts/opsx-selftest.sh` |
| Phase 步骤顺序、决策点或门禁调整 | `SKILL.md`、`references/recovery-guardrails-appendix.md`、`assets/decision-point-inventory.md`、本页 | Phase 引用表、步骤索引、流程图、附录决策点总览是否同步 | `tests/comprehensive-pipeline-test.sh`、`tests/final-validation.sh` |
| 高复用脚本改动 | 所有引用该脚本的 `references/phase-*.md`、`SKILL.md`、本页 | 复用场景是否仍成立、调用性质是否变化、回退路径是否受影响 | `bash scripts/opsx-selftest.sh`、相关 Phase 流程测试 |
| 新增 schema / custom schema 分支或 verify/context 规则调整 | `assets/schema-adapter.md`、`phase-2-apply.md`、`phase-4-archive.md`、`phase-5-unit-tests.md`、`assets/failure-recovery-matrix.md`、本页 | schema-aware 上下文、verify 解析、恢复路径、降级规则是否同步 | `bash scripts/opsx-selftest.sh`、schema 相关集成测试 |

## 4. 维护时优先复用的资料

- 决策点与确认等级：`assets/decision-point-inventory.md`
- 脚本输出约定：`assets/script-output-conventions.md`
- 恢复与异常路径：`assets/failure-recovery-matrix.md`
- 脚本自检入口：`scripts/opsx-selftest.sh`
- 流程完整性与综合回归：
  - `tests/integrity-check.sh`
  - `tests/comprehensive-pipeline-test.sh`
  - `tests/final-validation.sh`

## 5. 回归基线资料入口

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
3. `assets/failure-recovery-matrix.md`
