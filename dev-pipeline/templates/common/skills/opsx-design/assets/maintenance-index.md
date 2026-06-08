# 维护索引

修改 `opsx-design` skill 时，优先检查以下联动关系：

## 文件职责

- `SKILL.md.hbs`
  - 入口说明、约束摘要、Phase 导航、权威来源地图、与其他能力的关系
- `references/phase-*.md`
  - 各阶段详细执行步骤
- `assets/section-skeleton.md`
  - 通用章节骨架（决定设计结构）
- `assets/quality-checklist.md`
  - 质量门禁逐条自检项
- `assets/impact-summary-template.md`
  - 改动影响汇总表结构（含"不受影响"分区）

## 常见联动

- 修改章节骨架时，同时更新：
  - `assets/section-skeleton.md`
  - `references/phase-2-author-sections.md`
  - `assets/quality-checklist.md`（确保门禁覆盖新章节）
- 修改质量门禁时，同时更新：
  - `assets/quality-checklist.md`
  - `references/phase-3-quality-gate.md`
  - `SKILL.md.hbs` 的约束摘要
- 修改影响汇总表结构时，同时更新：
  - `assets/impact-summary-template.md`
  - `assets/section-skeleton.md` 第 2 节
- 修改验证断言字段约定时，同时更新：
  - `assets/section-skeleton.md` 第 8 节
  - `references/phase-2-author-sections.md`
  - 并确认与 `opsx-verify` 的 `assets/verify-target-template.md` 仍能对接

## 与 Pipeline 的单源归属

- 本 skill 是"如何写好设计"的能力库；`opsx-dev-pipeline` Phase 1 是"何时必须产出 design"的门禁权威。
- 不要把 Phase 1 的门禁规则正文复制到这里，只在 `phase-1-propose.md` 引用本 skill。

## 维护检查单

- 是否仍要求中文输出
- 是否仍强制"影响汇总表至少 1 个不受影响项"
- 是否仍强制"必含验证断言字段"
- 是否仍强制"任务=一文件"粒度
- 是否仍保持命令"按项目基准"、无写死技术栈词
- 命令模板与 skill 入口路径是否一致
