# 维护索引

修改 `opsx-clarify` skill 时，优先检查以下联动关系：

## 文件职责

- `SKILL.md.hbs`
  - 入口说明、约束摘要、Phase 导航、权威来源地图、与其他能力的关系
- `references/phase-*.md`
  - 各阶段详细执行步骤（识别 / 生成 / 交付）
- `assets/ambiguity-types.md`
  - 不明确点分类（识别依据）
- `assets/question-list-template.md`
  - 问题清单结构与填写规则
- `scripts/opsx-clarify-preflight.sh`
  - 预检仓库上下文与文档入口

## 常见联动

- 修改不明确点分类时，同时更新：
  - `assets/ambiguity-types.md`
  - `references/phase-1-detect-ambiguity.md`
- 修改问题清单结构或优先级口径时，同时更新：
  - `assets/question-list-template.md`
  - `references/phase-2-build-question-list.md`
- 修改对外分享策略时，同时更新：
  - `references/phase-3-deliver.md`
  - `SKILL.md.hbs` 的约束摘要（确保仍不内置任何平台凭据）

## 与其他能力的分工

- `opsx-analysis` 的 phase-1-clarify 负责分析内澄清；本 skill 负责独立产出可分享清单。
- 改动二者分工时，同步 README 的说明，避免职责漂移。

## 维护检查单

- 是否仍要求中文输出
- 问题是否仍要求"具体可回答 + 标优先级 + 标关联位置"
- 是否仍坚持"不猜测、不替用户决策"
- 对外发送是否仍抽象为平台无关、不内置凭据
- 无外部凭据时是否仍能完整产出
- 命令模板与 skill 入口路径是否一致
