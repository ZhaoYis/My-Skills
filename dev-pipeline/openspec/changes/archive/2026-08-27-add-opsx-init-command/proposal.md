## Why

当前 `openspec/config.yaml` 文件的初始化依赖 `opsx dev-pipeline init` 命令，该命令会同时安装大量模板文件（skills、commands、schemas 等）。但用户经常只需要快速初始化或更新 `config.yaml` 来描述项目上下文和规则，不需要完整的模板安装。提供一个独立的 `/opsx:init` 命令和对应的 `opsx-init` skill，让用户一键根据当前项目情况生成或更新 `config.yaml`，降低使用门槛。

## What Changes

- 新增 `src/templates/common/commands/opsx/init.md.hbs` — `/opsx:init` 命令模板，直接委托给 `opsx-init` skill
- 新增 `src/templates/common/skills/opsx-init/SKILL.md.hbs` — `opsx-init` skill，分析当前项目并生成 `config.yaml`
- 在 `src/core/assets/manifest.ts` 中注册 `opsx-init-command` 和 `opsx-init-skill-bundle` 资产
- 在 `src/core/init/buildInstallPlan.ts` 的 `buildTemplateContext` 中添加 `init` 命令调用

## Capabilities

### New Capabilities
- `opsx-init`: 提供 `/opsx:init` 命令和 `opsx-init` skill，支持一键根据当前项目情况初始化 `openspec/config.yaml` 文件

### Modified Capabilities
<!-- No existing specs to modify -->

## Impact

- 新增文件: `src/templates/common/commands/opsx/init.md.hbs`、`src/templates/common/skills/opsx-init/SKILL.md.hbs`
- 修改文件: `src/core/assets/manifest.ts`（新增 2 个资产定义）、`src/core/init/buildInstallPlan.ts`（添加 init 命令调用映射）
- 不影响 CLI 接口、现有命令、其他 skill
- 无破坏性变更