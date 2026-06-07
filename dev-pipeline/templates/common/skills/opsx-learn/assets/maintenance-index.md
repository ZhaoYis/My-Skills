# 维护索引

修改 `opsx-learn` skill 时，优先检查以下联动关系：

## 文件职责

- `SKILL.md.hbs`
  - 入口说明、约束摘要、Phase 导航、权威来源地图
- `references/phase-*.md`
  - 各阶段详细执行步骤
- `assets/write-targets.md`
  - 写入位置选择原则
- `assets/dedup-rules.md`
  - 去重与合并约束
- `assets/knowledge-entry-templates.md`
  - 标准化知识条目格式
- `scripts/opsx-learn-preflight.sh`
  - 预检仓库上下文、已有知识目录与默认建议写入位置

## 常见联动

- 修改主流程阶段时，同时更新：
  - `SKILL.md.hbs` 中的 Phase 表
  - 对应 `references/phase-*.md`
- 修改写入策略时，同时更新：
  - `assets/write-targets.md`
  - `assets/dedup-rules.md`
  - `references/phase-5-review-and-write.md`
  - `scripts/opsx-learn-preflight.sh`
- 修改条目格式时，同时更新：
  - `assets/knowledge-entry-templates.md`
  - `references/phase-4-draft-knowledge.md`

## 维护检查单

- 是否仍要求中文输出
- 是否仍保留“先预检、后分析、再确认、最后落盘”
- 是否仍保留“首次使用默认 `.knowledge/`”
- 是否仍保持仓库无关 / 技术栈无关
- 是否有残留的特定项目目录假设
- 命令模板与 skill 入口路径是否一致
- knowledge templates 是否仍覆盖常见知识类型
