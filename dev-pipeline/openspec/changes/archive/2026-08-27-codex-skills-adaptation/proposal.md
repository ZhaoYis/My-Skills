## Why

Codex 只支持 skills 模式，不支持 slash commands。当前安装架构将 skills 放在 `.codex/prompts/`，commands 放在 `.codex/commands/`，这与 Codex 的实际能力不匹配。需要将 Codex 的安装路径改为 `.agents/skills/`，并将所有 commands 转换为独立的 skills，保持功能不变。

## What Changes

- **BREAKING**: 修改 Codex 工具的安装目录结构
  - `destinations.root`: `.codex` → `.agents`
  - `destinations.skills`: `.codex/prompts` → `.agents/skills`
  - `destinations.commands`: `.codex/commands` → `.agents/skills`（与 skills 同路径）
  - `markers`: `.codex` → `.agents`
- **新增**: `AssetDefinition` 接口增加 `toolDestinations` 字段，支持按工具覆盖目标路径
- **修改**: `buildInstallPlan` 在解析 destination 时优先查 `toolDestinations[toolId]`
- **修改**: 所有 command 模板增加 Handlebars 条件，为 Codex 生成 skill 格式的 frontmatter
- **删除**: `codex-docs` 资产（`.codex/prompts/opsx-dev-pipeline.md`）
- **删除**: `codex-command-guide` 资产（`.codex/commands/README.md`）
- **转换**: 9 个 command 资产在 Codex 下转换为独立的 skill 文件夹
  - `opsx-propose`, `opsx-apply`, `opsx-archive`, `opsx-verify`, `opsx-sync`, `opsx-explore`, `opsx-grill-me`, `opsx-grilling`, `opsx-dev-spec-design`

## Capabilities

### New Capabilities
- `codex-skills-adaptation`: Codex 工具的 skills 模式适配，包括路径重映射、command 到 skill 的转换、frontmatter 格式适配

### Modified Capabilities
（无现有 capability 的需求变更）

## Impact

**受影响的代码**:
- `src/config/tools.json`: Codex 工具配置
- `src/core/assets/types.ts`: `AssetDefinition` 接口
- `src/core/assets/manifest.ts`: 所有 command 资产的 `toolDestinations` 配置，删除 `codex-docs` 和 `codex-command-guide`
- `src/core/init/buildInstallPlan.ts`: destination 解析逻辑
- `src/templates/common/commands/*.hbs`: 所有 command 模板的 frontmatter 条件

**受影响的测试**:
- `test/unit/build-install-plan.test.ts`: 更新 Codex 路径断言
- `test/unit/scope-selection.test.ts`: Codex 现在支持用户级 commands
- `test/integration/init-matrix.test.ts`: 更新 Codex 安装路径

**向后兼容性**:
- **BREAKING**: 已安装到 `.codex/` 的项目不会自动迁移，需要用户手动移动或删除旧目录
- 新安装直接使用 `.agents/skills/` 路径
- Claude 和 Cursor 的安装行为完全不变

**已知遗留**:
- `openspec-propose` 等 skill 引用不在 bundle 中（Claude/Cursor 也存在此问题），本次不处理，记录为 TODO
