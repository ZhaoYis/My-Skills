## Why

当前后端（backend）和全栈（fullstack）技术栈模式下的 OpenSpec schema 模板中缺少架构决策记录（ADR）模版。ADR 是记录重要架构决策的轻量级文档，帮助团队理解系统设计的历史背景和权衡。引入 ADR 模版可以让用户在初始化项目时选择是否生成 ADR 文档支持，提升项目的架构文档化能力。

## What Changes

- 在 `src/templates/common/schemas/backend/templates/` 和 `src/templates/common/schemas/fullstack/templates/` 目录下新增 `adr.md` 模版文件
- 在 `src/templates/common/schemas/backend/schema.yaml.hbs` 和 `src/templates/common/schemas/fullstack/schema.yaml.hbs` 中添加 `adr` artifact 定义，作为可选（conditional）artifact，让用户在生成时选择是否包含
- 后端的前端（frontend）栈不需要 ADR，保持不变

## Capabilities

### New Capabilities
- `adr-template`: 在 backend 和 fullstack schema 中新增可选的 ADR artifact 模板，支持用户选择是否生成架构决策记录文档

### Modified Capabilities
<!-- No existing specs to modify -->

## Impact

- 新增文件: `src/templates/common/schemas/backend/templates/adr.md.hbs`、`src/templates/common/schemas/fullstack/templates/adr.md.hbs`
- 修改文件: `src/templates/common/schemas/backend/schema.yaml.hbs`、`src/templates/common/schemas/fullstack/schema.yaml.hbs`
- 不影响 CLI 接口、现有安装流程、其他栈类型（frontend）
- 无破坏性变更