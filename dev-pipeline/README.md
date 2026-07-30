# opsx-dev-pipeline

`opsx-dev-pipeline` 是一个用于初始化 AI 开发工作流模板的 CLI。它会自动初始化 OpenSpec，并根据所选 AI 工具与项目类型生成对应的 skills、commands、schema、rules 和 prompts。

## Quick Start

运行环境：

- **Node.js 20+**
- **OpenSpec CLI 1.6.0+**：必须已安装并可通过 `PATH` 调用

```bash
npm install -g @fission-ai/openspec@latest
openspec --version
```

OpenSpec 安装方式和版本说明参见 [OpenSpec](https://github.com/Fission-AI/OpenSpec)。初始化前 CLI 会执行版本预检；未安装或版本过低时会直接终止并给出错误信息。

推荐直接使用 npx 初始化：

```bash
npx opsx-dev-pipeline@latest init
```

交互模式会提示选择 AI 工具和项目 stack，stack 默认选中 `backend`。

非交互模式示例：

```bash
npx opsx-dev-pipeline init --tool claude --stack backend --yes
```

使用 `--yes` 时，`--stack frontend|backend|fullstack` 为必填参数。

仅预览将要生成的文件：

```bash
npx opsx-dev-pipeline init --tool claude --stack frontend --yes --dry-run
```

`--dry-run` 会执行 OpenSpec 版本预检并显示完整安装计划，但不会调用 `openspec init` 或写入文件。

卸载已安装的托管文件：

```bash
npx opsx-dev-pipeline uninstall --yes
```



## Supported Stacks


| Stack ID    | 默认技术栈                                 | OpenSpec Schema               | 主要规则                       |
| ----------- | ------------------------------------- | ----------------------------- | -------------------------- |
| `frontend`  | React 18+、TypeScript、Vite             | `openspec/schemas/frontend/`  | UI/UX 影响、浏览器兼容、组件树、路由与状态管理 |
| `backend`   | Java 17+、Spring Boot 3.x、Maven/Gradle | `openspec/schemas/backend/`   | API 契约、API 设计、数据库迁移、数据模型、中间件与拦截器  |
| `fullstack` | React 18+（前端）+ Java Spring Boot（后端） | `openspec/schemas/fullstack/` | API 契约优先、前后端分离、Monorepo 约定（`frontend/` + `backend/`） |


每次 `init` 只安装一套 stack schema。所选 stack 会记录在 pipeline manifest 中，后续 `sync` 和 `upgrade` 会继续使用同一套 schema 与 config 模板。

## Supported AI Tools


| Tool ID  | 工具          | 生成目录 / 文件                                                    | 说明                                                |
| -------- | ----------- | ------------------------------------------------------------ | ------------------------------------------------- |
| `claude` | Claude Code | `CLAUDE.md`、`.claude/skills/`、`.claude/commands/`            | `SKILL_ROOT=.claude/skills/opsx-dev-pipeline`     |
| `cursor` | Cursor      | `.cursor/rules/`、`.cursor/commands/`、`opsx-dev-pipeline.mdc` | 按需加载；`SKILL_ROOT=.cursor/rules/opsx-dev-pipeline` |
| `codex`  | Codex       | `.codex/prompts/`、`.codex/commands/`                         | 入口 prompt 加载 `.codex/prompts/opsx-dev-pipeline/`  |


查看当前内置适配器：

```bash
npx opsx-dev-pipeline list-tools
npx opsx-dev-pipeline list-tools --json
```



## Generated Skill & Command

初始化流程如下：

```text
OpenSpec 版本预检
  -> 收集 tool / stack
  -> openspec init --tools <tool>
  -> 安装 stack schema 与 openspec/config.yaml
  -> 安装 opsx-dev-pipeline Skill / Command
  -> 写入 pipeline manifest
```

以 Claude Code + backend 为例，核心产物如下：

```text
.claude/
├── skills/openspec-*/                  # OpenSpec 原生 Skills
├── commands/opsx/                      # OpenSpec 原生 Commands
├── skills/opsx-dev-pipeline/           # Pipeline Skill bundle
└── commands/opsx-dev-pipeline.md       # Pipeline Command

openspec/
├── config.yaml                         # schema: backend + Java/Spring context
└── schemas/backend/
    ├── schema.yaml
    └── templates/
        ├── proposal.md
        ├── api_design.md
        ├── design.md
        ├── spec.md
        └── tasks.md
```

初始化后可使用 OpenSpec 原生命令和 pipeline 流水线入口：


| 入口                   | 类型                       | 用途摘要                                                      |
| -------------------- | ------------------------ | --------------------------------------------------------- |
| `/opsx:explore`      | OpenSpec command         | 探索问题、澄清需求和调查可行方案，不创建正式变更                                  |
| `/opsx:propose`      | OpenSpec command         | 创建变更提案，并生成 proposal、specs、design 和 tasks artifacts        |
| `/opsx:apply`        | OpenSpec command         | 按变更 artifacts 实施任务，并同步任务完成状态                              |
| `/opsx:verify`       | OpenSpec command         | 校验实现是否与变更 artifacts 和规范一致                                 |
| `/opsx:sync`         | OpenSpec command         | 将变更中的 delta specs 同步到主 specs                              |
| `/opsx:archive`      | OpenSpec command         | 完成验证后归档变更，并更新当前规范                                         |
| `/opsx-dev-pipeline` | Pipeline skill / command | 编排 OpenSpec + Git 需求开发全流程（提案 → 应用 → 审查 → 单测 → 归档 → 推送/合并） |


这些 OpenSpec 命令由 `openspec init --tools <tool>` 安装。表中使用 Claude Code 的 `/opsx:<command>` 形式表示逻辑入口；Cursor、Codex 等工具会按各自适配器生成对应的命令文件和调用形式。

Pipeline Skill bundle 同时包含 `agents/openai.yaml`，用于提供 OpenAI/Codex 界面显示名、简述和默认调用提示。

`opsx-dev-pipeline` 是唯一的流水线门禁权威，覆盖 **Phase0–6**：


| Phase | 说明                    |
| ----- | --------------------- |
| 0     | 入口判断                  |
| 1     | 提案编写 (Propose)        |
| 2     | 提案应用 (Apply)          |
| 3     | 代码审查 (Review)         |
| 4     | 单元测试门禁                |
| 5     | 提案归档 (Archive)        |
| 6     | 提交合并推送 (Merge & Push) |


Phase6 是流水线的最终阶段，支持 commit + push，并按决策点 5 的选择决定是否执行本地 merge。

## 研发流程

```mermaid
flowchart TD
  START(["新需求 / 变更"]) --> P0["Phase0 预检与入口"]

  P0 --> P1["Phase1 提案 Propose"]

  P1 --> DP1{"决策点 1a / 1"}
  DP1 -->|确认提案| P2["Phase2 应用 Apply"]
  DP1 -->|补充修改| P1

  P2 --> DP2{"决策点 2"}
  DP2 -->|进入审查| P3["Phase3 审查 Review"]
  DP2 -->|跳过审查| P4["Phase4 单测门禁"]
  DP2 -->|需求有误，回退| P1

  P3 --> DP3{"决策点 3"}
  DP3 -->|审查通过| P4
  DP3 -->|审查未过| FIX["修复 → 再审"]
  FIX --> P3

  P4 --> DP4{"决策点 4"}
  DP4 -->|需要单测| UT["编写并运行单测"]
  UT --> P5["Phase5 归档 Archive"]
  DP4 -->|跳过单测| P5

  P5 -->|验证未过| VFIX["失败回路 → Phase1 或 Phase2"]
  VFIX --> P1
  VFIX --> P2
  P5 -->|归档完成| DP5{"决策点 5"}
  DP5 -->|仅推送| P6["Phase6 提交 / 推送"]
  DP5 -->|合并| P6MERGE["Phase6 提交 / 推送 / 合并"]

  P6 --> DONE(["交付完成"])

  P6MERGE --> DP7{"决策点 7"}
  DP7 -->|确认合并| MERGE["本地 merge"]
  MERGE --> DONE
```





## Commands


| Command      | Example                                                          | Description                                                                        |
| ------------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `init`       | `npx opsx-dev-pipeline init --tool claude --stack backend --yes` | 运行 OpenSpec 预检与初始化，并安装所选 stack 的 schema、config 和 pipeline 模板；非交互模式必须指定 `--stack`   |
| `list-tools` | `npx opsx-dev-pipeline list-tools --json`                        | 查看当前内置支持的 AI 工具适配器；`--json` 输出结构化工具清单（含 destinations / markers / supports）         |
| `doctor`     | `npx opsx-dev-pipeline doctor --json`                            | 检查 manifest，对比 manifest `templateVersion` 与当前 CLI 版本并给出 upgrade 建议                 |
| `sync`       | `npx opsx-dev-pipeline sync --dry-run`                           | 根据 manifest **仅**重新渲染已托管文件；若某 bundle 有部分成员已托管，会同步该 bundle 的全部成员                    |
| `upgrade`    | `npx opsx-dev-pipeline upgrade --dry-run`                        | 在 sync 基础上额外采纳包内**新增**模板；执行前会对比 manifest 与 CLI 版本，manifest 偏新或无法解析时需确认（`--yes` 跳过） |
| `uninstall`  | `npx opsx-dev-pipeline uninstall --dry-run`                      | 按 manifest 删除托管文件并清理空目录；部分删除时会更新 manifest                                          |


> 提示：`init` 完成后，可在生成的 commands / skills 目录里直接使用 `opsx-dev-pipeline` 开始需求开发流程。



### Init Options


| Option                  | Description                                                       |
| ----------------------- | ----------------------------------------------------------------- |
| `--tool <tool>`         | AI 工具 ID：`claude`、`cursor` 或 `codex`                           |
| `--stack <stack>`       | 项目类型：`frontend`、`backend` 或 `fullstack`；`--yes` 模式必填       |
| `--tech-stack <id>`     | 技术栈细分：`java-spring-boot`、`react-vite` 或 `java-react`；可选       |
| `--lang <en\|zh>`        | 文档语言，影响所有 AI 产出物（提案、代码注释、commit message 等）；默认 `zh` |
| `--feature <feature>`   | 启用可选功能（可重复使用，如 `--feature structural-analysis-hint`）      |
| `--yes`                 | 非交互执行；已有冲突文件默认跳过，不等同于覆盖                             |
| `--force`               | 覆盖冲突的托管文件                                                    |
| `--dry-run`             | 预览完整安装计划，不调用 `openspec init`，不写入文件                      |
| `--dir <dir>`           | 指定目标目录，默认当前目录                                              |




## License

MIT