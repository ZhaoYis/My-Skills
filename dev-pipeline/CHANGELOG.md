# 更新日志

`opsx-dev-pipeline` 所有值得注意的变更都记录在本文件。格式遵循
[Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循
[语义化版本](https://semver.org/lang/zh-CN/)。

> 内容源自 `git log`。新增条目请在 PR 中同步更新 **Unreleased** 段。

## [Unreleased](https://github.com/ZhaoYis/My-Skills/compare/v0.2.20...HEAD)

### Changed

- **feat(manifest)**：升级 manifest 到 `schemaVersion = 2`，引入
`tools: ToolId[]` 字段记录所有已安装的工具；旧版单一 `tool` 字段保留
作为向后兼容的"主工具"标识。新版结构允许在同一项目中多次执行
`init` 安装不同工具（例如先装 `claude` 再装 `opencode`），第二次
`init` 不会覆盖第一次的资产记录。
- **feat(manifest)**：`managedAssets[]` 中每条资产新增可选 `tool`
字段用于归属标记；`README.md`、`openspec/config.yaml` 等工具无关
资产保持无标签。读取老版 manifest 时会按目标路径前缀和资产 id 前缀
自动反推工具归属。
- **feat(uninstall)**：`uninstall` 命令新增 `--tool <id>` 选项，仅
卸载指定工具的资产；不指定时维持原有"全部卸载"语义，但 manifest
的 `tools` 字段会随单工具卸载同步收敛。

### Added

- **feat(sync/upgrade)**：`sync` 与 `upgrade` 现在会遍历 manifest 中
记录的所有工具，逐个重新渲染受管文件，确保多工具安装的资产在升级
时同步刷新。
- **feat(doctor)**：`doctor` 输出新增 `tools` 列表；当同时存在多个
工具时额外打印 `active tool` 行。
- 新增 `opsx-init` skill 与 command 资产包
（`opsx-dev-pipeline-skill-bundle:SKILL.md.hbs`、
`opsx-dev-pipeline-command`），已纳入 manifest，使 `init` 在安装
dev-pipeline skill 的同时一并安装 init 辅助 skill。

### Tests

- **test**：新增 `test/integration/multi-tool.test.ts`，覆盖
schema 升级、跨工具 init 合并、`--tool` 卸载隔离、共享资产保留、
重复 init 幂等、错误工具拒绝等场景。

### Fixed

- **chore(lint)**：清掉 49 条 biome lint 警告（含 `useLiteralKeys`、
`noNonNullAssertion`、`useOptionalChain`、`noUnusedImports` 等），
并对必要的非空断言使用 `// biome-ignore` 标注。
- **chore**: `.gitignore` 追加 `.DS_Store` / `Thumbs.db` /
`desktop.ini`；新增 `LICENSE` (MIT) 文件、`CONTEXT.md` 领域词汇表、
`docs/adr/0001` / `0002` 两份初始 ADR。
- **docs(website)**：官网 `website/` 同步 v0.2.20+ 的最新能力——
Hero / Problem 新增"工具碎片化 / 危险命令被默许"两条痛点；
Tools 版块从 3 工具扩展到 4 工具（Claude Code / OpenCode / Cursor /
Codex），新增 5 套 tech-stack 模板列表；新增 **MULTI-TOOL** 版块
（manifest.tools 追踪、init --tool 可叠加、按工具粒度卸载）、
新增 **ROUTE 分级** 版块（trivial / standard / full 三档流水线
重量）、新增 **PIPELINE HOOKS** 版块（block-dangerous-bash.sh +
block-sensitive-write.sh 的拦截规则与按工具的接入矩阵）；
Limitations 版块补回并按 Schema v2 调整适用规模；Stats 升级到 8
项指标（增加 Route 等级、PreToolUse 钩子数量）；FAQ 新增多工具、
Route 升降级、PreToolUse 钩子接入、`--lang en` 等条目。



## [0.2.20](https://github.com/ZhaoYis/My-Skills/compare/v0.2.19...v0.2.20) - 2025-08-28



### Changed

- **perf**：流水线状态命令自动汇总输出，减少 agent 上下文中的 token
消耗。
- **feat**：增强 dev-pipeline 状态管理，新增 `view` 选项。
- **feat**：重构资产管理与技术栈配置；新增对 **Python + React**
技术栈细分的支持。
- **feat**：调整对用户维护的 `README.md` 和 `.gitignore` 的写入策略
—— 用户编辑在 `sync` / `upgrade` 中得到保留。
- **feat**：`init` 时 `.gitignore` 写入采用追加策略。



### Added

- **feat**：为 **Claude Code** 与 **OpenCode** 引入流水线 Hooks
（PreToolUse 脚本 `block-dangerous-bash.sh`、
`block-sensitive-write.sh`）。Cursor / Codex 的 Hook 仍按文档手动
配置。
- **feat**：新增第四个 Tool 目标 `opencode`。
- **feat**：支持 `--lang en` 切换面向用户的本地化模板与 prompt
（默认仍为 `zh`）。
- **ci**：新增 GitHub Actions workflow，支持 Node.js 16+。



## [0.2.19](https://github.com/ZhaoYis/My-Skills/compare/v0.2.18...v0.2.19) - 2025-08



### Removed

- **chore**：下线遗留的 **Python FastAPI backend** 技术栈细分配置。



### Fixed

- **fix**：Windows 兼容性 —— 统一路径分隔符与 shell 脚本处理，使安装
流程跨平台可用。



## [0.2.18](https://github.com/ZhaoYis/My-Skills/releases/tag/v0.2.18) - 2025-08



### Added

- **feat**：按 Tool 区分命令调用语法 —— Claude Code 用 `/opsx:xxx`，
Cursor 用 `/opsx-xxx`，Codex 用 `$opsx-xxx`。
- **feat**：统一所有 Tool 的 skill 命名为 `opsx:`* 前缀。



### Changed

- **docs**：重写 README，统一使用 `opsx:` 命名约定。

