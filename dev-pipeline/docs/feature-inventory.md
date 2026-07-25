# opsx-dev-pipeline 功能全景清单

> **内部参考文档** — 完整的系统功能目录，供开发者了解系统全貌。
>
> 📢 **门户网站素材**请使用 [`portal-content-strategy.md`](./portal-content-strategy.md) — 已将功能描述翻译为用户价值主张，按用户心智重排序，删除了实现细节。

---

## 🎯 一句话定位

**opsx-dev-pipeline** 是面向 AI 驱动开发时代的**全流程门禁式研发流水线 CLI** — 一条命令搭建从提案到交付的完整工程基础设施，让 AI Coding Agent 在你的规范、门禁和交付约束下高效工作。

---

## 🏗️ 一、一键初始化：零配置搭建 AI 研发基础设施


| 功能                           | 亮点                                                         |
| ---------------------------- | ---------------------------------------------------------- |
| `npx opsx-dev-pipeline init` | 单条命令完成 OpenSpec 初始化、Schema 安装、Skill/Command 部署、Manifest 写入 |
| **交互式 + 非交互双模式**             | `--yes` 静默安装适配 CI/CD；交互模式引导式配置                             |
| `--dry-run` **预览**           | 安装前完整展示将要生成的文件清单，所见即所得                                     |
| `--force` **覆盖**             | 智能冲突管理：默认跳过已有文件，`--force` 覆盖托管文件                           |
| `--feature` **可选模块**         | 按需启用 `structural-analysis-hint` 等增强功能                      |
| `--dir` **目标目录**             | 支持安装到任意项目目录                                                |


---



## 🔌 二、多 AI 工具适配器架构


| AI 工具              | 生成产物                                                         | 特色                                           |
| ------------------ | ------------------------------------------------------------ | -------------------------------------------- |
| **Claude Code**    | `CLAUDE.md`、`.claude/skills/`、`.claude/commands/`            | 原生 Skill bundle 集成，`/opsx-dev-pipeline` 一键触发 |
| **Cursor**         | `.cursor/rules/`、`.cursor/commands/`、`opsx-dev-pipeline.mdc` | 按需加载规则，不污染全局上下文                              |
| **Codex (OpenAI)** | `.codex/prompts/`、`.codex/commands/`、`agents/openai.yaml`    | 完整 OpenAI agent 描述 + 入口 prompt               |


**架构特色：**

- **可扩展适配器注册表** — 新增 AI 工具只需添加配置条目
- **自动检测** — `list-tools` 查看内置支持，`--json` 输出结构化清单
- **统一抽象层** — skills/commands/docs 三通道，各工具自动映射到正确目录

---



## 🔄 三、流水线状态机：7 阶段门禁式开发交付引擎

```
Phase0 预检 → Phase1 提案 → Phase2 实施 → Phase3 审查 → Phase4 单测 → Phase5 归档 → Phase6 交付
```



### 状态机核心能力


| 能力         | 描述                                                                    |
| ---------- | --------------------------------------------------------------------- |
| **严格状态转换** | 合法跳转白名单（如 Phase2→Phase4 跳过审查），非法跳转自动拦截                                |
| **门禁校验**   | Phase 切换前强制检查前置条件（提案批准？实施确认？测试通过？verify 通过？归档完成？）                     |
| **原子持久化**  | `write-to-temp + rename` 模式，崩溃不丢数据、不产生损坏文件                            |
| **决策记录**   | 每个高风险决策写入状态（`proposalApproved`、`mergeStrategy`、`postArchiveAction` 等） |
| **重试上限**   | 审查修复最多 3 轮、测试/verify 最多 3 次尝试，超限自动暂停                                  |
| **暂停/恢复**  | 任意阶段可 `pause`，记录中断原因；恢复时自动检测状态与 Git 事实一致性                             |
| **完成关闭**   | 仅 Phase6 可 `complete`，防止未完成流水线被误标记                                    |




### 可恢复性设计

- 状态文件 `${change}.json` 是唯一恢复权威
- 恢复时并行核对：OpenSpec change 状态 + Git 分支/冲突 + 任务勾选 + 审查报告
- 状态与事实不一致 → 暂停并列出差异，禁止猜测跳阶段
- 状态丢失但 change 存在 → 询问用户后按检测事实重建

---



## 📋 四、OpenSpec 规范驱动开发深度集成


| 能力                                    | 说明                                                            |
| ------------------------------------- | ------------------------------------------------------------- |
| **Proposal → Specs → Design → Tasks** | 四阶段制品工作流，每个阶段有专门模板和 AI 指令                                     |
| **Delta Specs 系统**                    | ADDED / MODIFIED / REMOVED / RENAMED 四种变更操作，精确追踪需求变化          |
| **场景驱动规范**                            | `#### Scenario:` 格式，WHEN/THEN 结构，每个 Requirement 至少一个 Scenario |
| **任务跟踪**                              | `- [ ] X.Y Task description` checkbox 格式，AI 实施时自动跟踪完成状态       |
| **归档同步**                              | 变更归档后 Delta Specs 自动合并到主 Specs，保持规范与代码一致                      |
| **Validate 校验**                       | 变更级/全量级双模式校验（`openspec validate <name> --no-interactive`）     |


---



## 🖥️ 五、前后端技术栈模板


| 维度         | Frontend                                                                           | Backend                                   |
| ---------- | ---------------------------------------------------------------------------------- | ----------------------------------------- |
| **技术栈**    | React 18+ · TypeScript · Vite                                                      | Java 17+ · Spring Boot 3.x · Maven/Gradle |
| **Schema** | UI/UX 影响分析 · 浏览器兼容 · 组件树 · 路由与状态管理                                                 | API 契约 · 数据库迁移 · 数据模型 · 中间件与拦截器           |
| **Config** | stack.id · stack.languages · stack.services[] · stack.verify（build/smoke/contract） |                                           |
| **模板**     | proposal.md · design.md · spec.md · tasks.md（含完整 AI 指令）                            |                                           |


**Stack 健康检查：** `opsx-dev-pipeline doctor --stack` 校验 `openspec/config.yaml` 中每个 service 的 name/path 存在性、命令完整性（dev/test/integration/e2e）、cwd 有效性。

---



## 🔧 六、10 个专用流水线脚本 + 共享库


| 脚本                   | 功能                                                                                 | 所属阶段      |
| -------------------- | ---------------------------------------------------------------------------------- | --------- |
| `preflight`          | 环境预检（openspec 版本、git 仓库、config.yaml、git 用户配置）                                      | Phase 0   |
| `new-change`         | 创建 OpenSpec change                                                                 | Phase 1   |
| `instructions`       | 获取 artifact 生成指令 + 自动检测首个 ready artifact                                           | Phase 1   |
| `instructions-apply` | 获取 apply 上下文（任务列表 + 设计文档）                                                          | Phase 2   |
| `validate-change`    | 校验单个 change                                                                        | Phase 1/5 |
| `validate-all`       | 批量校验所有 changes                                                                     | Phase 5   |
| `change-status`      | 查询 change 状态                                                                       | Phase 5   |
| `list-changes`       | 列出所有 changes                                                                       | Phase 0   |
| `archive`            | 归档 change                                                                          | Phase 5   |
| **状态机**              | `dev-pipeline-state.mjs` — init/get/decision/set/attempt/transition/pause/complete | 全阶段       |


**设计特色：**

- **JSON 契约** — 所有脚本输出结构化 JSON，AI Agent 可精确解析
- **统一错误协议** — `{status, reason, detail, nextAction}` 四段式错误，AI Agent 可自动决策下一步
- **退出码语义化** — 1-6 (pipeline-lib) + 10-12 (state machine)，精确区分错误类型
- **bash → .mjs 迁移** — 消除双语言维护负担，统一到 Node.js 技术栈，跨平台兼容

---



## 📦 七、文件生命周期管理


| 命令          | 功能                       | 使用场景               |
| ----------- | ------------------------ | ------------------ |
| `sync`      | 按 manifest 重新渲染已托管文件     | 修复被误改的模板文件         |
| `upgrade`   | sync + 采纳包内新增模板          | CLI 升级后同步最新模板      |
| `uninstall` | 删除托管文件、清理空目录、更新 manifest | 彻底移除 pipeline 基础设施 |
| `doctor`    | 检查 manifest 完整性、版本兼容性    | 诊断安装状态、发现升级需求      |


**Manifest 系统：**

- 双存储策略：优先嵌入 `package.json`（`opsxDevPipeline` 键），fallback 到独立文件
- 记录：tool、stack、features、templateVersion、managedAssets（含 bundle 成员追踪）
- `doctor` 对比 manifest `templateVersion` 与当前 CLI 版本，给出升级建议

---



## 🛡️ 八、安全门禁与交付保障


| 能力                     | 详情                                                                 |
| ---------------------- | ------------------------------------------------------------------ |
| **敏感文件检测**             | 自动扫描 `.env`、`*.key`、`*.pem`、`*.p12`、`*.pfx`、`credentials.json`、私钥块 |
| **禁止破坏性操作**            | 禁用 `git add -A`、`git push --force`、`git branch -D`                 |
| **分步确认**               | commit、push、merge、delete branch、create tag 各自独立确认，禁止合并审批           |
| **Pre-commit Hook 管理** | Hook 失败后修复重试；`--no-verify` 作为新的高风险决策单独确认                           |
| **合并冲突协议**             | 列出冲突文件 → 逐文件选择策略（禁止全局 ours/theirs）→ 所有冲突解决后才允许完成                   |
| **合并策略选择**             | Standard merge / Squash merge / No-ff merge                        |
| **回滚保护**               | 合并后验证失败禁止 push；回滚本地合并需再次显式确认                                       |
| **Fast-forward Only**  | 只允许 fast-forward 同步，分叉时暂停让人工决定                                     |


---



## 🧪 九、E2E 流水线测试基础设施

```
EnvironmentFactory → PipelineAgentOrchestrator → PhaseValidators → ReportGenerator
```


| 特性             | 说明                                                 |
| -------------- | -------------------------------------------------- |
| **零外部依赖**      | 不调用真实 AI Agent、不访问远程仓库、不需要全局 OpenSpec              |
| **隔离 Git 环境**  | 自动创建 bare remote + feature/main 分支，模拟真实多分支协作       |
| **确定性强执器**     | `DeterministicPipelineExecutor` 精确控制每个 Phase 的输入输出 |
| **Phase 级验证器** | 同时核对状态文件、文件系统、Git 工作区、远端 refs                      |
| **场景覆盖**       | Happy-path 全流程 · 缺依赖错误恢复 · 归档失败保持状态 · 断言完整性        |
| **双格式报告**      | JSON（机器消费）+ Markdown（人类阅读）                         |


---



## 🤖 十、Hermes 智能 Agent 编排系统（预览）

`dist/` 目录中包含一个尚未合并到源码的特性分支 — **Hermes 智能编排引擎**：


| 能力               | 描述                            |
| ---------------- | ----------------------------- |
| **Agent 注册表**    | 按 Phase 查找对应的 Agent 配置，支持动态路由 |
| **学习循环**         | 自动检测流水线执行的成功/失败模式，高置信度时自动应用优化 |
| **Skill Memory** | 跨执行追踪每个 Skill 的成功率，积累经验       |
| **决策日志 (JSONL)** | 每次决策持久化记录，支持相似度搜索回溯历史         |
| **运行时状态追踪**      | 记录恢复尝试次数，支持自愈重试               |


---



## 🎨 十一、匠心设计细节


| 细节                    | 价值                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------- |
| **Handlebars 模板引擎**   | `{{toolId}}`、`{{stack}}`、`{{skillsDir}}`、`{{#hasFeature}}` 动态渲染，一套模板多工具复用          |
| **Bundle 模式资源管理**     | 批量展开目录 → 追踪每个成员 → sync/upgrade 精确到文件级                                              |
| **Appendable 文件**     | 智能识别可追加文件（如 `.gitignore`），允许用户追加自定义内容                                              |
| **智能 Config 合并**      | `config.yaml` 安装时检测已有 `context:` 块，自动追加而非覆盖                                        |
| **Feature Flag 系统**   | `base` / `skills` / `commands` / `docs` / `schema` + 可选 `structural-analysis-hint` |
| **Zod Schema 校验**     | Manifest 读取时严格类型校验，防止损坏的配置文件                                                       |
| **双入口 CLI**           | `opsx-dev-pipeline` + `create-opsx-dev-pipeline` 快捷别名                              |
| **picocolors 终端美化**   | 仅 2KB 的终端色彩库，doctor/sync/upgrade 输出清晰可读                                            |
| **CAC CLI 框架**        | 极简命令行解析，自动生成 help/version                                                          |
| **Biome 代码规范**        | 统一 format + lint，零 ESLint/Prettier 依赖                                              |
| **TypeScript Strict** | 全量类型安全，编译期拦截错误                                                                     |


---



## 🚀 十二、杀手级特性总结



### 🔥 十大核心竞争力

1. **「一条命令搭建 AI 研发流水线」** — `npx opsx-dev-pipeline init` 从零到完整的 AI-Ready 工程基础设施，30 秒内完成
2. **「流水线状态机」** — 业界首创的 AI 开发门禁引擎：7 阶段严格转换、多门禁校验、自动重试上限、中断恢复、决策审计
3. **「三 AI 工具统一适配」** — Claude Code、Cursor、Codex 一套模板、一致体验、各自原生格式
4. **「前后端技术栈一键安装」** — React/Vite 或 Spring Boot，Schema + Templates + Config + Rules 全部就绪
5. **「规范驱动开发 (Spec-Driven)」** — Proposal → Specs → Design → Tasks 四阶段制品体系，Delta Specs 追踪需求变更
6. **「可恢复的持久化状态」** — 流水线中断后精确恢复，状态与 Git/OpenSpec 事实交叉校验
7. **「10 个结构化脚本 + JSON 契约」** — AI Agent 可精确消费的脚本输出，标准化错误协议
8. **「全生命周期文件管理」** — init/sync/upgrade/uninstall/doctor 五命令覆盖安装→升级→诊断→卸载
9. **「E2E 确定性流水线测试」** — 不依赖 AI 的完整流水线回归测试框架
10. **「安全门禁纵深防御」** — 敏感文件检测、禁止 force push、分步确认、合并冲突协议、回滚保护

---



## 📊 技术指标速览


| 指标         | 数值                                                            |
| ---------- | ------------------------------------------------------------- |
| CLI 命令     | 6 个 (init/sync/upgrade/uninstall/list-tools/doctor)           |
| 流水线 Phase  | 7 个 (Phase 0-6) + 多个决策点                                       |
| AI 工具适配    | 3 个 (Claude Code/Cursor/Codex)                                |
| 技术栈模板      | 2 套 (Frontend: React+Vite / Backend: Spring Boot)             |
| 流水线脚本      | 10 个 (9 功能脚本 + 1 状态机) + 共享库                                   |
| Phase 参考文档 | 7 个 (phase-0 到 phase-6)                                       |
| 错误退出码      | 9 个语义化码 (1-6 pipeline, 10-12 state machine)                   |
| 测试覆盖       | 19 个测试文件 / 97 个单元+集成测试 / 4 个 E2E 场景                           |
| Feature 模块 | 5 个必装 + 1 个可选                                                 |
| Asset 定义   | 12 个 (覆盖 base/schema/skills/commands/docs)                    |
| 状态机命令      | 8 个 (init/get/decision/set/attempt/transition/pause/complete) |
| 安全检测       | 9 类敏感文件自动扫描                                                   |


