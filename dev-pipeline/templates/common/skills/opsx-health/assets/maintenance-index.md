# 维护索引

修改 `opsx-health` skill 时，优先检查以下联动关系：

## 文件职责

- `SKILL.md.hbs`
  - 入口说明、约束摘要、Phase 导航、权威来源地图、与其他能力的关系
- `references/phase-*.md`
  - 各阶段详细执行步骤（取 doctor 结果 / 报告与修复）
- `assets/report-template.md`
  - 健康报告结构（评分 / 维度 / 趋势 / 修复建议分级）

## 常见联动

- 修改 doctor 调用方式或字段消费时，同时更新：
  - `references/phase-1-run-doctor.md`
  - `../opsx-dev-pipeline/scripts/dev-pipeline-resolve-cli.sh`（CLI 解析回退顺序）
  - `scripts/opsx-health-run-doctor.sh`
  - 确认与 `opsx-dev-pipeline doctor --json` 实际输出字段一致
- 修改报告结构或分级口径时，同时更新：
  - `assets/report-template.md`
  - `references/phase-2-report-and-fix.md`
- 修改修复写入约定时，同时更新：
  - `references/phase-2-report-and-fix.md`
  - 确认与 `opsx-learn` 的 `write-targets.md` / `dedup-rules.md` / `knowledge-entry-templates.md` 仍一致

## 单源归属

- `doctor` CLI 是检查与评分的权威；本 skill 不重写检查规则。
- 知识库写入约定的权威是 `opsx-learn`；本 skill 引用而非复制。

## 维护检查单

- 是否仍要求中文输出
- 是否仍优先调用 doctor、不可用时显式降级
- 是否仍要求修复前用户确认（不静默写入）
- 报告是否仍含状态/评分、维度问题、P0–P3 修复建议
- 命令模板与 skill 入口路径是否一致
