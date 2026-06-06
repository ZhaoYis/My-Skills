# opsx-dev-pipeline skill 实施方案 v2

> 说明：本版是在上一轮 `IMPLEMENTATION_PLAN.md` 已落地后的基础上，继续通读当前 skill 结构后整理出的第二阶段优化计划。此次 `/deep-research` 工作流已执行，但其外部来源抓取结果未成功提取出可验证 claims，因此本文件主要基于**当前仓库现状**与已完成改造后的信息架构继续提出可执行优化项，而不是基于新的外部研究结论。

## 当前状态判断

当前仓库已经完成第一轮重要优化：

- `SKILL.md` 已收缩为入口 / 导航页
- `references/recovery-guardrails-appendix.md` 已强化为跨阶段规则正文
- `assets/decision-point-index.md` 与 `assets/failure-recovery-index.md` 已降重为索引/矩阵
- `assets/maintenance-index.md` 已升级为维护控制台
- 验证脚本已修复并通过

因此，v2 不再聚焦“大结构重写”，而是聚焦：

1. **一致性继续收口**：减少“仍然存在的轻度重复摘要”
2. **维护性增强**：让计划、索引、验证入口之间更闭环
3. **可执行性增强**：让维护者更容易按图施工，而不是再靠人工理解
4. **归档与测试资产整洁化**：降低历史报告与测试工件对维护判断的干扰

---

## v2 优化目标

### 目标 1：继续减少轻度重复信息

虽然第一轮已经做了大幅降重，但当前仍可能存在：

- `SKILL.md` 中的摘要语句与 appendix / phase docs 的轻度重复
- `decision-point-index.md` 中的“摘要级规则”仍可继续缩短
- `failure-recovery-index.md` 中部分恢复动作仍可进一步模板化

**目标**：继续把“规则解释”往正文集中，把索引和入口进一步收窄到“定位与跳转”。

---

### 目标 2：把计划与维护入口真正联动起来

目前已有：

- `IMPLEMENTATION_PLAN.md`
- `assets/maintenance-index.md`

但两者之间仍是“并列存在”，不是“联动使用”。

**目标**：让 `maintenance-index.md` 能直接引用实施计划中的阶段性维护模式，或让后续实施计划模板统一化，减少每次从头组织思路的成本。

---

### 目标 3：清理测试与历史报告对结构判断的干扰

本轮修复验证脚本时已经暴露一个问题：

- 历史测试报告（如 `tests/FINAL_TEST_REPORT.md`）中保留了旧术语/旧背景，会干扰基于 grep 的完整性检查

**目标**：对“历史报告 / 当前规范 / 当前测试结果”进行更明确分层，避免以后再出现“历史文本误伤自动检查”的问题。

---

### 目标 4：形成第二层维护规范

第一轮更偏“重构文档结构”；v2 更适合补齐“如何维护这套结构”的规范，例如：

- 哪些文件允许写规则正文
- 哪些文件只能写索引
- 哪些文件只能写历史结果
- 哪些测试日志不能被完整性检查当作权威输入

---

## v2 推荐改动项

### 1. 为 `assets/maintenance-index.md` 增加“文档类型约束”小节

建议新增一节，明确区分：

- **入口文档**：`SKILL.md`
- **正文文档**：`references/phase-*.md`、`references/recovery-guardrails-appendix.md`
- **索引文档**：`assets/decision-point-index.md`、`assets/failure-recovery-index.md`、`assets/maintenance-index.md`
- **专题文档**：`assets/schema-adapter-summary.md`、`assets/script-io-conventions.md`
- **历史记录 / 测试输出**：`tests/*.log`、`tests/FINAL_TEST_REPORT.md`

并明确约束：

- 历史记录不得充当规则权威来源
- 索引文档不得重新发明规则正文
- 入口文档不得扩写成长规则说明

**收益**：避免后续维护时又把说明写回错误层级。

---

### 2. 给 `IMPLEMENTATION_PLAN.md` 增加“已实施 / 未实施 / 下一轮候选”分区

当前 `IMPLEMENTATION_PLAN.md` 已有勾选项，适合继续增强为一个持续维护的计划文件。

建议补充三个区块：

- **已实施项**
- **待实施项**
- **下一轮候选优化项**

同时把本次 v2 中尚未动手的建议先放到“下一轮候选优化项”里。

**收益**：减少后续重复分析；让计划文件从“一次性说明”变成“持续演化记录”。

---

### 3. 新增“自动检查排除策略”说明

建议在以下至少一处增加说明：

- `assets/maintenance-index.md`
- 或新增 `assets/test-artifact-guidelines.md`

说明这些内容在自动完整性扫描中通常应排除或单独处理：

- `tests/FINAL_TEST_REPORT.md`
- `tests/*.log`
- 已归档的旧报告
- 仅用于历史记录的 markdown

并给出原则：

- 若扫描的是“规范残留”，应排除历史测试输出
- 若扫描的是“用户可见文档”，则可纳入 markdown 结果

**收益**：降低自动检查误报。

---

### 4. 对 `decision-point-index.md` 再做一轮“极简化”

虽然已经降重，但可以继续优化为更纯粹的索引卡片：

- 保留表格
- 删除更多解释性段落
- 增加“只读索引，不是规则正文”的醒目提示

如果需要保留说明，也统一写成：

- 一句话摘要
- 一条权威跳转

**收益**：进一步降低重新膨胀风险。

---

### 5. 对 `failure-recovery-index.md` 再做一轮模板化压缩

建议考虑把“推荐恢复动作”的语言统一成几个模板：

- 回到某 Phase
- 用户确认后继续
- 暂停并保留恢复点
- 终止流程
- 参考正文来源

这样可以减少矩阵中自由叙述的差异。

**收益**：降低维护时的措辞漂移，提高可扫描性。

---

### 6. 为验证脚本增加“当前 repo 结构约束注释”

本轮已修复：

- `tests/integrity-check.sh`
- `tests/final-validation.sh`

建议再补一层注释，说明脚本依赖的当前结构假设，例如：

- repo 根目录下必须有 `SKILL.md`
- `schema-adapter-summary.md` 在 `assets/` 下而非 `references/`
- 测试矩阵位于 `tests/pipeline-test/`
- 历史报告类文件在完整性扫描中应排除

**收益**：以后改结构时，维护者更容易同步更新测试脚本。

---

## v2 逐文件实施建议

### `assets/maintenance-index.md`
建议新增：
- 文档类型分层说明
- 自动检查排除策略
- 历史记录 / 测试输出不作为规则权威的说明

### `IMPLEMENTATION_PLAN.md`
建议增强：
- 已实施项
- 未实施项
- 下一轮候选优化项

### `assets/decision-point-index.md`
建议继续收窄：
- 压缩剩余说明段
- 更明确声明“仅索引，不是正文”

### `assets/failure-recovery-index.md`
建议继续模板化：
- 统一恢复动作描述形式
- 减少自然语言差异

### `tests/integrity-check.sh`
建议补注释：
- 当前目录结构依赖
- 扫描排除逻辑的原因

### `tests/final-validation.sh`
建议补注释：
- 根目录定位逻辑
- 排除历史报告的原因

---

## 推荐实施顺序（v2）

1. 先改 `assets/maintenance-index.md`
2. 再增强 `IMPLEMENTATION_PLAN.md`
3. 再微调 `assets/decision-point-index.md`
4. 再模板化 `assets/failure-recovery-index.md`
5. 最后给两个验证脚本补结构注释

原因：

- 先补维护规范，后补索引收窄
- 先补“如何维护”，再补“如何表达”
- 最后再把脚本注释补全，形成稳定的维护闭环

---

## v2 完成判定

当以下条件满足时，可认为第二轮优化完成：

- `assets/maintenance-index.md` 明确区分正文 / 索引 / 历史记录
- `IMPLEMENTATION_PLAN.md` 能持续记录已做与待做项
- `assets/decision-point-index.md` 不再出现容易被误读为正文的说明
- `assets/failure-recovery-index.md` 的恢复动作描述趋于模板化
- 两个验证脚本对当前 repo 结构的依赖已写明
- 现有验证脚本仍全部通过

---

## 备注

本版没有直接继续修改仓库文件，而是把第二阶段优化计划先整理到 `IMPLEMENTATION_PLAN_v2.md`，供后续按阶段执行。若继续落地，建议先从 `assets/maintenance-index.md` 开始。