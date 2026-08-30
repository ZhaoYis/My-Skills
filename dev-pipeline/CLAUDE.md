# [CLAUDE.md](http://CLAUDE.md)

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目说明

`opsx-dev-pipeline` —— 一个基于 Node 20+ ESM 的 CLI，用于在消费方仓库中引导一套 Phase 0–7 的 OpenSpec AI 开发流水线。通过 tool adapter 支持 Claude Code / Cursor / Codex / OpenCode。

本仓库用于开发 CLI 自身；**不要**在本目录中运行 `opsx-dev-pipeline init`。

## 跨平台支持（强制）

CLI 与附属脚本必须在 **macOS / Linux / Windows** 三端都能正常运行，CI 矩阵 `ubuntu-latest / macos-latest / windows-latest` × `Node 20 / 22 / 24` 必须全绿。任何破坏跨平台兼容性的改动都属于回归。

**编写代码时必须遵守的规则：**

- 路径处理一律使用 `node:path` 的 `join` / `resolve` / `relative`，禁止字符串拼接或硬编码 `/` `\`。从 `import.meta.url` 派生路径必须用 `fileURLToPath`（不要用 `.pathname`，Windows 上会得到 `/D:/...` 导致双盘符）。
- 子进程调用统一走 `node:child_process` 的 `execFile` / `spawn`，**不要**用 `exec` / shell 字符串拼接。`.cmd` / `.bat` shim 必须显式 `exit /b %ERRORLEVEL%` 转译子进程退出码，且对含空格或元字符的路径用双引号转义。
- `PATH` 查找时遵循：`process.platform === 'win32'` 走 PATHEXT（`.cmd` / `.bat` / `.exe`），跳过无扩展名的裸文件（Windows 无法直接执行）；非 Windows 用 `X_OK` 即可。
- 平台特殊资源一律分流：`/dev/null` → Windows 用 `NUL`；shell 命令（`chmod` 0o755、`PATH=/usr/bin` 等）必须按平台分支或用跨平台 API 替代。
- `color-scheme` / `themeColor` / `viewport` 等涉及 meta 标签的，按平台使用数组形式（Next.js viewport 已支持 media query 列表）。
- 进程退出码、signal 行为、Windows 的 `\\?\` 长路径、8.3 短名、`.cmd` shim 的 cmd.exe 转义都属于已知差异点。改动涉及子进程或文件系统时主动检查这些点。

**单元测试 / 集成测试必须遵守的规则：**

- 所有 mock 子命令在 Windows 上必须有 `.cmd` wrapper，且 wrapper 用 `exit /b %ERRORLEVEL%`；不要只写 `#!/usr/bin/env node` 的 shebang 文件（Windows 无法直接执行）。
- 测试设置 PATH 时必须：(a) 包含脚本真实依赖（如 `git`）；(b) 排除掉 CI runner 全局可能预装的同名二进制（如全局 openspec），避免"不在 PATH"这类负面用例假阳性。
- `import.meta.url` 一律走 `fileURLToPath`；`os.tmpdir()` 是允许的，`/tmp` 字符串硬编码不允许。
- 任何跨进程断言（退出码、stdout / stderr 内容）必须考虑 Windows cmd.exe 对 `.cmd` 包装退出码的归一化、stderr 捕获丢失等已知问题。
- 新增 / 修改测试前先在 `windows-latest` runner 跑一遍验证；不要只靠 macOS 本地全绿就合并。

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