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
- `opsx-clarify`：把模糊需求转成带优先级、可对外分享的澄清问题清单，输出平台无关、不内置任何凭据
- `opsx-design`：设计文档撰写 + 质量门禁（相关性过滤、受众标注、改动影响汇总含"不受影响"项、验证断言字段、任务=一文件）
- `opsx-verify`：语言无关的通用验证流程（解析验证目标 → 按项目基准构建/启动 → 冒烟/契约/数据校验 → 影响面回归 + 失败回路）
- `opsx-health`：知识库健康巡检（对话内），复用 `doctor` 结果产出结构化报告与 P0–P3 修复建议
- `git-commit-push`：提交并推送当前仓库变更，包含分支同步与敏感信息检查
- `git-code-review`：面向当前分支变更的 Git 审查流程，默认结合 `openspec/project.md` 输出中文审查报告
- `git-merge-branch`：将当前分支按指定策略合并到目标分支，并处理合并后的收尾动作
- `file-code-review`：对指定文件或代码片段进行独立代码审查，适合无 Git diff 场景

此外还有一个**可选（默认关闭）**的 skill，通过 feature flag 控制：

- `opsx-prototype`：把原型链接 / 截图 / 描述转成结构化需求，喂给 `opsx-analysis`。依赖可选的外部浏览器自动化 / 视觉分析工具，未安装时优雅降级为"用户粘贴截图 / 口述"，且不内置任何凭据。默认**不生成**，需在初始化时显式开启 flag：

```bash
npx opsx-dev-pipeline init --tool claude --yes --feature prototype
```

`opsx-clarify` / `opsx-design` / `opsx-verify` 构成需求前置到验证的能力链，并与流水线保持单源治理：

- `opsx-clarify` 与 `opsx-analysis` 分工：后者的澄清阶段服务于分析本身，`opsx-clarify` 面向"独立产出一份可发给产品/干系人的问题清单"。
- `opsx-design` 产出的"验证断言字段"由 `opsx-verify` 直接消费，形成 design→verify 质量闭环。
- `opsx-design` / `opsx-verify` 定位为"能力库"：流水线 Phase 1 生成 design、Phase 4 执行 verify 门禁时可加载它们，但"何时必须产出 design / 何时必须验证"的门禁权威仍在 `opsx-dev-pipeline` 各 Phase。

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
/opsx-clarify 把这个模糊需求整理成澄清问题清单
/opsx-design 根据分析结果产出一份带质量门禁的设计
/opsx-verify add-export-limit
/opsx-health
/git-code-review
/git-commit-push
/git-merge-branch
/file-code-review path/to/changed-file
```

如果是 Claude Code，默认会生成到 `.claude/commands/` 与 `.claude/skills/`；其他工具会映射到各自目录（如 Cursor 的 `.cursor/commands/` / `.cursor/rules/`）。

此外，四套工具 overlay（`CLAUDE.md` / Cursor rule / Codex prompt / 通用 `.ai/README.md`）都会注入一段通用的「知识优先」规则：每个开发 / 排查任务开始前先检索 `.knowledge/` 知识库、命中即复用、写入一律追加不覆盖；项目无知识库时该规则自动跳过、不报错。Cursor 规则以 `alwaysApply: true` 常驻。

## Commands


| Command      | Example                                          | Description             |
| ------------ | ------------------------------------------------ | ----------------------- |
| `init`       | `npx opsx-dev-pipeline init --tool claude --yes` | 初始化当前目录的模板文件            |
| `list-tools` | `npx opsx-dev-pipeline list-tools`               | 查看当前内置支持的 AI 工具适配器      |
| `doctor`     | `npx opsx-dev-pipeline doctor --json`            | 检查 manifest、知识库骨架与索引健康，输出 0–100 健康评分与断链 / 重复 / 老化检查；可加 `--history` 落盘快照并对比上次得分趋势，`--stale-days` 调整老化阈值 |
| `sync`       | `npx opsx-dev-pipeline sync --dry-run`           | 根据 manifest 重新渲染托管文件    |
| `upgrade`    | `npx opsx-dev-pipeline upgrade --dry-run`        | 使用当前包内模板执行升级入口          |


> 提示：`init` 完成后，你可以在生成的 commands / skills 目录里直接使用 `opsx-learn`，把现有仓库知识逐步沉淀到知识库中。

## License

MIT