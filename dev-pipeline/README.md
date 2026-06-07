# opsx-dev-pipeline

`opsx-dev-pipeline` 是一个用于初始化 AI 开发工作流模板的 CLI。它会根据你选择的 AI 工具，在项目中生成对应的 skills、commands、rules、prompts 和 manifest 文件。

## Quick Start

推荐直接使用：

```bash
npm create opsx-dev-pipeline@latest
```

也可以直接执行 init：

```bash
npx opsx-dev-pipeline init
```

非交互模式示例：

```bash
npx opsx-dev-pipeline init --tool claude --yes
```

仅预览将要生成的文件：

```bash
npx opsx-dev-pipeline init --tool claude --yes --dry-run
```

## Supported AI Tools

- `claude`：Claude Code，生成 `CLAUDE.md`、`.claude/skills/` 和 `.claude/commands/`
- `cursor`：Cursor，生成面向 Cursor 的 rules 和 command 模板
- `codex`：Codex，生成面向 Codex 的 prompts 和 command 模板

## Commands


| Command      | Example                                          | Description             |
| ------------ | ------------------------------------------------ | ----------------------- |
| `init`       | `npx opsx-dev-pipeline init --tool claude --yes` | 初始化当前目录的模板文件            |
| `list-tools` | `npx opsx-dev-pipeline list-tools`               | 查看当前内置支持的 AI 工具适配器      |
| `doctor`     | `npx opsx-dev-pipeline doctor`                   | 检查当前目录的 manifest 和初始化状态 |
| `sync`       | `npx opsx-dev-pipeline sync --dry-run`           | 根据 manifest 重新渲染托管文件    |
| `upgrade`    | `npx opsx-dev-pipeline upgrade --dry-run`        | 使用当前包内模板执行升级入口          |


## License

MIT