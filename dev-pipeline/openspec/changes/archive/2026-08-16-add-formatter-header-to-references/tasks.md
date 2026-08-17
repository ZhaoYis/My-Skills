## 1. 添加 YAML Frontmatter 到 Phase 模板文件

为 `src/templates/common/skills/opsx-dev-pipeline/references/` 下的 8 个 `.md.hbs` 模板文件在头部添加标准化的 YAML frontmatter 描述信息。

每个文件使用以下格式（用 Handlebars 注释包裹，确保渲染时不输出）：

```markdown
{{!--
---
type: phase-reference
phase: <N>
name: phase-<N>-<name>
description: |
  <phase description>
format: markdown-with-handlebars
---
--}}
```

- [x] 1.1 为 `phase-0-entrance.md.hbs` 添加 frontmatter（phase: 0，描述：环境预检与入口类型判断，识别已有 change / 新需求 / 系分文档 / 非 pipeline 续接）
- [x] 1.2 为 `phase-1-propose.md.hbs` 添加 frontmatter（phase: 1，描述：需求理解确认、创建 change、生成提案制品并获取用户确认）
- [x] 1.3 为 `phase-2-apply.md.hbs` 添加 frontmatter（phase: 2，描述：获取实施指令、逐任务实施并执行准出自审查门禁）
- [x] 1.4 为 `phase-3-review.md.hbs` 添加 frontmatter（phase: 3，描述：加载项目规范、执行代码审查、处理审查结果与修复子流程）
- [x] 1.5 为 `phase-4-unit-tests.md.hbs` 添加 frontmatter（phase: 4，描述：识别测试方式、执行单元测试门禁、处理技术债务记录）
- [x] 1.6 为 `phase-5-archive.md.hbs` 添加 frontmatter（phase: 5，描述：检查制品完成状态、verify 门禁、delta spec 同步、执行归档）
- [x] 1.7 为 `phase-6-commit-push.md.hbs` 添加 frontmatter（phase: 6，描述：预提交检查、分步暂存与提交、源分支推送与交付分支处理）
- [x] 1.8 为 `phase-7-merge-deliver.md.hbs` 添加 frontmatter（phase: 7，描述：目标分支合并、合并后验证与推送、完成状态、分支清理与标签）

## 2. 验证

- [x] 2.1 确认每个文件的 frontmatter 可被标准 YAML 解析器正确解析（去除 Handlebars 注释包裹后）
- [x] 2.2 确认 Handlebars 模板渲染不受 frontmatter 影响（注释包裹正确）
- [x] 2.3 运行 `npm run build` 确认构建通过
