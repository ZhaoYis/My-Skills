## Context

当前项目已有 `opsx-dev-pipeline`、`opsx-dev-spec-design`、`opsx-grilling`、`opsx-grill-me` 等 skill，以及 `dev-pipeline`、`propose`、`apply`、`archive`、`sync`、`verify`、`explore`、`grill-me`、`grilling`、`dev-spec-design` 等命令。每个命令都遵循相同的模式：一个轻量级的 command 模板文件（`.md.hbs`）作为入口，委托给对应的 skill。

`config.yaml` 的格式已由 `openspec/config.yaml` 确定为：`schema`、`context`、`rules`（proposal/design/tasks/specs）、`operations`（apply/archive guidance）。

## Goals / Non-Goals

**Goals:**
- 新增 `opsx:init` 命令和 `opsx-init` skill，遵循现有 command+skill 模式
- skill 自动分析项目并生成符合规范的 `config.yaml`
- 在 manifest 中注册为 `opsx-init-command` 和 `opsx-init-skill-bundle` 资产

**Non-Goals:**
- 不修改 CLI 源码（`src/cli/`、`src/core/`）
- 不修改现有 `config.yaml` 的格式规范
- 不集成到 `opsx dev-pipeline init` 流程中（那属于 CLI 初始化，本次只做 AI 命令层面的 init）

## Decisions

### 1. 遵循现有 command+skill 委托模式
**决策**: Command 模板只做入口，委托给 skill 执行完整逻辑。与 `opsx-dev-pipeline`、`opsx-sync` 等一致。

**理由**: 代码复用和一致性。command 文件保持简洁（约 50 行），skill 文件包含完整的工作流和 guardrails。

### 2. skill 自动分析项目，不依赖 CLI
**决策**: skill 通过读取文件系统（`package.json`、`tsconfig.json`、`pyproject.toml` 等）来检测项目信息，不依赖 `opsx dev-pipeline` CLI。

**理由**: 用户可能没有安装 CLI 或 manifest 不完整。skill 应该独立工作。

### 3. config.yaml 生成策略
**决策**: skill 以系统已有的 `openspec/config.yaml` 为模板，只填充检测到的项目信息（context、rules 语言适配、operations 命令路径），不改变其结构和格式。若 config.yaml 不存在，以 dev-pipeline 自带的 config.yaml 作为参考模板。

**理由**: 保留用户已有的配置结构和自定义规则，避免硬编码格式导致风格不一致。用户可能已经手动调整过 config.yaml，skill 应尊重已有结构。

### 4. 资产注册方式
**决策**: 在 manifest 中注册两种资产：
- `opsx-init-command`: 单个 template 资产，指向 `commands/opsx/init.md.hbs`
- `opsx-init-skill-bundle`: bundle 资产，指向 `skills/opsx-init/`

**理由**: 与现有所有 command+skill 组合的注册方式一致。

## Risks / Trade-offs

- [Risk] 项目检测可能不准确（如同时存在多种语言） → skill 按优先级检测并列出所有发现，使用 `{{askTool}}` 确认
- [Risk] config.yaml 格式未来可能变化 → skill 读取现有 config.yaml 作为格式参考，而非硬编码格式

## Migration Plan

无需迁移。通过 `opsx sync` 或重新 `init` 即可获取新命令和 skill。

## Open Questions

<!-- None -->