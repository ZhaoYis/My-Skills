# [CLAUDE.md](http://CLAUDE.md)

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目说明

`opsx-dev-pipeline` —— 一个基于 Node 20+ ESM 的 CLI，用于在消费方仓库中引导一套 Phase 0–7 的 OpenSpec AI 开发流水线。通过 tool adapter 支持 Claude Code / Cursor / Codex / OpenCode。

本仓库用于开发 CLI 自身；**不要**在本目录中运行 `opsx-dev-pipeline init`。

## 快速开始

```bash
npm install
```

**目录地图：**

- `src/` —— CLI 实现（bin / commands / config / templates）
- `src/templates/` —— Handlebars 模板，由 `init` / `sync` / `upgrade` 渲染到消费方仓库
- `test/` —— Vitest 测试（含 `test/unit/hooks/` 子集）
- `openspec/` —— 本仓库自身的 OpenSpec 变更草案
- `docs/adr/` —— 架构决策记录（必读）
- `CONTEXT.md` —— 领域词汇表（必读）
- `.claude/skills/openspec-*` —— OpenSpec 工作流的 agent 技能



## 领域词汇（强制）

编写代码、提案、测试或 commit 前，请先阅读 `@CONTEXT.md`。该文件定义了本仓库使用的规范术语（Pipeline / Phase / Route / Stack / Tool / Asset / Manifest / Bundle / Scope / Preflight / Doctor / Sync vs Upgrade）。请使用这些术语的原文，禁止替换同义词或译名漂移。描述性文字使用中文；与代码同名的核心概念保留英文原名。

在某区域开展工作前，请先阅读 `@docs/adr/` 中相关的条目。ADR 记录架构决策；若输出与之冲突，请明确指出冲突，而不是默默覆盖。

`.claude/skills/` 中的 agent skill 必须按 `@docs/agents/domain.md` 的协议消费 `CONTEXT.md` + `docs/adr/`。

## 工作流约定

- 通过 OpenSpec 进行变更驱动开发：`propose` → `apply` → `archive`。技能位于 `.claude/skills/openspec-*`。
- 流水线为 Phase 0–7，配 Route 选择（`trivial` / `standard` / `full`）。Route 只能升级，不可降级。详见 `@CONTEXT.md`。
- Manifest 存放在 `package.json#opsxDevPipeline` —— 没有独立的 manifest 文件。
- Init 冲突策略：`--yes` 跳过冲突文件，`--force` 覆盖，默认交互式提示。
- `init` / `sync` / `upgrade` 受版本门禁控制：若 `manifest.templateVersion > cli.version`，命令拒绝执行（在 `--yes` 下则会提示确认）。
- 用户可见变更需同步记录到 `CHANGELOG.md`（遵循 Keep a Changelog 格式，版本号由 `npm version` 驱动）。
- 每次改动必须配套或更新相应的单元测试；提交前 `npm test` 全绿。



## 命令

- 构建：`npm run build`
- 开发运行：`npm run dev`
- 本地迭代：`npm run dev -- <args>` 将参数转发至底层 CLI，例如 `npm run dev -- init --tool claude --stack backend --yes --dry-run`
- 类型检查：`npm run typecheck`
- 测试：`npm test`（Vitest，覆盖 `test/`）；`npm run test:hooks` 仅运行 hooks 子集；`npm run test:watch` 监听模式
- 格式化 / 检查：`npm run format` · `npm run format:check` · `npm run lint` · `npm run lint:fix`
- 初始化冒烟测试：`npm run init:smoke`（针对 `claude` / `backend` 的干运行 init）
- 发布前：`npm run prepublishOnly`（执行构建）；`npm run pack:check` 执行干运行打包检查
- CLI 输出语言：`--lang zh`（默认）/`--lang en`，影响本地迭代时的提示、错误与生成文档语言



## 风格

Biome（`biome.json`）：2 空格缩进，100 列行宽，单引号，尾随逗号，始终使用分号。import 自动整理已开启。