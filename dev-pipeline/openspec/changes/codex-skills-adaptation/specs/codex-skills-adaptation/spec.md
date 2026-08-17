## Purpose

适配 Codex 工具的 skills-only 模式，将安装路径从 `.codex/` 重映射到 `.agents/skills/`，并将所有 slash commands 转换为独立的 skill 文件夹，使 Codex 用户获得与 Claude/Cursor 等价的功能体验。

## ADDED Requirements

### Requirement: Codex 安装路径重映射
系统 SHALL 将 Codex 工具的所有安装目标路径从 `.codex/` 前缀改为 `.agents/skills/` 前缀。检测标记（markers）SHALL 使用 `.agents` 而非 `.codex`。

#### Scenario: 项目级安装使用 .agents 路径
- **WHEN** 用户执行 `init` 并选择 `codex` 工具、`project` scope
- **THEN** skills 安装到 `.agents/skills/`，commands 也安装到 `.agents/skills/`
- **AND** 不再创建任何 `.codex/` 目录

#### Scenario: 用户级安装使用 .agents 路径
- **WHEN** 用户执行 `init` 并选择 `codex` 工具、`user` scope
- **THEN** skills 安装到 `~/.agents/skills/`
- **AND** commands 安装到 `~/.agents/skills/`（与 skills 同路径）

#### Scenario: 工具检测识别 .agents 标记
- **WHEN** 目标目录存在 `.agents/` 文件夹
- **THEN** 系统建议的工具为 `codex`

### Requirement: Commands 转换为独立 Skills
系统 SHALL 将每个 command 资产在 Codex 下转换为独立的 skill 文件夹，路径为 `.agents/skills/<skill-name>/SKILL.md`。

#### Scenario: opsx-propose command 转换为 skill
- **WHEN** Codex 安装包含 `commands` feature
- **THEN** `.agents/skills/opsx-propose/SKILL.md` 存在
- **AND** 文件内容包含原 command 的 prompt 正文
- **AND** frontmatter 使用 skill 格式（无 `allowed-tools`、`category`、`tags` 字段）

#### Scenario: 所有 9 个 commands 均被转换
- **WHEN** Codex 安装完成
- **THEN** `.agents/skills/` 下存在以下 skill 文件夹：`opsx-propose`, `opsx-apply`, `opsx-archive`, `opsx-verify`, `opsx-sync`, `opsx-explore`, `opsx-grill-me`, `opsx-grilling`, `opsx-dev-spec-design`

### Requirement: Command 模板 Frontmatter 适配
系统 SHALL 在渲染 command 模板时根据 `toolId` 生成不同格式的 frontmatter。当 `toolId` 为 `codex` 时，frontmatter 仅包含 `name` 和 `description`；其他工具保持原有 frontmatter 不变。

#### Scenario: Codex 生成的 SKILL.md frontmatter
- **WHEN** `toolId` 为 `codex`
- **THEN** frontmatter 包含 `name: opsx-propose` 和 `description: ...`
- **AND** frontmatter 不包含 `allowed-tools`、`category`、`tags` 字段

#### Scenario: Claude/Cursor 生成的 command frontmatter 不变
- **WHEN** `toolId` 为 `claude` 或 `cursor`
- **THEN** frontmatter 保持原有格式（包含 `name`, `description`, `allowed-tools`, `category`, `tags`）

### Requirement: toolDestinations 覆盖机制
`AssetDefinition` SHALL 支持可选的 `toolDestinations` 字段，类型为 `Partial<Record<ToolId, string>>`。`buildInstallPlan` 在解析目标路径时 SHALL 优先使用 `toolDestinations[toolId]`，未定义时回退到 `destination`。

#### Scenario: Codex command 使用覆盖路径
- **WHEN** 资产定义了 `toolDestinations.codex = "{{commandsDir}}/opsx-propose/SKILL.md"`
- **AND** `toolId` 为 `codex`
- **THEN** 目标路径为 `.agents/skills/opsx-propose/SKILL.md`

#### Scenario: Claude command 使用默认路径
- **WHEN** 资产定义了 `toolDestinations.codex` 但未定义 `toolDestinations.claude`
- **AND** `toolId` 为 `claude`
- **THEN** 目标路径为 `destination` 字段的值（如 `.claude/commands/opsx/propose.md`）

### Requirement: 删除 Codex 专属的 docs 和 command-guide 资产
系统 SHALL 不再安装 `codex-docs` 和 `codex-command-guide` 资产。

#### Scenario: Codex 安装不产生 docs 文件
- **WHEN** Codex 安装完成
- **THEN** 不存在 `.agents/skills/opsx-dev-pipeline-guide/SKILL.md` 或任何等效的 docs-only 文件
- **AND** 不存在 `.agents/commands/README.md` 或任何等效的 command-guide 文件

### Requirement: Claude 和 Cursor 行为不变
系统 SHALL 保持 Claude 和 Cursor 的安装路径、文件结构、frontmatter 格式完全不变。

#### Scenario: Claude 安装路径不变
- **WHEN** `toolId` 为 `claude`
- **THEN** skills 安装到 `.claude/skills/`，commands 安装到 `.claude/commands/`

#### Scenario: Cursor 安装路径不变
- **WHEN** `toolId` 为 `cursor`
- **THEN** skills 安装到 `.cursor/rules/`，commands 安装到 `.cursor/commands/`
