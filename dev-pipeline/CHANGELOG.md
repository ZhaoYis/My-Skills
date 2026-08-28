# 更新日志

`opsx-dev-pipeline` 所有值得注意的变更都记录在本文件。格式遵循
[Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循
[语义化版本](https://semver.org/lang/zh-CN/)。

> 内容源自 `git log`。新增条目请在 PR 中同步更新 **Unreleased** 段。

## [Unreleased](https://github.com/ZhaoYis/My-Skills/compare/v0.2.20...HEAD)

### Changed

- **chore(deps)**：升级 `@fission-ai/openspec` 至 `^1.7.0`，升级
`@biomejs/biome` 至 `^2.5.3`，清理过期的 `.tgz` 产物。

### Added

- 新增 `opsx-init` skill 与 command 资产包
（`opsx-dev-pipeline-skill-bundle:SKILL.md.hbs`、
`opsx-dev-pipeline-command`），已纳入 manifest，使 `init` 在安装
dev-pipeline skill 的同时一并安装 init 辅助 skill。

### Fixed

- **chore(lint)**：清掉 49 条 biome lint 警告（含 `useLiteralKeys`、
`noNonNullAssertion`、`useOptionalChain`、`noUnusedImports` 等），
并对必要的非空断言使用 `// biome-ignore` 标注。
- **chore**: `.gitignore` 追加 `.DS_Store` / `Thumbs.db` /
`desktop.ini`；新增 `LICENSE` (MIT) 文件、`CONTEXT.md` 领域词汇表、
`docs/adr/0001` / `0002` 两份初始 ADR。



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

