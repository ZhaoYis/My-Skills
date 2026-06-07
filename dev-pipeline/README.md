# opsx-dev-pipeline

`opsx-dev-pipeline` 是一个面向 AI 开发工作流的一站式初始化工具，用来帮助你快速在项目中生成适配不同 AI 工具的基础目录、提示模板、命令模板和说明文件。

它的目标是：**让团队可以用一套统一的初始化方式，把 skills、commands、rules、prompts 等模板资产，按不同 AI 工具的约定目录自动落盘。**

当前首个正式内置 skill 是 `dev-pipeline`，并且现在会同时安装对应的入口 command，用户安装后可以直接通过 command 来驱动这个 skill。

当前版本已经支持：

- 初始化新项目模板
- 按 AI 工具生成对应目录结构
- 写入项目清单文件 `opsx-dev-pipeline.json`
- 通过 `doctor` / `sync` / `upgrade` 做基础生命周期管理

---

## 适合谁使用

如果你符合下面任一场景，这个项目就适合你：

- 想给自己的项目统一接入 Claude Code / Cursor / Codex 等 AI 工具工作流
- 想把团队内部沉淀的 skills、commands、prompts 做成模板
- 想通过 npm 一键初始化 AI 开发流水线基础结构
- 想让新同学进入项目后，按文档几分钟内就能跑起来

---

## 支持的 AI 工具

当前支持以下目标工具：


| 工具          | 生成的核心目录/文件                                        | 说明                       |
| ----------- | ------------------------------------------------- | ------------------------ |
| Claude Code | `CLAUDE.md`、`.claude/skills/`、`.claude/commands/` | 最完整支持，适合 Claude Code 工作流 |
| Cursor      | `.cursor/rules/`、`.cursor/commands/`              | 生成 Cursor 规则与仓库级命令模板     |
| Codex       | `.codex/prompts/`、`.codex/commands/`              | 生成 Codex prompt 与命令模板    |
| Generic     | `.ai/skills/`、`.ai/commands/`、`.ai/README.md`     | 通用兜底方案，适合暂未精细适配的工具       |


---

## 你会得到什么

初始化后，工具会根据你的选择生成：

- 基础项目说明文件 `README.md`
- 忽略文件 `.gitignore`
- 项目清单 `opsx-dev-pipeline.json`
- 对应 AI 工具的 docs / rules / prompts / skills / commands 目录
- 一些可直接修改和扩展的模板文件

例如选择 `claude` 时，会生成类似：

```text
CLAUDE.md
.claude/
  skills/
    dev-pipeline/
      SKILL.md
      assets/
      references/
      scripts/
  commands/
    dev-pipeline.md
    review.md
opsx-dev-pipeline.json
README.md
.gitignore
```

---

## Quick Start

### 方式一：直接使用 npm create

推荐新用户使用：

```bash
npm create opsx-dev-pipeline@latest
```

执行后会进入交互式初始化流程，让你选择：

- 项目名称
- 目标 AI 工具
- 需要启用的模板功能包

### 方式二：使用 npx 直接初始化

```bash
npx opsx-dev-pipeline init
```

### 方式三：非交互模式

适合脚本化或 CI 场景：

```bash
npx opsx-dev-pipeline init --tool claude --yes
```

也可以先预览，不真正写入文件：

```bash
npx opsx-dev-pipeline init --tool claude --yes --dry-run
```

---

## 常用命令

### 初始化项目

安装完成后，推荐优先使用生成的 `dev-pipeline` command 作为 skill 入口。

```bash
opsx-dev-pipeline init
```

常用参数：

- `--tool <tool>`：指定工具，如 `claude` / `cursor` / `codex` / `generic`
- `--yes`：跳过交互，直接使用默认值/命令行参数
- `--dry-run`：只预览，不写文件
- `--force`：允许覆盖已托管文件
- `--dir <dir>`：指定目标目录

示例：

```bash
opsx-dev-pipeline init --tool cursor --yes --dir ./demo-project
```

### 查看支持的工具

```bash
opsx-dev-pipeline list-tools
```

### 检查项目状态

```bash
opsx-dev-pipeline doctor
```

它会读取项目中的 `opsx-dev-pipeline.json`（同时兼容旧的 `dev-pipeline.json`），帮助你确认：

- 当前项目是否已初始化
- 使用的是哪个 AI 工具
- 启用了哪些 feature
- 模板版本是多少

### 同步模板文件

```bash
opsx-dev-pipeline sync
```

适用于你已经初始化过项目，但希望根据 manifest 重新生成托管文件的情况。

### 升级模板文件

```bash
opsx-dev-pipeline upgrade
```

当前版本里，`upgrade` 会复用 `sync` 的主逻辑，用于后续模板升级流程的基础入口。

---

## 新手推荐上手流程

如果你是第一次使用，建议按下面顺序操作：

### 第 1 步：初始化

```bash
npx opsx-dev-pipeline init --tool claude --yes
```

### 第 2 步：查看生成内容

重点关注：

- `opsx-dev-pipeline.json`
- 工具专属目录（如 `.claude/`、`.cursor/`、`.codex/`、`.ai/`）
- 生成的 `README.md` / docs / prompts / commands

### 第 3 步：按你的项目需求修改模板

比如：

- 改写 `project-planner.md`
- 补充你自己的命令模板
- 增加团队内部约定的规则或提示词

### 第 4 步：后续变更时使用 doctor / sync / upgrade

```bash
opsx-dev-pipeline doctor
opsx-dev-pipeline sync --force
opsx-dev-pipeline upgrade --force
```

---

## 项目清单文件说明

初始化完成后，项目根目录会生成：

```text
opsx-dev-pipeline.json
```

这个文件用来记录：

- 当前项目选择的工具
- 已启用的功能包
- 当前模板版本
- 当前托管的资产文件列表

后续 `doctor`、`sync`、`upgrade` 都会依赖它。

> 兼容说明：旧版本生成的 `dev-pipeline.json` 仍可被识别。

---

## 本地开发

如果你正在开发这个项目本身，可以使用：

```bash
npm install
npm run typecheck
npm test
npm run build
```

本地调试 CLI：

```bash
npm run dev -- --help
npm run dev -- list-tools
npm run dev -- init --tool claude --yes --dry-run
```

验证打包产物：

```bash
npm pack --dry-run
```

---

## 当前项目状态

当前版本已经完成：

- 品牌统一为 `opsx-dev-pipeline`
- 可执行入口与 npm 打包结构修正
- Claude / Cursor / Codex / Generic 全部具备初始化支持
- `doctor` / `sync` / `upgrade` 基础生命周期命令
- 全量自动化测试与打包验证

适合作为一个 **内置首个正式 skill bundle（`dev-pipeline`）的 AI 开发流水线模板初始化框架** 的基础版本继续扩展。

---

## 后续可扩展方向

你可以在这个基础上继续扩展：

- 更丰富的 skills / commands 模板库
- 团队级标准 prompts / rules
- 更多 AI 工具适配器
- 更强的 upgrade diff / merge 能力
- 模板市场化或私有模板仓库集成

---

## License

MIT