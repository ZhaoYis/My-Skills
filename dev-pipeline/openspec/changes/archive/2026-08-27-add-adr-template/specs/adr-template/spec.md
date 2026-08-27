## Purpose

在 backend 和 fullstack 技术栈模式下，提供可选的架构决策记录（ADR）文档模板，让用户在生成 OpenSpec 项目工件时可以选择是否包含 ADR 支持。

## ADDED Requirements

### Requirement: ADR 模板在 backend 和 fullstack 栈中可用
系统 SHALL 在 backend 和 fullstack 技术栈的 schema 模板目录中提供 `adr.md` 模板文件，作为可选 artifact。frontend 栈不包含此模板。

#### Scenario: 用户在 backend 栈中启用 ADR 模板
- **WHEN** 用户在 backend 栈模式下选择生成 ADR 文档
- **THEN** 系统在 `openspec/templates/adr.md` 输出 ADR 模板文件

#### Scenario: 用户在 fullstack 栈中启用 ADR 模板
- **WHEN** 用户在 fullstack 栈模式下选择生成 ADR 文档
- **THEN** 系统在 `openspec/templates/adr.md` 输出 ADR 模板文件

#### Scenario: frontend 栈不包含 ADR 模板
- **WHEN** 用户选择 frontend 栈
- **THEN** 系统不提供 ADR 模板选项，也不输出 `adr.md` 文件

### Requirement: ADR artifact 是可选（conditional）artifact
ADR artifact SHALL 在 schema 中定义为 conditional artifact，用户在生成工件时需确认是否包含。默认不生成。

#### Scenario: 用户选择不生成 ADR
- **WHEN** 用户在生成工件时对 ADR 选择"否"
- **THEN** 系统跳过 ADR 模板的输出，不创建 `adr.md` 文件

#### Scenario: 用户选择生成 ADR
- **WHEN** 用户在生成工件时对 ADR 选择"是"
- **THEN** 系统在指定位置输出 ADR 模板文件

### Requirement: ADR 模板结构符合行业标准
ADR 模板 SHALL 包含以下标准章节：标题、状态、上下文、决策、替代方案、后果。模板内容应简洁清晰，引导用户记录架构决策。

#### Scenario: ADR 模板包含标准章节
- **WHEN** 系统输出 ADR 模板文件
- **THEN** 模板文件包含 Title、Status、Context、Decision、Alternatives Considered、Consequences 等标准章节

#### Scenario: ADR 模板引导用户填写
- **WHEN** 用户查看生成的 ADR 模板
- **THEN** 每个章节包含注释或引导文字，帮助用户理解应填写的内容