# 维护索引

修改 `opsx-analysis` skill 时，优先检查以下联动关系：

## 文件职责

- `SKILL.md.hbs`
  - 入口说明、约束摘要、Phase 导航、权威来源地图
- `references/phase-*.md`
  - 各阶段详细执行步骤
- `assets/analysis-output-template.md`
  - 默认分析输出结构
- `assets/question-checklist.md`
  - 澄清问题与信息缺口检查项
- `assets/evidence-standards.md`
  - 结论证据来源与分级规则
- `scripts/opsx-analysis-preflight.sh`
  - 预检知识库、文档与常见上下文落点

## 常见联动

- 修改分析主流程时，同时更新：
  - `SKILL.md.hbs` 中的 Phase 表
  - 对应 `references/phase-*.md`
- 修改默认分析输出时，同时更新：
  - `assets/analysis-output-template.md`
  - `references/phase-5-output-analysis.md`
- 修改探索上下文规则时，同时更新：
  - `references/phase-2-explore-context.md`
  - `assets/evidence-standards.md`
  - `scripts/opsx-analysis-preflight.sh`
- 修改澄清问题策略时，同时更新：
  - `assets/question-checklist.md`
  - `references/phase-1-clarify-requirement.md`
  - `references/phase-4-assess-impact.md`

## 维护检查单

- 是否仍要求中文输出
- 是否仍保持“先探索、后分析”
- 是否仍默认对话输出而非强制落盘
- 是否仍默认覆盖：功能点拆解、影响面分析、风险与待确认项
- 是否有残留的 OpenSpec / Java 分层硬假设
- 命令模板与 skill 入口路径是否一致
