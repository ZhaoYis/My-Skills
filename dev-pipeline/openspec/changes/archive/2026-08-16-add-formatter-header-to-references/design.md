## Context

当前 `opsx-dev-pipeline` skill 的 references 目录下有 8 个 phase 模板文件（phase-0 到 phase-7），这些文件都是 Markdown + Handlebars 格式。需要在每个文件头部添加标准化的 YAML frontmatter 元数据，使 AI 工具和用户能够快速识别文档类型、用途和格式规范。

约束条件：
- 模板文件使用 Handlebars 语法（`{{variable}}`、`{{#if}}`、`{{#each}}`）
- 添加的元数据不能影响现有模板的渲染逻辑
- 需要保持向后兼容性

## Goals / Non-Goals

**Goals:**
- 为所有 8 个 phase 模板文件添加统一的 YAML frontmatter 格式
- frontmatter 包含标准化的元数据字段（文档类型、阶段信息、用途说明、格式规范）
- 确保 frontmatter 不影响 Handlebars 模板渲染
- 提供清晰的文档结构，便于 AI 工具解析

**Non-Goals:**
- 不修改模板文件的主体内容
- 不改变 Handlebars 变量或逻辑
- 不创建新的模板文件或删除现有文件
- 不为其他目录的模板文件添加 frontmatter（仅限 references 目录）

## Decisions

### 1. 使用 YAML frontmatter 格式

**决策**: 采用标准的 YAML frontmatter 格式，使用 `---` 分隔符包裹元数据块。

**理由**: 
- YAML frontmatter 是 Markdown 文件的通用元数据标准
- 被 Jekyll、Hugo、Docusaurus 等主流静态站点生成器支持
- AI 工具和解析器广泛支持这种格式
- 人类可读性好

**替代方案**:
- JSON frontmatter：语法较繁琐，可读性差
- TOML frontmatter：支持度不如 YAML
- HTML 注释：不够结构化，解析复杂

### 2. Frontmatter 放置位置

**决策**: 将 frontmatter 放置在文件最开头，在第一个标题之前。

**理由**:
- 符合 YAML frontmatter 的标准约定
- 解析器可以从文件开头直接识别
- 不影响现有文档结构

**替代方案**:
- 放在文件末尾：不符合标准约定，解析器可能无法识别
- 放在第一个标题之后：可能破坏文档结构

### 3. 使用 Handlebars 注释包裹 frontmatter

**决策**: 使用 Handlebars 注释 `{{! }}` 包裹 frontmatter，确保模板渲染时不会输出元数据。

**理由**:
- Handlebars 注释在渲染时会被完全忽略
- 确保 frontmatter 只存在于源文件中，不出现在渲染输出中
- 保持渲染输出的纯净性

**替代方案**:
- 不使用注释：frontmatter 会出现在渲染输出中，可能不符合预期
- 使用 HTML 注释：Handlebars 渲染后仍会保留 HTML 注释

### 4. 标准化元数据字段

**决策**: 定义统一的元数据字段结构：

```yaml
---
type: phase-reference
phase: <number>
name: <phase-name>
description: <phase-description>
format: markdown-with-handlebars
---
```

**理由**:
- `type`: 标识文档类型，便于分类和检索
- `phase`: 阶段编号，便于排序和识别
- `name`: 阶段名称，提供人类可读的标识
- `description`: 阶段用途说明，帮助理解文档作用
- `format`: 格式规范，说明文档使用的模板引擎

**替代方案**:
- 使用更多字段（如 `author`、`version`）：增加复杂度，当前需求不需要
- 使用更少字段：信息不足，无法满足"快速识别"的需求

### 5. 手动编辑 vs 脚本批量处理

**决策**: 手动编辑每个文件，逐个添加 frontmatter。

**理由**:
- 只有 8 个文件，数量较少
- 每个文件的 `phase`、`name`、`description` 字段内容不同，需要定制化
- 手动编辑可以确保每个文件的元数据准确
- 避免引入脚本依赖和复杂性

**替代方案**:
- 编写 Node.js 脚本批量处理：对于 8 个文件来说过度工程化
- 使用 sed/awk 命令：不够灵活，容易出错

## Risks / Trade-offs

**风险 1**: YAML 语法错误导致解析失败
- **缓解**: 使用标准 YAML 语法，避免特殊字符；添加后手动验证格式

**风险 2**: Handlebars 注释语法与 frontmatter 冲突
- **缓解**: 测试验证 Handlebars 注释能正确包裹 YAML 内容

**风险 3**: 未来添加新 phase 文件时忘记添加 frontmatter
- **缓解**: 在代码审查 checklist 中添加检查项；考虑后续添加验证脚本

**权衡**: 手动编辑 vs 自动化
- 选择手动编辑是因为文件数量少且内容需要定制化
- 如果未来文件数量增加，可以考虑编写自动化脚本
