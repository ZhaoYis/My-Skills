# 更新日志

`opsx-dev-pipeline` 所有值得注意的变更都记录在本文件。格式遵循
[Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循
[语义化版本](https://semver.org/lang/zh-CN/)。

> 内容源自 `git log`。新增条目请在 PR 中同步更新 **Unreleased** 段。

## [Unreleased](https://github.com/ZhaoYis/My-Skills/compare/v0.2.20...HEAD)

### Changed

- **feat(manifest)**：升 schemaVersion=2；新增 `tools: ToolId[]`，旧 `tool` 字段保留作向后兼容。
- **feat(manifest)**：`managedAssets[]` 每条新增可选 `tool` 字段；非工具目录资产保持无标签。
- **feat(uninstall)**：`uninstall --tool <id>` 仅卸载指定工具资产；无 `--tool` 时维持全部卸载语义，`tools` 字段同步收敛。

### Added

- **feat(sync/upgrade)**：`sync` / `upgrade` 遍历 manifest 中所有工具逐个重渲染。
- **feat(doctor)**：`doctor` 输出新增 `tools` 列表；多工具时打印 `active tool`。
- 新增 `opsx-init` skill + command 资产包（`opsx-dev-pipeline-skill-bundle:SKILL.md.hbs`、`opsx-dev-pipeline-command`），`init` 时一并安装。



### Tests

- **test**：新增 `test/integration/multi-tool.test.ts`（schema 升级 / 跨工具 init 合并 / `--tool` 卸载隔离 / 共享资产保留 / 重复 init 幂等 / 错误工具拒绝）。



### Fixed

- **fix(init)**：移除 `buildInstallPlan.ts` 中永远返回 `true` 的 `isAssetInUpgradeScope` 死代码。
- **refactor(init)**：`executeInstallPlan.ts` 中 stack-config schema 行兜底逻辑改为复用同文件 `mergeConfigSchema`。
- **chore(lint)**：清掉 49 条 biome lint 警告（`useLiteralKeys` / `noNonNullAssertion` / `useOptionalChain` / `noUnusedImports`）；必要非空断言用 `// biome-ignore` 标注。

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

