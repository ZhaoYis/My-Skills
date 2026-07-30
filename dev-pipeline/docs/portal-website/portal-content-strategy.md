# opsx-dev-pipeline 门户网站内容策略

> 基于功能清单的 grilling 评审结果，将"功能描述"翻译为"价值主张"，按用户心智重新组织结构与文案。

---

## 一、目标用户画像 & 核心价值陈述

### 🎯 首要用户：技术负责人 / Engineering Manager

> 团队在用 AI 编程工具提效，但你发现 AI 的代码跳过测试、忽略规范、甚至提交了密钥文件。你需要在"速度"和"质量"之间建立可控的平衡。

**核心价值：一套门禁体系，让 AI 在团队规范内工作，每次变更可追溯、可审查、可回滚。**

门户的所有文案、叙事和案例优先对这个角色说话。

### 次要用户（仅供参考，不主导门户设计）

| 用户 | 一句话价值 |
|---|---|
| 个人开发者 | 一个人干全栈，AI 按流程推进，每个决策你确认 |
| 开源维护者 | 贡献者 PR 前 AI 已按你的规范完成第一轮审查

---

## 二、定位语句（Hero Section）

### 主标题（已选定）

**"让 AI 写出符合团队规范的代码，而不是写出能跑的代码。"**

### 副标题

> opsx-dev-pipeline 是一个开源的 AI 研发流水线 CLI——为你的团队初始化完整的提案→实施→审查→测试→归档→交付门禁体系，让 Claude Code、Cursor 或 Codex 在你的规则下工作，而不是每个成员各凭 prompt 发挥。

### 替代短版

> 给团队的 AI 编程助手装上规范、门禁和交付流程。30 秒初始化，7 个阶段护航。

### 竞品定位：vibe coding 的对立面

我们的竞品**不是一个工具，而是一种状态**——团队在用 AI 写代码，但没有流程、没有规范、没有追溯。业界叫它 **vibe coding**：

> "告诉 AI 你想要什么，看它生成，差不多就合并。"

vibe coding 的问题不在于代码质量差——在于**你无法向他人、向未来的自己解释这段代码为什么存在、为什么这样写、测试过没有**。

opsx-dev-pipeline 是 vibe coding 的反面。它不阻止 AI 写代码的速度，但要求 AI **先写提案、通过门禁、留下记录**，才能合并。它不是让 AI 变慢——是让 AI 的产出可以被团队信任。

---

## 三、"之前 vs 之后"叙事（核心说服力）

### 之前：vibe coding

```
团队成员各自用 AI → 告诉 AI 想要什么 → 代码生成 →
  → 差不多就合并 → 测试？跳过。设计文档？没写。
  → Code review 变成猜谜：为什么要改这个模块？
  → 三个月前的变更没人记得为什么做
  → 新人 PR 把 .env 提交了，没人注意到
  → 你说"下次注意"→ 下次还是发生
```

**这不是工具问题，是流程缺失。** vibe coding 的本质是"快但不可靠"——代码写出来了，但团队无法解释、无法追溯、无法保证质量。

### 有了 opsx-dev-pipeline 后

```
npx opsx-dev-pipeline init --tool claude --stack backend --yes
  ↓
/opsx-dev-pipeline "给 Todo 加个 dueDate 字段"
  ↓
Phase 0  预检：环境就绪，依赖齐全
Phase 1  提案：AI 自动写 proposal + specs + tasks，你确认
Phase 2  实施：AI 按 tasks.md 逐条实现，勾选完成
Phase 3  审查：AI 自查 5 个维度 + 修复循环（上限 3 轮）
Phase 4  单测：自动运行测试，失败则修复重试
Phase 5  归档：delta spec 合并到主规范，变更永不失忆
Phase 6  交付：提交 → 推送 → 合并 → 打标签，敏感文件自动扫描
  ↓
变更上线。Why → What → How → Test → Review 链路永久可追溯。
团队里每个人、每次变更，都走同一套标准。
```

**vibe coding 给你速度。opsx-dev-pipeline 让速度可以被信任。**

---

## 四、技术选型与部署

| 决策 | 结论 |
|---|---|
| **代码位置** | `dev-pipeline` 仓库内的 `website/` 目录 |
| **框架** | Next.js (App Router) |
| **部署** | Vercel 自动化部署（Git push → 自动构建发布） |
| **内容更新** | 版本变更时手动调整，不依赖自动化同步 |
| **域名** | 待定 |

---

## 五、门户网站内容结构（重排序）

```
Section 1  Hero          — 5 秒讲清你是谁
Section 2  Problem       — 没有你时有多痛
Section 3  How It Works  — 7 阶段流水线可视化（真实场景）
Section 4  Core Power    — 流水线状态机（核心差异化）
Section 5  Spec-Driven   — 规范驱动 vs 提示词驱动
Section 6  AI Tools      — 三工具统一适配
Section 7  Safety        — 安全门禁防线
Section 8  Quick Start   — 一条命令上手
Section 9  Numbers       — 技术指标
Section 10 FAQ           — 常见问题
Section 11 CTA           — 立即开始
```

---

## 六、各板块文案

### Section 2 — Problem（痛点）

**标题：你的团队在用 AI 编程，但你管不了每个人怎么用它。**

| 团队层面的问题 | 根因 |
|---|---|
| 代码风格割裂，A 用 AI 生成的代码和 B 的完全两个路子 | 没有统一的 AI 使用规范——各凭 prompt 发挥 |
| Code review 越来越像考古：谁改的？为什么改？ | 变更没有 proposal，只有代码 diff |
| 新人用 AI 写代码很快，但测试覆盖率在下降 | 没有强制门禁——AI 不知道测试是"必须"而非"建议" |
| 三个月前的功能变更，没人记得设计决策 | 设计文档从未更新，决策散落在聊天记录里 |
| 敏感文件（.env、密钥）某天出现在仓库里 | 交付前没有自动安全检查 |
| 你说"下次注意"，下次还是发生 | 口头约定无法规模化——你需要的是工程约束而非团队纪律 |

---

### Section 3 — How It Works（可视化工作流）

**标题：7 个阶段，一条流水线，从需求到上线**

**形式：CSS 动画 / Lottie / 渐进式时间线**（暂用动画模拟，后续替换为真实录屏）

以真实场景为例："给 Todo 应用添加 dueDate 字段"（前后端全栈变更）。

**动画设计建议：** 7 个阶段做成一个横向或纵向滚动的进度条，自动从 Phase 0 推进到 Phase 6，每个卡片在激活时高亮、展示关键动作、然后进入下一阶段。终端风格的命令行动画穿插在卡片之间，模拟 `npx`、`git`、`npm test` 等命令的执行。顶部放一个计时器显示 "< 2 分钟完成全流程"。

```
┌─────────────────────────────────────────────────────────┐
│  Phase 0  预检入口                                      │
│  ✓ openspec 已安装  ✓ git 仓库正常  ✓ 环境就绪          │
├─────────────────────────────────────────────────────────┤
│  Phase 1  提案 (Propose)                                │
│  AI 生成: proposal.md (Why) + spec.md (What)            │
│          + design.md (How) + tasks.md (Checklist)       │
│  决策点: 你确认提案 → 进入实施                            │
├─────────────────────────────────────────────────────────┤
│  Phase 2  实施 (Apply)                                  │
│  AI 逐条完成 tasks.md 中的 checkbox                     │
│  □ 1.1 后端 Todo model 新增 dueDate 字段               │
│  □ 1.2 API schema 更新                                 │
│  □ 2.1 前端 AddTodo 组件新增日期选择器                  │
│  □ 2.2 TodoList 组件渲染 dueDate                        │
│  决策点: 确认实施结果 → 进入审查                          │
├─────────────────────────────────────────────────────────┤
│  Phase 3  审查 (Review)                                 │
│  AI 按 5 维度自查: 正确性/安全/性能/可维护性/规范一致性    │
│  发现问题 → 修复 → 再审 (最多 3 轮)                      │
│  决策点: 审查通过 → 进入单测                              │
├─────────────────────────────────────────────────────────┤
│  Phase 4  单测门禁                                       │
│  自动 npm test → 后端测试 ✓  前端测试 ✓                  │
│  失败 → 修复 → 重试 (最多 3 次)                          │
├─────────────────────────────────────────────────────────┤
│  Phase 5  归档 (Archive)                                │
│  ✓ delta spec 合并到 openspec/specs/                     │
│  ✓ 变更记录永久留存                                     │
│  ✓ 敏感文件扫描 → 无风险                                 │
│  决策点: 选择交付方式 (仅推送 / 合并到主分支)             │
├─────────────────────────────────────────────────────────┤
│  Phase 6  交付 (Merge & Push)                            │
│  git commit → push source → merge to main → push main    │
│  → 可选: 打标签、清理源分支                              │
│  流水线完成 ✓                                            │
└─────────────────────────────────────────────────────────┘
```

**每一步都有状态记录。中断后从断点恢复，不是从头开始。**

---

### Section 4 — Core Power（流水线状态机）

**标题：统一团队的标准，而不是依赖每个人的自律。**

大多数 AI 工作流是"建议式"的——AI 建议写测试，成员可以跳过。规范靠自觉，质量靠信任。

opsx-dev-pipeline 内置一个**可持久化的流水线状态机**，把团队规范变成系统约束：

| 能力 | 它解决的问题 |
|---|---|
| **门禁校验** | 没通过测试？状态机拒绝你进入 Phase 5 |
| **状态持久化** | 流水线中断了？恢复时精确回到断点 |
| **原子写入** | 崩溃不丢数据——写临时文件 + rename，无损坏窗口 |
| **重试上限** | 审查修复 3 轮还不过？自动暂停，呼叫人工介入 |
| **决策审计** | 每个关键决定（是否合并、合并策略、是否跳过测试）永久记录 |
| **事实校验** | 恢复时交叉核对 Git 分支 + 文件系统 + OpenSpec 状态 → 不一致就暂停 |

**这不是 AI 的"建议"，这是工程的"约束"。这正是 AI 编码时代最稀缺的东西。**

---

### Section 5 — Spec-Driven（规范驱动开发）

**标题：先对齐"做什么"，再让 AI 决定"怎么做"**

| 方式 | Prompt-Driven | **Spec-Driven（opsx-dev-pipeline）** |
|---|---|---|
| 输入 | 一段话 | proposal.md + spec.md + design.md + tasks.md |
| AI 理解 | "我觉得你想要..." | "根据 spec 第 3 条的 Scenario..." |
| 验证 | 你肉眼对比 | `openspec validate` 自动校验 |
| 追溯 | Prompt 淹没在聊天记录里 | 每次变更的完整制品链永久存档 |
| 恢复 | 重新描述一遍 | 打开 archived change，一切都在 |

**规范驱动开发的核心理念：让规范成为 AI 和人类之间的"合同"。AI 按合同交付，你按合同验收。**

**Delta Specs — 精确追踪变更：**

```
## ADDED Requirements       ← 新增能力
### Requirement: Todo 支持到期日

## MODIFIED Requirements    ← 变更已有行为（保留完整历史）
### Requirement: Todo 创建接口

## REMOVED Requirements      ← 废弃功能 + 迁移指引
### Requirement: 旧版导出接口
**Migration**: 使用 /api/v2/export
```

归档时 Delta Specs 自动合并到主规范——**你的规范文档永远和代码一致。**

---

### Section 6 — AI Tools（三工具统一适配）

**标题：选你喜欢的 AI 工具，我们适配它。**

| 工具 | 你的体验 |
|---|---|
| **Claude Code** | `/opsx-dev-pipeline` 触发全流程，Skill 原生集成 |
| **Cursor** | 按需加载规则，不影响日常编码，需要时召唤 |
| **Codex (OpenAI)** | 完整 agent 配置，prompt 入口一键启动 |

一套模板、一致的门禁逻辑、各自的原生体验。当前支持 3 个工具，适配器架构可扩展。

```
npx opsx-dev-pipeline list-tools     # 查看支持的工具
npx opsx-dev-pipeline list-tools --json  # CI/脚本消费
```

---

### Section 7 — Safety（安全门禁）

**标题：交付之前，安全检查不会沉默。**

| 防线 | 行为 |
|---|---|
| **敏感文件扫描** | `.env`、`*.key`、`*.pem`、`*.p12`、`credentials.json`、私钥块 — 自动检测并警告 |
| **禁止危险 Git 操作** | `git add -A`、`git push --force`、`git branch -D` — 在流水线中全部禁用 |
| **分步确认** | commit / push / merge / 删分支 / 打标签 — 各自独立确认，不能一键跳过 |
| **合并冲突协议** | 逐文件选择策略，禁止 `--ours` / `--theirs` 全局覆盖 |
| **Fast-forward Only** | 分叉时暂停，不自动 rebase，不静默覆盖 |
| **Pre-commit Hook 尊重** | Hook 失败必须修复或显式确认 `--no-verify` |

---

### Section 8 — Quick Start（快速上手）

**标题：30 秒，从零到 AI-Ready。**

```bash
# 前置条件：Node.js 20+、OpenSpec CLI
npm install -g @fission-ai/openspec@latest

# 一条命令初始化
npx opsx-dev-pipeline@latest init --tool claude --stack backend --yes

# 在 Claude Code 中开始第一个变更
/opsx-dev-pipeline "给 Todo 应用添加 dueDate 字段"
```

**支持的模式：**

| 场景 | 命令 |
|---|---|
| 交互式安装 | `npx opsx-dev-pipeline init` |
| CI/CD 静默安装 | `npx opsx-dev-pipeline init --tool claude --stack backend --yes` |
| 预览安装计划 | `npx opsx-dev-pipeline init --tool claude --stack frontend --yes --dry-run` |
| 升级到最新模板 | `npx opsx-dev-pipeline upgrade --yes` |
| 诊断安装状态 | `npx opsx-dev-pipeline doctor` |
| 清理卸载 | `npx opsx-dev-pipeline uninstall --yes` |

---

### Section 9 — Numbers（数据指标）

| 指标 | 数值 |
|---|---|
| 初始化耗时 | **< 30 秒** |
| 流水线覆盖阶段 | **7 个 (Phase 0-6)** |
| 支持 AI 工具 | **3 个** (Claude Code / Cursor / Codex) |
| 内置技术栈模板 | **2 套** (React+Vite / Spring Boot) |
| 自动化脚本 | **10 个** (含持久化状态机) |
| 安全防线 | **8 道** (敏感文件→禁止危险操作→分步确认→...→回滚保护) |
| 运行时依赖 | **1 个** (Node.js 20+) |
| 开源协议 | **MIT** |

---

### Section 11 — CTA（行动号召）

**标题：让你的团队 AI 编码从"各凭本事"变成"统一标准"。**

```bash
npx opsx-dev-pipeline@latest init
```

- 📖 [完整文档](https://github.com/ZhaoYis/My-Skills/tree/main/dev-pipeline)
- 🐛 [反馈 & 问题 → GitHub Issues](https://github.com/ZhaoYis/My-Skills/issues)
- ⭐ 开源 & MIT 协议

---

### Section 11 — FAQ（常见问题）

**标题：你可能想问的，都在这里。**

---

#### 入门与前提

**Q: 我有一支 5-10 人的团队，每个人用不同的 AI 工具。这个能统一管理吗？**

能。opsx-dev-pipeline 的核心价值就是**统一流程**。初始化后，团队共享同一套 OpenSpec 规范、同一个流水线状态机、同一组门禁规则。无论成员用的是 Claude Code、Cursor 还是 Codex，他们面对的是同一套提案→审查→测试→归档的门禁。你作为技术负责人，可以在 `openspec/config.yaml` 和 Phase reference 文件中定义团队的规范标准。

目前每个项目绑定一个主 AI 工具；混合工具团队可联系社区讨论方案。

---

**Q: 我需要安装什么才能用？**

两个东西：Node.js 20+ 和 OpenSpec CLI。然后一条命令就完成初始化：

```bash
npm install -g @fission-ai/openspec@latest
npx opsx-dev-pipeline@latest init
```

初始化后，流水线的所有脚本运行在 Node.js 上，不再需要额外依赖。

---

**Q: 我已经有一个项目了，还能用吗？**

能。`opsx-dev-pipeline init` 可以安装到任意已有项目目录。已有文件默认不会被覆盖（除非你用 `--force`），`.gitignore` 这类可追加文件会智能合并。

---

**Q: 适合什么规模的项目和团队？**

- **个人项目**：有提案→归档的完整追溯，一个月后也能看懂自己当时的决策
- **小团队（2-10 人）**：统一 AI 使用规范，减少 code review 中的风格争论
- **开源项目**：贡献者提交 PR 前，AI 已按你的规范完成第一轮审查

---

#### AI 工具

**Q: 我必须用 Claude Code 吗？Cursor 和 Codex 能用吗？**

三个都支持。初始化时选你常用的：

```bash
npx opsx-dev-pipeline init --tool claude   # Claude Code
npx opsx-dev-pipeline init --tool cursor  # Cursor
npx opsx-dev-pipeline init --tool codex   # Codex (OpenAI)
```

一套流水线逻辑，三种工具的原生体验。后续新增 AI 工具，升级 CLI 版本即可获得。

---

**Q: 我已经装了 Claude Code 的 pipeline，团队里有同事用 Cursor，他需要重新配置吗？**

每个项目目前绑定一个 AI 工具。如果团队混合使用多种工具，可以按子项目分别初始化。我们正在设计多工具共存方案。

---

**Q: 这和直接在 Claude Code 里写 prompt 有什么区别？**

在聊天框里写 prompt，AI 只看到你当前的问题。它不知道你的项目规范、不记得上次变更改了什么、也不会主动跑测试。

opsx-dev-pipeline 给 AI 装了一套工程框架：它知道要先写 proposal 对齐需求、知道 spec 在哪里、知道变更完要跑测试、知道敏感文件不能提交。**不是更好的 prompt，而是让 prompt 跑在一个有约束的系统里。**

---

#### 流水线工作流

**Q: 7 个 Phase 是强制的吗？我能跳过某个阶段吗？**

部分可以。Phase 3（审查）和 Phase 4（单测）都有"跳过"选项，但每次跳过都是一次显式决策，会被记录在状态文件里。Phase 1（提案）和 Phase 5（归档）不可跳过——前者是"为什么做"的根基，后者是"做完了别失忆"的保障。

---

**Q: 流水线跑一半断了怎么办？**

这正是状态机存在的原因。每次中断都会写 `openspec/.pipeline-state/<change>.json`。重新触发流水线时，它会读取状态文件，交叉校验 Git 分支和文件系统的事实，然后从断点继续。你不需要从头来过。

---

**Q: 审查修复循环最多 3 轮——为什么是 3 轮？**

3 轮后还没通过，通常意味着需求本身有问题或者方案需要重新设计，而不是"再改一行"。此时强制暂停、呼叫人工介入，比无限循环更高效。如果你确实需要更多轮次，可以手动重置计数继续。

---

**Q: 我能自定义每个 Phase 的行为吗？**

可以。每个 Phase 的详细行为定义在 `references/` 目录下的 Markdown 文件中，你可以直接编辑。`openspec/config.yaml` 中的 `rules` 和 `stack.verify` 字段可以配置项目的测试命令、验证脚本和构建步骤。更深度定制通过 `sync` 和 `upgrade` 机制管理。

---

#### 技术栈

**Q: 只有 React 和 Spring Boot 两种栈？我能用 Vue 或 Django 吗？**

当前内置两套模板。但它们本质上是 OpenSpec schema + 规范模板 + 上下文配置的组合。你可以：

1. 选择最接近的内置栈（比如用 `backend` 覆盖大部分 Java/API 场景）
2. 编辑 `openspec/config.yaml` 中的 `context` 和 `rules` 适配你的实际技术栈
3. 自定义 schema 模板来匹配你的框架约定

我们计划在未来支持社区贡献的栈模板。

---

**Q: 我同时有前端和后端，选哪个？**

`init` 时只能选一个主栈，但 `openspec/config.yaml` 支持多栈配置。初始化后再手动添加第二个栈的 schema 和 config，`doctor --stack` 可以校验多服务配置的完整性。test-pipeline 目录中的 `fullstack-todo` 样例就是一个同时包含 Express 后端和 React 前端的项目。

---

#### 安全与信任

**Q: 流水线会自动拒绝哪些操作？**

- `git add -A`（全量暂存）— 必须逐文件显式 `git add`
- `git push --force`（强制推送）— 直接禁用
- `git branch -D`（强制删分支）— 只允许 `-d`（安全删除）
- 敏感文件提交 — `.env`、`*.key`、`*.pem`、`credentials.json` 等会被自动检测并警告
- 合并时的全局 `--ours` / `--theirs` — 必须逐文件解决冲突

---

**Q: 如果我确实需要 force push 怎么办？**

在流水线之外手动操作。opsx-dev-pipeline 的 Phase 6 不会替你执行这些操作，但也不会阻止你在终端里自己执行。它只是确保 AI Agent 不会在自动化流程中执行破坏性命令。

---

**Q: opsx-dev-pipeline 会上传我的代码吗？**

不会。所有逻辑在你本地运行，状态文件存在你的 Git 仓库里。不依赖任何远程服务，不需要 API Key，不发送任何数据到外部。

---

#### 与其他方案对比

**Q: 和裸用 OpenSpec 有什么区别？**

OpenSpec 提供了核心的 spec 管理和 CLI 工具。opsx-dev-pipeline 在它之上构建了：

- **完整的 7 阶段门禁流程**（OpenSpec 本身不强制 Phase 顺序和决策点）
- **持久化状态机**（OpenSpec 不记录"流水线跑到哪了"）
- **AI Tool 适配**（OpenSpec 需要你手动配置 skills/commands，pipeline 一条命令完成）
- **安全交付门禁**（敏感文件检测、Git 操作约束是 pipeline 独有的）

可以理解为：OpenSpec 是引擎，opsx-dev-pipeline 是装好方向盘、刹车和安全带的整车。

---

**Q: 和 GitHub Actions / CI 流水线有什么区别？**

CI 运行在 push 之后（事后检查）。opsx-dev-pipeline 运行在 AI 编码的过程中（事中约束）。

两者互补：用 pipeline 约束 AI 的开发过程，用 CI 做最后的自动化验证。Phase 6 交付阶段的 commit 和 push 可以触发你的 CI 流水线。

---

**Q: 这能替代 code review 吗？**

不能，也不应该。Phase 3 的 AI 审查是**第一轮自动筛查**——发现明显问题、检查规范一致性、标记潜在风险。它让人工 reviewer 可以专注于架构决策和业务逻辑，而不是"变量命名不规范"这种机械问题。

---

#### 许可与未来

**Q: 开源协议？商业使用有限制吗？**

MIT 协议。商业使用、私有部署、二次开发均无限制。

---

**Q: 路线图是什么？**

当前的重点方向：

- **bash → Node.js 迁移**：全脚本统一为 `.mjs`，消除双语言维护负担，原生跨平台
- **更多 AI 工具适配**：按社区需求扩展
- **社区栈模板**：允许贡献和发布自定义技术栈模板
- **智能学习引擎 (Hermes)**：根据历史流水线数据优化门禁策略

欢迎在 [GitHub Issues](https://github.com/ZhaoYis/My-Skills/issues) 提出你的需求。

---

**Q: 遇到问题去哪求助？**

- [GitHub Issues](https://github.com/ZhaoYis/My-Skills/issues) — Bug 和功能请求
- `opsx-dev-pipeline doctor --json` — 自检诊断，把输出贴在 Issue 里
- 项目文档在 [GitHub](https://github.com/ZhaoYis/My-Skills/tree/main/dev-pipeline)

---

## 七、内容设计原则总结

| 原则 | 说明 |
|---|---|
| **先说"为什么"再说"是什么"** | 每个板块先建立痛点或场景，再展示功能如何解决 |
| **用场景代替术语** | "给 Todo 加 dueDate" 比 "全流程门禁式研发流水线"更好懂 |
| **删掉实现细节** | Handlebars、Zod、CAC、Biome、退出码编号 → 放 Developer Docs |
| **每个数字都要有意义** | "30 秒初始化" > "19 个测试文件" |
| **超级lative 要有依据** | 去掉"业界首创"，用具体行为描述差异 |
| **CTA 可见且可执行** | 每个页面都应该有一个能跑的 `npx` 命令 |

---

## 八、不建议在门户网站上展示的内容

以下内容从 `feature-inventory.md` 中**移除**，适合放在 Developer Docs 而非门户：

- Handlebars 模板引擎实现细节
- Bundle 模式资源管理机制
- Appendable 文件策略
- Zod Schema 校验机制
- CAC CLI 框架选择
- Biome 代码规范
- TypeScript Strict 配置
- 具体退出码分配（1-6, 10-12）
- Hermes 预览特性（未上线功能不应出现在门户）
- 测试覆盖的具体数字（19 文件 / 97 测试）

---

## 九、流量策略与定位

门户的定位是 **"体面的落地页"**，而非增长引擎。

- **自然流量来源**：npm 搜索、GitHub README、技术博客、社区分享
- **门户角色**：当有人通过以上渠道发现项目时，门户提供完整的产品介绍、信任建立和上手引导
- **不依赖**：SEO、SEM、社交媒体病毒传播
- **成功标准**：访问者看完门户后，知道这是什么、适不适合自己、如何开始

---

## 十、门户页面建议结构

```
/ (首页)
├── Hero               # 主标题 + 副标题 + CTA 按钮
├── Problem            # 痛点网格 (6 个常见问题)
├── How It Works       # 7 阶段动画/交互式时间线
├── State Machine      # 核心差异化大板块
├── Spec-Driven        # 规范驱动 vs 提示词驱动对比
├── AI Tools           # 三工具卡片
├── Safety             # 安全防线列表
├── Quick Start        # 代码块 + 模式表格
├── Numbers            # 指标条
├── FAQ                # 24 个常见问题 (入门/AI工具/工作流/技术栈/安全/对比/未来)
└── CTA                # 底部大按钮 + 链接

/features              # 功能详细页（可展开）
/docs → 外部链接        # 开发者文档
```

---

> **下一步**：将本文档交给设计师或前端开发者，即可开始门户网站的开发。每个 Section 已包含完整的标题、正文和视觉建议。

---

## 十一、实施任务清单

- ✅ 任务 1：搭建 `website/` Next.js App Router 工程与基础设计令牌
- ✅ 任务 2：实现导航、Hero 与 Problem 核心叙事
- ✅ 任务 3：实现 7 阶段交互流水线与状态机板块
- ✅ 任务 4：实现 Spec-Driven、AI Tools、安全与 Quick Start 板块
- ✅ 任务 5：实现 Numbers、FAQ、CTA 与页脚
- ✅ 任务 6：完成响应式、可访问性、动效降级与 SEO
- ✅ 任务 7：完成构建、自动化测试与桌面/移动端视觉验收
