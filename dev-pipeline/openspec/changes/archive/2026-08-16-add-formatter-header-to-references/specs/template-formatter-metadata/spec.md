## Purpose

为 `opsx-dev-pipeline` skill 的 references 目录下的 8 个 phase 模板文件添加标准化的 YAML frontmatter 元数据，使 AI 工具和用户能够快速识别每个阶段文档的类型、用途、输入输出和工具需求。

## ADDED Requirements

### Requirement: Phase 模板必须包含标准化 YAML frontmatter

每个 phase 模板文件（phase-0 到 phase-7）必须在文件头部包含符合 YAML 1.2 规范的 frontmatter 块，使用 `---` 分隔符包裹。

#### Scenario: Phase 0 入口判断模板包含标准元数据

- **WHEN** 查看 `phase-0-entrance.md.hbs` 文件
- **THEN** 文件头部包含 YAML frontmatter，其中 `name` 为 "phase-0-entrance"，`phase` 为 0，`description` 描述环境预检和入口类型判断

#### Scenario: Phase 1 提案编写模板包含标准元数据

- **WHEN** 查看 `phase-1-propose.md.hbs` 文件
- **THEN** 文件头部包含 YAML frontmatter，其中 `name` 为 "phase-1-propose"，`phase` 为 1，`description` 描述需求理解确认、创建 change 和生成提案制品

#### Scenario: Phase 2 提案应用模板包含标准元数据

- **WHEN** 查看 `phase-2-apply.md.hbs` 文件
- **THEN** 文件头部包含 YAML frontmatter，其中 `name` 为 "phase-2-apply"，`phase` 为 2，`description` 描述获取实施指令和逐任务实施

#### Scenario: Phase 3 代码审查模板包含标准元数据

- **WHEN** 查看 `phase-3-review.md.hbs` 文件
- **THEN** 文件头部包含 YAML frontmatter，其中 `name` 为 "phase-3-review"，`phase` 为 3，`description` 描述代码审查流程

#### Scenario: Phase 4 单元测试模板包含标准元数据

- **WHEN** 查看 `phase-4-unit-tests.md.hbs` 文件
- **THEN** 文件头部包含 YAML frontmatter，其中 `name` 为 "phase-4-unit-tests"，`phase` 为 4，`description` 描述运行单元测试和验证

#### Scenario: Phase 5 归档模板包含标准元数据

- **WHEN** 查看 `phase-5-archive.md.hbs` 文件
- **THEN** 文件头部包含 YAML frontmatter，其中 `name` 为 "phase-5-archive"，`phase` 为 5，`description` 描述归档变更和生成最终报告

#### Scenario: Phase 6 提交推送模板包含标准元数据

- **WHEN** 查看 `phase-6-commit-push.md.hbs` 文件
- **THEN** 文件头部包含 YAML frontmatter，其中 `name` 为 "phase-6-commit-push"，`phase` 为 6，`description` 描述提交代码和推送到远程仓库

#### Scenario: Phase 7 合并交付模板包含标准元数据

- **WHEN** 查看 `phase-7-merge-deliver.md.hbs` 文件
- **THEN** 文件头部包含 YAML frontmatter，其中 `name` 为 "phase-7-merge-deliver"，`phase` 为 7，`description` 描述合并 PR 和完成交付

### Requirement: Frontmatter 必须包含必需字段

每个 frontmatter 块必须包含以下字段：`name`、`description`、`phase`、`step_range`、`input`、`output`、`tools`。

#### Scenario: Frontmatter 包含所有必需字段

- **WHEN** 解析任意 phase 模板的 YAML frontmatter
- **THEN** frontmatter 包含 `name`（字符串）、`description`（字符串）、`phase`（数字）、`step_range`（字符串）、`input`（数组）、`output`（数组）、`tools`（数组）字段

#### Scenario: Input 和 output 字段描述数据流

- **WHEN** 查看 frontmatter 的 `input` 和 `output` 字段
- **THEN** `input` 数组列出该阶段所需的输入数据，`output` 数组列出该阶段产生的输出数据

#### Scenario: Tools 字段列出所需工具

- **WHEN** 查看 frontmatter 的 `tools` 字段
- **THEN** 数组列出该阶段执行所需的工具或命令

### Requirement: Frontmatter 不影响模板渲染

YAML frontmatter 的添加不得影响现有 Handlebars 模板的渲染逻辑和输出内容。

#### Scenario: 模板渲染输出保持不变

- **WHEN** 使用相同的输入数据渲染添加了 frontmatter 的模板
- **THEN** 渲染输出与添加 frontmatter 之前完全一致，frontmatter 内容不会出现在最终输出中

#### Scenario: Handlebars 表达式正常工作

- **WHEN** 模板中包含 `{{variable}}`、`{{#if}}`、`{{#each}}` 等 Handlebars 表达式
- **THEN** 所有表达式在渲染时正常解析和执行，不受 frontmatter 影响

### Requirement: Frontmatter 格式符合 YAML 规范

Frontmatter 必须使用标准的 YAML 语法，确保可被主流 YAML 解析器正确解析。

#### Scenario: Frontmatter 可被 YAML 解析器解析

- **WHEN** 使用标准 YAML 解析器（如 js-yaml、PyYAML）解析 frontmatter 内容
- **THEN** 解析成功，返回包含所有字段的对象，无语法错误

#### Scenario: 多行字符串使用 YAML 块标量语法

- **WHEN** frontmatter 中的 `description` 字段包含多行文本
- **THEN** 使用 YAML 块标量语法（`|` 或 `>`）表示，保持可读性
