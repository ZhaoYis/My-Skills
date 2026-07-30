# Vibe Coding 企业级落地实践分享

## 为什么现在要讲这个话题?

2025 年被称为 Vibe Coding 元年，2026 年则是「Spec-Driven Development（SDD，规范驱动开发）」被主流工具全面采纳的一年——GitHub Spec Kit、AWS Kiro、Claude Code、Cursor、OpenSpec、BMAD、Google Antigravity 等几乎所有主流 AI 编程工具都在 2026 年上线了自己的 SDD 方案。今天分享的核心不是「要不要用 AI 写代码」，而是「企业级场景下，如何用 AI 写出能长期维护的代码」。

---

## 一、什么是 Vibe Coding？和传统开发模式的对比

### 1.1 定义与起源
- Vibe Coding 一词由 Andrej Karpathy 在 2025 年初提出，描述的是「用自然语言向 AI Agent 提需求、全盘接受其产出、边看边改」的开发方式。
- Karpathy 本人明确将其定位为「适合周末抛弃型项目（throwaway weekend projects）」的玩法，从一开始就没有把它当作企业级方法论提出。
- 核心循环非常短：**Prompt → Generate → Iterate**（提示 → 生成 → 迭代），开发者的工作从「写代码」转变为「用自然语言表达意图」。

### 1.2 与传统开发模式的对比

| 维度 | 传统开发 | Vibe Coding |
|---|---|---|
| 核心产物 | 代码 + 文档同步产出 | 代码（对话记录不持久化） |
| 需求载体 | 需求文档 / PRD / 设计评审 | 聊天上下文（chat history） |
| 上下文延续性 | 文档版本化，长期可追溯 | 清空对话或超出上下文窗口后即丢失 |
| 质量保障 | Code Review + 测试用例 | 「看起来能跑就行」 |
| 适用规模 | 从个人到大型系统均可 | 单文件 / 小范围改动最佳 |
| 团队协作 | 基于文档与规范对齐 | 难以复用，「vibe」很难被评审 |

### 1.3 Vibe Coding 的真实价值（先肯定，再谈局限）
Vibe Coding 并非要被否定，它在以下场景中依然是效率最优解：
- 探索性原型、验证一个技术方案是否可行
- UI/交互的快速试错（视觉效果很难提前写成规范）
- 学习一个陌生 API「这玩意到底怎么用」的快速验证
- 一次性脚本、内部小工具

行业普遍共识是：**vibe coding 买来的是探索速度，SDD 买来的是生产可靠性**——二者不是对立关系，而是同一条流水线上的两个阶段。

---

## 二、Vibe Coding 存在的问题？SDD 是什么？企业级项目为什么需要 SDD？

### 2.1 Vibe Coding 在企业级场景下的失败模式：「三个月之墙」

社区总结出一个普遍现象，称为 **vibe climax（vibe 高潮之后的崩塌）**：项目上线大约三个月后开始出现：
- **上下文丢失**：清空对话或跨会话后，AI 忘记数据库 schema、编码规范等约定
- **需求漂移（requirement drift）**：多次迭代后实现已偏离最初意图，且没人能说清楚是什么时候开始偏的
- **反复重来（regenerate-from-scratch）循环**：小改动引发大范围返工
- **架构漂移**：AI 自作主张加入缓存层等「看似合理」的设计，几轮之后这个假设已经嵌入数据模型，移除成本极高
- **不可审查**：几百行未经文档化的 AI 生成代码，评审者无从下手，连行内注释都看不出背后的设计意图
- **多文件功能崩溃**：一旦改动涉及 5 个以上文件，AI 的上下文窗口就开始丢失约束条件

这些问题的根源并不是模型不够聪明，而是**从来没有一份写下来的规范**。

### 2.2 SDD 是什么

**Spec-Driven Development（规范驱动开发）**：把「规范（Spec）」作为核心产物（Source of Truth），代码变成从规范派生出的构建产物——类似 `.c` 文件编译成二进制文件的关系。业界的说法是「**the spec is the prompt**」。

典型 SDD 工作流分为四个阶段（不同工具叫法略有差异，但骨架一致）：

```
Specify（写需求）→ Plan/Design（技术设计）→ Task（任务拆解）→ Implement & Verify（实现与验证）
```

- **Specify**：写清楚要做什么、为什么做——需求、用户故事、验收标准，先不谈怎么实现
- **Plan**：把规范转成技术设计——架构、数据模型、接口、约束
- **Task**：拆解成可执行的任务清单
- **Implement & Verify**：AI 按任务清单实现，人审查的是「聚焦的变更」而非「上千行代码转储」

一个被广泛引用的说法（来自 GitHub 官方 SDD 文档）：*"你不再审查上千行的代码转储，而是审查解决特定问题的聚焦变更。"*

### 2.3 SDD vs TDD vs BDD

三者常被混淆，区别在于「什么是权威产物（canonical artifact）」：

| 方法论 | 权威产物 | 核心主张 |
|---|---|---|
| TDD | 测试用例 | 先写测试 |
| BDD | 业务语言描述的行为 | 先用业务语言写行为 |
| SDD | 完整规范（行为+架构+边界情况+约束） | 先写完整规范，再让 Agent 从规范产出代码、测试、文档 |

SDD 在某种程度上「吞并」了 BDD 的一部分——EARS 风格的验收标准本质上是 Gherkin（BDD 常用语法）更严格的表亲。

**EARS 语法**（Easy Approach to Requirements Syntax，源自罗尔斯·罗伊斯的安全关键系统需求写法）是让需求「AI 可读」的结构化写法，例如：

```
WHEN 用户点击"结算"按钮
  AND 购物车中有商品
  AND 支付方式有效
THE 系统 SHALL 处理支付
  AND 发送确认邮件
  AND 跳转至感谢页面
```

### 2.4 企业级项目为什么需要 SDD

1. **审计与追溯**：需求 → 规范 → 产品的清晰链路，每一段生成代码都能追溯到具体任务，这对审计、调试、新人 onboarding 至关重要
2. **跨会话 / 跨 Agent 的上下文延续**：规范被外部化到仓库里的版本化 Markdown 文件，而不是活在某次对话里
3. **可评审性**：团队评审的是 Spec 和 Plan，而不是等代码生成完了再去读「一坨 AI 输出」
4. **合规与监管行业**：金融、医疗等场景，「代码为什么这么写」必须有据可查
5. **规模化**：多团队、跨仓库协作时，规范可以作为团队之间的契约（一个团队拥有规范，其他团队只读引用）

行业已经出现一些量化案例（不同团队、不同项目背景，仅供参考，不代表普适结论）：Google 内部迁移项目通过 spec-driven 方式实现约 50% 时间缩减、80% 代码由 AI 生成；Airbnb 用六周完成原计划约 1.5 年的 3500 个测试文件迁移；也有反例——solo 开发者或需求频繁变化的小项目中，写 spec 的时间反而超过直接写代码本身。

**一句话结论**：SDD 更适合 10 人以上团队、有集成点的复杂系统、需要追溯的监管行业；对独立开发者、简单 CRUD、周末项目则是过度设计。**用 vibe 去探索，用 spec 去建造（Use the vibes to explore. Use specifications to build.）**——这是 Red Hat 工程团队总结的一句被广泛引用的原则。

---

### 2.5 SDD & TDD 工具选型

#### 2.5.1 SDD 开源套件

**OpenSpec**（[github.com/Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec)）
- 定位：轻量级 spec 层，"人类和 AI 在写代码前先在规范上对齐"
- 核心工作流命令：
  - `/opsx:explore` — 没想清楚要做什么时的「无压力思考伙伴」，先读代码、权衡方案
  - `/opsx:propose` — 生成变更提案，自动创建 `proposal.md`（为什么做/做什么变更）、`specs/`（需求与场景）、`design.md`（技术方案）、`tasks.md`（实现清单）
  - `/opsx:apply` — 让接入的编码 Agent（Cursor / Claude Code / Copilot 等）按任务清单逐条实现
  - `/opsx:archive` — 完成后归档变更，规范自动更新为最新状态
- 核心概念 **delta specs（增量规范）**：新增功能不需要重写整个产品规范,只需写清楚「这次变更增加/修改/删除了什么」
- 特点：无严格阶段门槛（no rigid phase gates）、可随时更新任意制品、支持 30+ 编码助手（Claude Code、Cursor、Codex、Copilot、OpenCode、Windsurf、Gemini CLI 等）
- 支持团队级「Stores」（Beta）：跨仓库共享规范，一个变更可以横跨 API、前端、共享库多个仓库
- 模型建议：适合搭配高推理模型（如 Opus 4.7 / Codex 5.5 级别），并保持上下文干净

**spec-kit**（[github.com/github/spec-kit](https://github.com/github/spec-kit)）
- GitHub 官方出品，四阶段流程更严格（phase gates 更硬），文档产出更全面
- 需要 Python 环境支撑 CLI
- 优点：流程完整、企业采纳度高、社区扩展目录成熟
- 缺点：相对厚重，仪式感强，不适合快速迭代场景

**OpenSpec vs spec-kit 一句话对比**：spec-kit 更全面但偏厚重（严格阶段门槛、Markdown 较多、需要 Python 环境）；OpenSpec 更轻量，允许自由迭代，更适合「brownfield」（存量项目）场景。两者并非二选一，企业可以根据项目阶段和团队规模选择，甚至在不同项目中并用。

#### 2.5.2 TDD 开源套件

**superpowers**（[github.com/obra/superpowers](https://github.com/obra/superpowers)）
- 定位：一套「Agentic Skills 框架 + 软件工程方法论」，核心目标是让 AI 从「输出能跑的代码」升级为「输出工程级代码」
- 作者 Jesse Vincent（obra）把它比喻为：给 AI 配一个「不摸鱼的高级工程师导师」，强制走完整开发流程
- 自动触发的核心技能链：
  1. **brainstorming** — 编码前介入，用提问反推出真正的规范，分段呈现设计供人确认
  2. **writing-plans** — 设计通过后，把工作拆解成 2–5 分钟粒度的小任务，每个任务都有精确文件路径、完整代码、验证步骤
  3. **using-git-worktrees** — 在新分支上创建隔离工作区，跑通项目基线测试
  4. **test-driven-development** — 强制 **红-绿-重构**（RED-GREEN-REFACTOR）循环：先写失败的测试 → 看它失败 → 写最小实现 → 看它通过 → 提交
  5. **subagent-driven-development / executing-plans** — 每个任务派发一个全新的子 Agent，两阶段审查（先查是否符合规范，再查代码质量），子 Agent 之间互不污染上下文
  6. **systematic-debugging** — 遇到 bug 时的系统化排查流程
- 平台无关：Claude Code、Cursor、Codex CLI/App、OpenCode、Gemini CLI、Factory Droid、GitHub Copilot CLI 等均支持，技能编写一次，跨工具复用
- 安装：`/plugin marketplace add obra/superpowers-marketplace` → `/plugin install superpowers@superpowers-marketplace`
- 适用边界：适合需要长期维护的生产代码、多文件重构、团队一致性场景；**不适合**一次性脚本或纯粹的快速探索（此时应该直接 vibe coding）

---

### 2.6 OpenSpec 和 superpowers 整合后的开发工作流

两者天然互补：**OpenSpec 回答"做什么"（规范/What），superpowers 回答"怎么做"（工程纪律/How）**。整合后的完整闭环如下：

```
1. /opsx:explore              —— 想法还模糊时，先和 AI 一起梳理思路、看代码、权衡方案
        ↓
2. /opsx:propose "功能描述"    —— 生成 proposal / specs / design / tasks 四件套
        ↓
3. 人工评审 spec 与 design      —— 团队在规范层面对齐，而不是等代码写完再评审
        ↓
4. superpowers: writing-plans  —— 基于 OpenSpec 的 tasks.md，细化为可执行的最小任务单元
        ↓
5. superpowers: TDD 循环        —— 每个任务红-绿-重构，subagent-driven-development 逐任务实现+双阶段审查
        ↓
6. /opsx:apply 逐任务落地 + 状态回写
        ↓
7. 人工验收 + 本地/CI 测试
        ↓
8. /opsx:archive               —— 规范归档更新，成为下一次变更的基线
```

**为什么要整合而不是二选一**：OpenSpec 解决的是「规范持久化、跨会话对齐」的问题，但它不强制代码实现过程中的工程纪律；superpowers 强制 TDD、子 Agent 隔离评审，但没有面向团队的规范存档与跨仓库协作能力。两者叠加，企业既拿到了「可审计的需求-规范-代码链路」，也拿到了「可信赖的实现质量」。

---

## 三、工具推荐

### 3.1 开发工具

#### 3.1.1 Code Agent 工具

| 工具 | 定位 | 关键特点 |
|---|---|---|
| **Claude Code** | Anthropic 官方 CLI/桌面 Agent | 深度集成 Claude 模型，插件生态（Marketplace）成熟，Skill / Hook / Subagent 原生支持最完善 |
| **Cursor** | IDE 原生 AI 编程环境 | 编辑器体验最好，适合重度 IDE 用户 |
| **OpenCode**（[github.com/anomalyco/opencode](https://github.com/anomalyco/opencode)） | 开源、终端优先的编码 Agent | MIT 协议，模型无关（75+ 模型供应商，可接 GitHub Copilot / ChatGPT Plus 账号或本地模型），Plan/Build 双模式（Tab 切换），Client/Server 架构，支持远程 SSH 使用 |

选型建议：企业统一技术栈优先选 Claude Code（插件生态 + Skill 体系最完善）；需要模型灵活切换或成本敏感团队可选 OpenCode；偏好沉浸式 IDE 体验选 Cursor。三者都可以接入同一套 OpenSpec + superpowers 工作流，方法论层面做到「工具无关」。

#### 3.1.2 Claude Code 必备套件

**官方 Marketplace 插件**

| 插件 | 作用 |
|---|---|
| **claude-md-management** | 对项目的 `CLAUDE.md`（相当于给 AI 看的项目说明书：架构、约定、坑点）进行审计、打分、自动更新，避免这份「越用越值钱」的文件腐化 |
| **jdtls-lsp** | 接入 Java Language Server，让 Agent 具备真正的语义级代码理解（跳转定义、查引用、类型检查），而非纯文本匹配 |
| **agent-browser** | 让 Agent 具备浏览器操作能力：读取无障碍树（accessibility tree）、点击、填表、执行 JS，用于让 Agent 自己验证前端改动是否生效 |
| **claude-hud** | 会话状态栏插件（作者 Jarrod Watts）：实时显示上下文占用百分比、当前工具调用、子 Agent 运行状态、任务清单完成度，避免「聊到一半突然撞上下文上限」 |

**开源生态项目**

| 项目 | 作用 |
|---|---|
| **mcp-server-mysql**（[github.com/benborla/mcp-server-mysql](https://github.com/benborla/mcp-server-mysql)） | 通过 MCP 协议让 Agent 直接查询/操作 MySQL 数据库，用于数据校验、生成迁移脚本、辅助排查数据问题 |
| **context7**（[github.com/upstash/context7](https://github.com/upstash/context7)） | 实时拉取最新的第三方库/框架官方文档注入上下文，解决大模型训练数据滞后、API 记忆过时导致的「幻觉 API」问题 |
| **ui-ux-pro-max**（[github.com/nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)） | 前端设计规范类 Skill，约束 Agent 产出的界面遵循专业设计规范（间距、层级、排版、色彩），避免典型「AI 生成风」的粗糙界面 |
| **Playwright MCP**（[github.com/microsoft/playwright](https://github.com/microsoft/playwright)） | 官方浏览器自动化协议接入，让 Agent 能编写并运行端到端测试、截图核对 UI、模拟真实用户操作流 |

> 实践建议：`context7` + `mcp-server-mysql` 解决「Agent 对外部世界认知过时」的问题；`agent-browser` + `Playwright MCP` 解决「Agent 写完前端代码却不知道效果对不对」的问题；`claude-hud` + `claude-md-management` 解决「长会话 / 长期项目里上下文管理失控」的问题。三组工具分别对应三类企业级痛点。

### 3.2 AI 终端工具

**cmux**（[github.com/manaflow-ai/cmux](https://github.com/manaflow-ai/cmux)）
- 定位：基于 Ghostty 渲染引擎的原生 macOS 终端，专为「同时跑多个 AI 编码 Agent」设计
- 解决的核心痛点：原生终端里跑多个 Claude Code / Codex / OpenCode 会话时，系统通知只会显示「Claude 在等你输入」这类无上下文提示，标签页一多根本分不清谁在等谁
- 核心能力：
  - 垂直标签 + 分屏，侧边栏实时显示 git 分支、关联 PR 状态、监听端口、最新通知内容
  - 通知环：Agent 等待输入时面板出现醒目提示环，配合桌面通知和未读徽标
  - 内置可编程浏览器面板（移植自 agent-browser），Agent 可以直接在终端内验证本地开发服务器的 UI 效果
  - 支持子 Agent / 队友模式（Claude Code Teams）自动展开为独立面板，而不是隐藏的后台进程
  - 支持 SSH 远程工作区，可原生 attach 到远程 tmux 会话
- 与 tmux 的关系：不是替代，是互补——tmux 提供 19 年验证过的稳定性和跨平台 session 持久化，cmux 提供面向 「AI Agent 时代」的可视化通知与编排体验；生产实践中常见组合是 Claude Code 的 Agent Team 在 tmux 之上跑，cmux 负责可视化管理这些 Agent 状态
- 局限：目前仅支持 macOS

---

## 四、全栈开发实践指南（全流程演示）

> 以下按真实企业项目的一次「新增功能」为例，串联本文提到的方法论与工具

### 4.1 需求拆解
- 用 `/opsx:explore` 与 Agent 对话，把一句话需求（如「给系统加一个深色模式」「给订单模块加导出功能」）逐步问清楚边界、非目标（non-goals）、约束条件
- 明确后用 `/opsx:propose <功能名>` 生成 `proposal.md`（为什么做）+ `specs/`（需求与场景，建议用 EARS 语法写关键验收标准）+ `design.md`（技术方案）+ `tasks.md`（任务清单）
- 需求评审环节：团队评审 Spec 而非代码，评审重点是「场景是否遗漏」「边界条件是否清晰」「和现有系统的接口约束是否明确」
- 用 `context7` 确认涉及的第三方库/框架的最新 API，避免设计阶段就基于过时假设

### 4.2 原型设计
- 涉及界面的需求，接入 `ui-ux-pro-max` 一类的设计规范 Skill，让 Agent 产出的界面直接对齐专业设计标准，而不是「一眼假」的 AI 味界面
- 复杂交互建议先做一轮纯 vibe coding 的可视化原型（不接 SDD 流程），快速试错交互细节；确认方向后再把结论回写进 `design.md`，正式进入 SDD 主干流程
- 涉及数据结构变更时，配合 `mcp-server-mysql` 让 Agent 直接读取现有表结构，避免凭空猜测 schema

### 4.3 编码实现 & 前端调试
- 基于 `tasks.md`，用 superpowers 的 `writing-plans` 进一步拆解为 2–5 分钟粒度的可执行任务
- 每个任务严格走 TDD 红-绿-重构循环；启用 `subagent-driven-development`，每个任务派发独立子 Agent 实现 + 两阶段审查（规范符合性 → 代码质量），避免长会话上下文污染导致的质量滑坡
- 前端改动完成后，用 `agent-browser` 或 `Playwright MCP` 让 Agent 自己打开本地开发服务器截图核对，或跑一遍端到端测试，而不是让人工肉眼逐个页面点检
- 全程用 `claude-hud` 监控上下文占用，接近上限前主动 `/compact`，避免中途丢失关键约束

### 4.4 其他实践要点
- **并行开发**：多个功能/多个 Agent 并行跑时，用 `cmux`（或团队里的等效终端方案）统一管理通知与状态，避免「Agent 在等你但你没看到」
- **项目记忆资产化**：每次踩坑、每条编码规范都沉淀进 `CLAUDE.md`，用 `claude-md-management` 定期审计打分，防止这份文件随项目膨胀而失控
- **验收与归档**：任务完成、测试通过后执行 `/opsx:apply` 状态回写 + `/opsx:archive` 归档，规范库始终反映系统当前真实状态，成为下一次迭代和新人 onboarding 的入口文档
- **文档与代码同步**：SDD 流程下文档不再是「事后补」，规范本身就是文档，天然与代码保持同步

---

## 五、注意事项 & 避坑指南

1. **SDD 不是银弹，警惕「Waterfall 重生」批评**：业内确实存在质疑声音，认为 SDD 是给瀑布模型穿了件新衣服，重走了 Agile 想解决的老路。企业落地时不要把 SDD 做成新的重流程负担——OpenSpec 这类轻量工具的初衷正是规避 spec-kit 式的强阶段门槛。
2. **不要用大炮打蚊子**：独立开发者、5 人以下小团队、需求高频变化的项目，SDD 的规范撰写成本可能反而超过直接写代码。判断标准很简单——这段代码是否需要长期维护、是否涉及多人协作、是否需要审计追溯，符合任一条再上 SDD 全流程。
3. **警惕「原型偷偷变生产基座」**：最大的风险不是 vibe coding 本身，而是一个周二下午随手搭的原型，在无人决策的情况下悄悄成为了生产功能的地基。团队应该明确一条红线：任何要上线的功能，必须先补上 Spec 才能进入生产分支。
4. **模型选择影响 SDD 效果**：规范撰写与实现规划阶段建议使用高推理能力模型，推理能力不足的模型难以产出高质量、无歧义的规范，反而会放大后续实现阶段的偏差。
5. **保持上下文卫生**：开始实现前清空/整理上下文窗口，一个会话只聚焦一个变更，避免多任务交叉污染导致 Agent 判断力下降。
6. **人的角色在迁移，不是被取代**：开发者的核心竞争力正从「写代码语法」转向「需求工程与规范验证能力」——这是一个真实的能力结构变化，团队培训和招聘标准要跟上。
7. **不要盲目自动执行（YOLO 模式）**：数据库变更、生产部署等高风险操作，务必保留人工审批节点，MCP 工具授权范围要做最小化配置。
8. **代码评审方式需要转型**：把评审重心从「读代码」前移到「读 Spec 和 Design」，同时保留对最终代码的抽查机制，两者缺一不可。
9. **警惕过度炫技的插件栈**：并不是插件、Skill、MCP 装得越多越好，每多接入一个工具都会消耗上下文预算，建议按本文「三组工具对应三类痛点」的思路做减法配置，而不是全家桶式堆叠。
10. **一句话记住核心原则**：**Use the vibes to explore. Use specifications to build.**（用 vibe 去探索，用规范去建造。）

---

## 参考资料（延伸阅读）

- Towards Data Science, *From Vibe Coding to Spec-Driven Development* — https://towardsdatascience.com/from-vibe-coding-to-spec-driven-development/
- BCMS, *Spec-Driven Development (SDD): The Definitive 2026 Guide* — https://thebcms.com/blog/spec-driven-development
- Augment Code, *Vibe Coding vs Spec-Driven Development (2026)* — https://www.augmentcode.com/guides/vibe-coding-vs-spec-driven-development
- InfoWorld, *Vibe coding or spec-driven development? How to choose* — https://www.infoworld.com/article/4166817/vibe-coding-or-spec-driven-development-how-to-choose.html
- Turing Post, *Spec-Driven Development vs Vibe Coding: Tools & Guide (2026)* — https://www.turingpost.com/p/sdd
- byteiota, *Spec-Driven Development Kills 'Vibe Coding'* — https://byteiota.com/spec-driven-development-kills-vibe-coding-march-2026/
- GitHub, Fission-AI/OpenSpec — https://github.com/Fission-AI/OpenSpec/
- GitHub, github/spec-kit — https://github.com/github/spec-kit
- GitHub, obra/superpowers — https://github.com/obra/superpowers
- GitHub, anomalyco/opencode — https://github.com/anomalyco/opencode
- GitHub, manaflow-ai/cmux — https://github.com/manaflow-ai/cmux
- GitHub, benborla/mcp-server-mysql — https://github.com/benborla/mcp-server-mysql
- GitHub, upstash/context7 — https://github.com/upstash/context7
- GitHub, nextlevelbuilder/ui-ux-pro-max-skill — https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
- GitHub, microsoft/playwright — https://github.com/microsoft/playwright
- SAP Community, *How I teach Claude Code to work my way*（claude-hud / claude-md-management 实践）— https://community.sap.com/t5/artificial-intelligence-blogs-posts/how-i-teach-claude-code-to-work-my-way/ba-p/14349299

---

*注：文中涉及的效率提升数据（如 Google、Airbnb 案例）来自不同团队的个案报告，具体收益因项目规模、团队成熟度而异，建议在企业内部先做小范围试点验证后再规模化推广。*
