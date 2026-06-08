---
name: phase-3-review
description: 全局步骤 8–11，含决策点 3。「生成修复提案并应用」细则见 phase-3.1-fix-review.md。进入归档路径后执行 phase-4-archive.md 步骤 12。
compatibility: 需要 git；项目规范按 `openspec/config.yaml` → `AGENTS.md` → `CLAUDE.md` 的顺序加载；Cursor 中推荐 AskQuestion。
---

## Phase 3: 代码审查 (Review)

### 步骤 8：加载项目规范

**项目信息来源**：

- **若存在 `openspec/config.yaml`**：读取并解析 YAML（技术栈、架构规则、命名规范、schema、工具链等；字段名以仓库内实际内容及 `openspec` 文档为准）
- **若存在 `AGENTS.md`**：将其作为通用 agent 协作规范补充，仅吸收与 `openspec/config.yaml` 不冲突的执行约束、风格和目录约定
- **若存在 `CLAUDE.md`**：将其作为 Claude 场景补充规范，仅在前两者未覆盖且内容不冲突时使用
- **若三者均不存在**：输出警告“未找到 openspec/config.yaml、AGENTS.md、CLAUDE.md，将回退为读取仓库现有代码、测试与构建文件进行启发式判断”

**若使用自定义 schema**：除上述基准外，优先复用 **Phase 2 步骤 5** 已获取的 `dev-pipeline-change-context.sh` 结果，将其中的 schema 上下文、对应 standards 与 rules 一并纳入审查基准；仅在前序结果缺失、Phase 1 刚补齐元数据，或上下文已失效时，再执行 `bash <SKILL_ROOT>/scripts/dev-pipeline-change-context.sh "<name>"``。根据 schema 定义差异化审查相关实现与测试。

下文将 **步骤 8** 加载结果统称为 **项目基准**。

### 步骤 9：获取变更内容

1. **未提交变更**

    - 使用 `git diff HEAD` 获取全部未提交变更（包含 unstaged + staged）
    - 使用 `git diff --stat HEAD` 获取变更统计

2. **若无未提交变更**：检查是否有未推送的提交

    - **若远程跟踪分支存在**：运行 `git log origin/<current-branch>..HEAD --oneline` 检查未推送提交
        - 有未推送提交：使用 `git diff origin/<current-branch>..HEAD` 审查
        - 无未推送提交：提示「没有需要审查的变更」，进入 Phase 5
    - **若远程跟踪分支不存在**（分支从未推送过）：使用 `git log --oneline -20` 列出近 20 条提交供参考，提示「当前分支尚未推送到远程，建议先完成提交推送后再审查」，进入 Phase 5

### 步骤 10：执行代码审查

**本步骤自包含**：以下审查标准全部在本流水线内执行，**不要求**安装任何外部的独立 Git 代码审查 skill。

#### 10.1 敏感信息扫描

在 diff 全文中检查疑似机密：API key / apikey、`password` / `passwd`、`token` / `access_token` / `refresh_token`、私钥块（`-----BEGIN … PRIVATE KEY-----`）、含用户名密码的数据库 URL、AWS/Azure/GCP 典型密钥格式等。**一旦发现**记入「严重」区块，建议使用环境变量或密钥管理服务；若已进提交历史须提示清理历史的风险（filter-repo / BFG 等）。

#### 10.2 规范基准

以 **步骤 8** 的 **项目基准** 为准（`config.yaml`，其次 `AGENTS.md`，以及必要时 **CLAUDE.md**）：技术栈、分层、命名、风格、约束；凡基准中写明的内容，须在 diff 上逐条对照。

#### 10.3 通用审查维度（在基准文档未展开的缺口上补充）

- **正确性**：逻辑错误、边界与空值、错误处理遗漏、资源未关闭/泄漏风险
- **安全**：注入（SQL 等）、XSS、敏感数据明文、鉴权/授权绕过或缺失
- **性能**：明显 N+1、无谓热路径复杂度、大批量无分页
- **可维护性**：重复逻辑、过大的函数/类、关键行为缺少可读说明

> （可选）分析改动影响面（谁调用谁、波及范围、符号定义位置）时，若启用了 `structural-analysis-hint`（默认关闭，见 `assets/structural-analysis-hint.md`）且仓库具备结构化检索能力（代码图谱 / LSP / 索引型 MCP），优先用之，文本性问题仍用 grep；未启用时按文本检索进行，不影响本步骤。

#### 10.4 典型 Java 分层栈（仅当项目基准或目录结构表明适用时强化检查，否则以项目基准与通用维度为主）

- 分层与依赖：Web → Biz → Core → Common，禁止上层被下层反向依赖、禁止跨层乱依赖
- 命名后缀：Controller、BizService/Impl、DomainService/Impl、Mapper、DO、Model、VO、Request、Convert 等（以项目基准为准）
- 写操作事务：`@Transactional(rollbackFor = Throwable.class)`（若栈使用 Spring）
- 对象转换：优先 MapStruct（`INSTANCE`），避免大面积手写映射
- 日志：使用框架 logger，避免 `System.out.println`

#### 10.5 历史审查

若 `openspec/review/` 中已有**同一分支**的近期报告，对比重复问题、已修复项与回归。

#### 10.6 超大 diff

若变更行数过多（例如统计超过约 5000 行），可按文件或目录分块审查，在报告「概要」中说明分块策略，避免遗漏整文件。

#### 10.7 报告语言与落盘要求

- **语言**：**步骤 8** 的 **项目基准**（`config.yaml`）及本步中与用户交互的说明
- **落盘**：报告须写入对话并保存到文件（目录不存在则 `mkdir -p openspec/review`）
- **建议结构**：**概要**（文件数、增删行、问题分级统计）、**严重 / 重要 / 一般 / 建议**、**规范违规表**（对照项目基准）、**已审查文件列表**、**敏感信息扫描结果**、**与上次审查对比**（若有）、**修复建议**、**亮点**

**严重程度**：严重（安全漏洞、泄密、数据丢失、阻断性缺陷）→ 重要（规范/性能/设计明显问题）→ 一般（风格、命名）→ 建议（可选优化）。

**保存审查报告到 `openspec/review/`：**

- 文件名：`YYYY-MM-DD-HH-mm-<branch-name>-pipeline-review.md`
- 多轮审查时追加轮次后缀：`-round-2.md`、`-round-3.md`

### 步骤 11：[决策点 3] 审查结果处理

展示审查摘要（问题统计 + 报告路径），根据审查结果提供不同路径。该决策点属于附录定义的 **A 类：必须用户确认**；无论是 fix-review、直接修复还是 `继续后续流程`，都不得静默默认。

#### 11.a 发现严重或重要问题

使用 **AskQuestion tool**。

**选项：**

- `生成修复提案并应用` — 基于 CR 结果走完整 propose → apply → 归档修复 change → 重新审查
    - **触发**：决策点 3 选用该项
    - **执行**：按 `references/phase-3.1-fix-review.md` 全文。OpenSpec `fix-cr-`* change：提案与决策点 1 门禁 → Phase 2 实施 → 归档修复 change → 回到 **步骤 9–11** 重新审查
    - **循环**：**最多循环 3 轮**；第 3 轮后仍有严重问题则暂停并展示恢复指引
    - **边界**：须先经 `fix-cr-`* 制品与门禁，**禁止**无 change 直接改业务代码（与「直接修复并重新审查」不得混用）

- `直接修复并重新审查` — 不走提案流程，直接在当前代码上修复后重新审查
    - **触发**：决策点 3 选用该项（不走提案 / 新 change）
    - **执行**：依审查结论直接修改当前代码（不创建新 change）
    - **循环**：重新执行 **步骤 9–11**；**最多循环 3 轮**
    - **终止**：满 3 轮后仍有严重问题则强制暂停，展示恢复指引后退出

- `暂停流水线，手动调整后继续` — 展示恢复指引后退出；用户修复完后重新触发 pipeline 并传入 change 名称

- `继续后续流程` — 跳过修复，进入 Phase 5（完成后再进入 Phase 4）

- `终止流程` — 退出流水线

#### 11.b 仅有一般问题或建议

使用 **AskQuestion tool**。

**选项：**

- `继续后续流程` — 进入 Phase 5（完成后再进入 Phase 4）
- `生成修复提案并应用` — 基于 CR 结果走完整 propose → apply → 归档修复 change → 重新审查
- `暂停流水线，手动调整后继续` — 展示恢复指引后退出
- `终止流程` — 退出流水线

#### 11.c 审查无问题（0 个问题）

直接进入 Phase 5；Phase 5 完成后继续进入 Phase 4。
