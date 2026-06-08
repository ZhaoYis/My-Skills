# opsx-dev-pipeline

`opsx-dev-pipeline` 是一个用于初始化 AI 开发工作流模板的 CLI。它会根据你选择的 AI 工具，在项目中生成对应的 skills、commands、rules、prompts。

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

## Generated Integrated Commands

初始化后，模板会额外安装一组面向 AI 工具的集成命令 / skill 入口。当前内置包括：

- `opsx-dev-pipeline`：驱动 OpenSpec + Git 需求开发流水线
- `opsx-learn`：面向现有仓库的渐进式知识沉淀流程，可把功能、接口、规则、FAQ、术语、配置约束、故障案例等整理进知识库
- `opsx-analysis`：基于知识库、仓库上下文与用户补充进行需求分析，默认输出结构化分析结果
- `git-commit-push`：提交并推送当前仓库变更，包含分支同步与敏感信息检查
- `git-code-review`：面向当前分支变更的 Git 审查流程，默认结合 `openspec/project.md` 输出中文审查报告
- `git-merge-branch`：将当前分支按指定策略合并到目标分支，并处理合并后的收尾动作
- `file-code-review`：对指定文件或代码片段进行独立代码审查，适合无 Git diff 场景

其中 `opsx-learn` 的默认使用方式为：

- 先运行预检脚本，检查仓库上下文与知识库目录建议
- 新通过 `opsx-dev-pipeline` 初始化的项目会默认生成 `.knowledge/` 骨架
- 首次使用时若仓库中已有其他明显知识目录，则优先复用该位置
- 若无既有约定且未生成骨架，再明确提示用户确认知识库存放位置

其中 `opsx-analysis` 的默认使用方式为：

- 先运行预检脚本，检查知识库、README/CLAUDE.md/AGENTS.md 与其他上下文入口
- 先明确需求目标与边界，再执行一轮探索上下文流程
- 默认继续完成：功能点拆解、影响面分析与结构化分析输出
- 输出中明确区分已确认事实、基于证据的推断与待确认问题
- 默认在对话中输出结果，不强制写文件

新增的 Git / 文件审查相关入口可直接作为生成后 commands 的常用入口，例如：

```md
/git-code-review
/git-commit-push
/git-merge-branch
/file-code-review src/main/java/com/example/ExampleController.java
```

如果是 Claude Code，默认会生成到 `.claude/commands/` 与 `.claude/skills/`；其他工具会映射到各自目录（如 Cursor 的 `.cursor/commands/` / `.cursor/rules/`）。

## Commands


| Command      | Example                                          | Description             |
| ------------ | ------------------------------------------------ | ----------------------- |
| `init`       | `npx opsx-dev-pipeline init --tool claude --yes` | 初始化当前目录的模板文件            |
| `list-tools` | `npx opsx-dev-pipeline list-tools`               | 查看当前内置支持的 AI 工具适配器      |
| `doctor`     | `npx opsx-dev-pipeline doctor --json`            | 检查当前目录的 manifest、知识库骨架与索引健康 |
| `sync`       | `npx opsx-dev-pipeline sync --dry-run`           | 根据 manifest 重新渲染托管文件    |
| `upgrade`    | `npx opsx-dev-pipeline upgrade --dry-run`        | 使用当前包内模板执行升级入口          |


> 提示：`init` 完成后，你可以在生成的 commands / skills 目录里直接使用 `opsx-learn`，把现有仓库知识逐步沉淀到知识库中。

## License

MIT