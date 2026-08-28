# CONTEXT — opsx-dev-pipeline

`opsx-dev-pipeline` 的领域词汇表 —— 本仓库代码、文档、ADR 和 agent skill 中
使用的规范术语。在本仓库编写代码、文档、提案或 commit 时，请严格按照本文件
的定义使用这些术语。

> 策略：Pipeline / Phase / Route / Stack / Tool / Asset / Manifest / Bundle
> 等与代码同名的核心概念**保留英文原名**，避免中英混用导致歧义；描述性
> 文字使用中文。

---

## 核心概念

### Pipeline（流水线）

本 CLI 为消费方仓库搭建的端到端 AI 辅助开发工作流。运行
`opsx-dev-pipeline init` 之后，消费方仓库会获得：

- 一套**变更驱动**的 OpenSpec 工作流（`propose` → `apply` → `archive`）。
- 在 OpenSpec 之上叠加的**阶段门禁**状态机（Phase 0–7），强制走代码审查、
  单元测试、提交推送、可选的合并交付。
- 一个根据变更风险自动选择 `trivial` / `standard` / `full` 的 **Route**
  选择器，自动跳过不适用的阶段。

### Phase（阶段 0–7）

流水线依次执行的离散步骤。每个阶段都有一个**决策点**，可以分支到修复
回路、跳过标记或下一阶段。

| 阶段 | 名称        | 用途                                            |
| ---- | ----------- | ----------------------------------------------- |
| 0    | 入口        | 预检、仓库识别、Route 选择                      |
| 1    | 提案 Propose | 生成 proposal / design / specs / tasks 制品     |
| 2    | 应用 Apply   | 按 tasks 实施实现，同步完成状态                 |
| 3    | 审查 Review  | 代码审查（可跳过）                              |
| 4    | 单测门禁     | 运行并门禁控制单元测试                          |
| 5    | 归档 Archive | 同步 delta specs 并归档变更                     |
| 6    | 提交与推送   | 源分支 commit 与 push                           |
| 7    | 合并与交付   | 目标分支 merge（仅 merge 模式）                 |

### Route（路由）

按变更风险分级、决定执行哪些阶段集合的预设，共三档：

- **trivial**（琐碎）—— 阶段 {0, 2, 6}。用于错别字、格式化、注释。
- **standard**（标准）—— 阶段 {0, 1, 2, 5, 6}。用于新功能、Bug 修复、重构。
- **full**（完整）—— 阶段 {0, 1, 2, 3, 4, 5, 6, 7}。用于核心业务逻辑、
  数据库 schema 变更、安全相关。

Route 记录在流水线状态文件中，且**只能向上升级**
（`trivial → standard → full`），不允许降级。

### Stack（技术栈大类）

消费方在 `init` 时选择的项目大类，三选一：

- `frontend` —— React + TypeScript + Vite，OpenSpec `frontend` schema
- `backend` —— Java + Spring Boot 3.x，OpenSpec `backend` schema
- `fullstack` —— 前端 + 后端的 monorepo 组合

所选 Stack 决定了要安装的 **OpenSpec schema**、**默认 tech stack**
（通过 `--tech-stack`）和**规则集**。

### Tool（AI 工具）

消费方仓库面向的 AI 宿主，决定生成的 skill / command / hook / rule
写到哪个目录。

| Tool ID    | 宿主        | Skill 根目录                          |
| ---------- | ----------- | ------------------------------------- |
| `claude`   | Claude Code | `.claude/skills/opsx-dev-pipeline`    |
| `cursor`   | Cursor      | `.cursor/rules/opsx-dev-pipeline`     |
| `codex`    | Codex       | `.agents/skills/opsx-dev-pipeline`    |
| `opencode` | OpenCode    | `.opencode/skills/opsx-dev-pipeline`  |

### Feature（可选功能）

通过 `--feature` 开关的启用/禁用能力。目前此类选项有 `hooks` 与
`no-hooks` —— **两者互斥**。Feature 会被纳入**托管 manifest**，在
`sync` / `upgrade` 时再次应用。

### Tech stack（技术栈细分）

Stack 内部的技术细分（例如 `java-spring-boot`、`react-vite`、
`java-react`、`python-fastapi`、`python-react`）。用于驱动 AI 生成内容
的 prompt、schema 默认值与规则措辞。通过 `--tech-stack` 选择并持久化
到 manifest。

---

## Asset 与 Manifest 模型

### Manifest（清单）

消费方仓库初始化后的持久化状态。存放在消费方 `package.json` 的
`opsxDevPipeline` 字段下，记录：

- `schemaVersion` —— 格式版本号，用于向前兼容读取
- `projectName` —— 消费方项目名
- `tool` —— init 时选择的 AI 工具
- `features` —— 已启用的 feature 列表
- `templateVersion` —— 生成该 manifest 时的 CLI 版本
- `packageName` —— 拥有这些 asset 的 CLI 包名
- `managedAssets[]` —— 本 CLI 在消费方仓库中托管的每一个文件

### Asset（托管资产）

CLI 渲染、持有并在 `sync` / `upgrade` 时重新渲染的单个文件。每个 asset
都有：

- `id` —— 模板标识符（如 `opsx-dev-pipeline-skill-bundle:SKILL.md.hbs`）
- `destination` —— 在消费方仓库中的相对路径（如
  `.claude/skills/opsx-dev-pipeline/SKILL.md`）

### Bundle（资产包）

一组相关 asset 的命名集合。代码中的同义说法：`assetBundle`、
`skillBundle`、`commandBundle`。Bundle 概念很重要：**只要 bundle 内任一
成员已被托管，`sync` 就会重新渲染该 bundle 的全部成员**。

### Scope（作用范围）

Asset 落地的位置：`project`（消费方仓库内）或 `user`（宿主全局配置目录，
例如 `~/.claude/`）。由每个 Tool 的 adapter 决定是否支持以及 home
目录下的相对路径。

---

## 行为原语

### Preflight（预检）

每次 CLI 调用**先于**任何副作用动作之前执行。校验 OpenSpec CLI 是否存在
以及版本是否符合要求。失败时直接以非零状态码退出并给出可读错误信息，
不会写入任何部分状态。

### Doctor

只读命令，比对 manifest 中的 `templateVersion` 与当前 CLI 版本，输出
升级建议与已检测到的 drift，但**不写任何文件**。

### Sync 与 Upgrade 的区别

- **sync** —— 只重新渲染 `managedAssets` 里**已有**的文件。
- **upgrade** —— 在 sync 基础上**额外**采纳 CLI 包内尚未在 manifest 中
  跟踪的新模板。

两者都受版本门禁控制：若 `manifest.templateVersion > cli.version`，
命令会提示确认（或在 `--yes` 与版本不匹配时拒绝执行）。

### Uninstall（卸载）

删除每一个 `managedAssets` 的目标文件以及 manifest 段。同时清理空的
父目录。

---

## 约定

- **版本号**：本包遵循 SemVer。Manifest 中的 `templateVersion` 字段即为
  `init` 写入时的 `package.json` 版本号。
- **Manifest 位置**：`package.json#opsxDevPipeline`。**没有**独立的
  manifest 文件 —— 消费方自己的 `package.json` 是唯一事实源。
- **冲突策略**：`--yes` 跳过冲突文件；`--force` 覆盖冲突文件；默认
  为交互式提示。
- **Hooks**：以纯 Node.js 脚本形式分发到
  `src/templates/common/scripts/hooks/`，无外部运行时依赖，要求
  Node 20+。
- **语言**：文档默认 `zh`（`--lang zh`）；`en` 是另一种支持的 locale，
  用于模板、prompt 和面向用户的字符串。
