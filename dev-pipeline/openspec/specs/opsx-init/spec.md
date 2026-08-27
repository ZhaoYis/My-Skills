## Purpose

提供 `/opsx:init` 命令及对应的 `opsx-init` skill，一键根据当前项目情况（技术栈、语言、工具链等）自动生成或更新 `openspec/config.yaml` 文件。

## Requirements

### Requirement: `/opsx:init` 命令可用
系统 SHALL 提供 `/opsx:init` 命令（或等价调用形式），用户在 AI 工具中调用该命令后，系统应委托给 `opsx-init` skill 执行。

#### Scenario: 用户调用 opsx:init 命令
- **WHEN** 用户在 AI 工具中输入 `/opsx:init`
- **THEN** 系统加载并执行 `opsx-init` skill 的完整流程
- **AND** 默认不指定任何参数，skill 自动分析当前项目

#### Scenario: 用户调用 opsx-init skill
- **WHEN** 用户直接调用 `opsx-init` skill
- **THEN** skill 启动并分析当前项目上下文，生成 config.yaml

### Requirement: opsx-init skill 分析项目上下文
`opsx-init` skill SHALL 自动检测当前项目的技术栈、编程语言、构建工具、测试框架等关键信息，并据此生成 `config.yaml` 内容。

#### Scenario: 检测 TypeScript 项目
- **WHEN** 项目根目录存在 `tsconfig.json` 或 `package.json` 中包含 TypeScript 依赖
- **THEN** skill 在 context 中记录 TypeScript 相关信息
- **AND** 生成包含 TypeScript 约定的 rules

#### Scenario: 检测 Python 项目
- **WHEN** 项目根目录存在 `pyproject.toml` 或 `requirements.txt`
- **THEN** skill 在 context 中记录 Python 相关信息
- **AND** 生成包含 Python 约定的 rules（PEP 8、pytest、mypy 等）

#### Scenario: 检测 Java 项目
- **WHEN** 项目根目录存在 `pom.xml` 或 `build.gradle`
- **THEN** skill 在 context 中记录 Java 相关信息
- **AND** 生成包含 Java 约定的 rules

#### Scenario: 检测 AI 工具
- **WHEN** 项目存在 `.claude/`、`.cursor/`、`.agents/` 等目录
- **THEN** skill 记录检测到的 AI 工具
- **AND** 在 config.yaml 中记录支持的 AI 工具列表

### Requirement: config.yaml 格式符合规范
生成的 `config.yaml` SHALL 遵循 `openspec/config.yaml` 的标准格式，包含 `schema`、`context`、`rules` 和 `operations` 四个顶层字段。

#### Scenario: 生成的 config.yaml 包含 schema 字段
- **WHEN** skill 生成 config.yaml
- **THEN** 文件顶部包含 `schema: spec-driven`（或检测到的 schema 类型）

#### Scenario: 生成的 config.yaml 包含 context 字段
- **WHEN** skill 生成 config.yaml
- **THEN** `context` 字段包含项目技术栈、类型、领域、约定、关键组件等信息

#### Scenario: 生成的 config.yaml 包含 rules 字段
- **WHEN** skill 生成 config.yaml
- **THEN** `rules` 字段包含 `proposal`、`design`、`tasks`、`specs` 四个子字段，每个包含相应的规则列表

#### Scenario: 生成的 config.yaml 包含 operations 字段
- **WHEN** skill 生成 config.yaml
- **THEN** `operations` 字段包含 `apply` 和 `archive` 的 `guidance` 子字段

### Requirement: 已有 config.yaml 时更新而非覆盖
当 `openspec/config.yaml` 已存在时，skill SHALL 分析现有内容并智能合并，而非全部覆盖。

#### Scenario: config.yaml 已存在且用户确认更新
- **WHEN** `openspec/config.yaml` 已存在
- **THEN** skill 检测现有内容，展示差异建议
- **AND** 使用 `{{askTool}}` 询问用户是否更新
- **AND** 用户确认后合并更新

#### Scenario: config.yaml 不存在
- **WHEN** `openspec/config.yaml` 不存在
- **THEN** skill 直接创建新文件，无需确认

### Requirement: skill 作为独立资产打包
`opsx-init` skill SHALL 作为独立的 skill bundle 资产注册到 manifest 中，与其他 skill 并列。

#### Scenario: 安装 opsx-init skill
- **WHEN** 用户执行 `opsx dev-pipeline init` 或 `opsx dev-pipeline sync`
- **THEN** `opsx-init` skill 安装到 `{{skillsDir}}/opsx-init/`
- **AND** `opsx:init` 命令安装到 `{{commandsDir}}/opsx/init.md`

#### Scenario: 命令委托给 skill
- **WHEN** 用户调用 `/opsx:init` 命令
- **THEN** 命令载入 `{{skillsDir}}/opsx-init/SKILL.md` 并执行其完整流程