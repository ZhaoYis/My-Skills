# 维护索引

修改 `opsx-prototype` skill 时，优先检查以下联动关系：

## 文件职责

- `SKILL.md.hbs`
  - 入口说明、约束摘要、Phase 导航、权威来源地图、可选能力（feature flag）说明
- `references/phase-*.md`
  - 各阶段详细执行步骤（采集 / 抽取 / 交接）
- `assets/structured-requirement-template.md`
  - 结构化需求输出结构（界面/组件/交互/数据/状态/待确认）

## 常见联动

- 修改外部工具/降级策略时，同时更新：
  - `references/phase-1-collect-prototype.md`
  - `SKILL.md.hbs` 的可选能力说明与约束摘要
- 修改结构化要素维度时，同时更新：
  - `references/phase-2-extract-structure.md`
  - `assets/structured-requirement-template.md`
- 修改交接对象 / 输出去向时，同时更新：
  - `references/phase-3-handoff.md`
  - 确认与 `opsx-analysis` 输入、`opsx-clarify` 衔接一致

## Feature flag 单源

- 本 skill 由 feature flag `prototype` 控制，默认关闭。
- flag 定义与默认值以 `config/features.json` 为准；资产门禁以 `src/core/assets/manifest.ts` 中两条 `feature: 'prototype'` 资产为准。
- 改动 flag 行为时，同步 `config/features.json`、`manifest.ts`、README 可选能力说明与相关测试。

## 维护检查单

- 是否仍要求中文输出
- 外部工具是否仍表述为"可用则用，否则降级"
- 是否仍不内置任何 API Key / 平台凭据
- 输出是否仍为结构化需求（而非最终设计/实现）
- 是否仍默认关闭、显式开启 flag 才生成
- 命令模板与 skill 入口路径是否一致
