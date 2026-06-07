---
name: recovery-guardrails-appendix
description: 流水线中断与恢复、兼容性与降级（含 AskQuestion fallback）、Guardrails、Error Handling 与决策点总览。
---

## 1. 流水线中断与恢复

> 本文件是跨阶段规则、恢复、降级、Error Handling 与决策总则的唯一正文来源。`SKILL.md` 只做入口摘要，`assets/*.md` 只做导航索引与维护视图。

多轮澄清或长对话不构成自动退出理由；非正常结束全流程须征得用户同意，见下文 **Guardrails** 中「退出须用户同意」。

### 1.1 统一阶段提示模板

为减少阶段切换时的冗长复述，进入任一 Phase、从暂停点恢复、或用户补充自由文本后，应优先使用以下短格式组织提示：

- `Phase：<阶段名>`
- `change：<change-name>`
- `当前步骤：<Step / 决策点>`
- `已知状态：<仅列当前推进所需的 1–3 条事实>`
- `下一动作：<将执行的命令 / 将进入的决策点>`

使用约束：

- 只保留当前用户为继续推进所必需的信息，不重复复述已确认的长背景
- 若当前回合的重点是等待用户选择，则 `下一动作` 应写成“等待你选择 <决策点名称>”
- 若当前回合的重点是先执行命令再进入决策点，则 `下一动作` 应写成“先执行 <步骤>，再进入 <决策点>”

### 1.2 概念短说明模板

当用户是首次进入某一阶段、或当前决策点直接依赖某个术语时，可按需插入一行短说明；避免长篇术语解释。

- `change`：本次需求对应的一组 OpenSpec 变更目录与实现范围
- `artifact`：change 下的单个制品文件，如 proposal、design、tasks 或 schema 定义的其它文件
- `archive`：将当前 change 归档到 `openspec/changes/archive/`，并按选择决定是否同步 delta specs
- `verify`：归档前的 schema / workflow 校验命令；与是否补单元测试是两个不同门禁

在任何决策点选择「终止流程」或「暂停流水线」类选项时，展示：

- change 名称、中断阶段、中断原因
- 各 Phase 完成状态清单（`[x]` 已完成 / `[ ]` 未完成）
- **恢复指引**：重新运行此技能并传入 change 名称从断点继续；或按需手动执行：
    - **Phase 3**（`phase-3-review.md`）、**Phase 4**（`phase-4-archive.md`）、**Phase 5**（`phase-5-unit-tests.md`）、**Phase 6**（`phase-6-merge-push.md`）中的 Git 命令与决策流
    - Openspec 部分亦可对照 **Phase 1 / 2 / 4** 与等价 `openspec` CLI

## 2. 兼容性与降级

### 2.0 技能脚本路径 `<SKILL_ROOT>`

各 `phase-*.md` 中出现的 `bash <SKILL_ROOT>/scripts/…` 表示：

- 将 `<SKILL_ROOT>` 替换为**本技能安装根目录**的绝对路径（该目录内含 `scripts/` 与 `references/`）
- 在**目标 git 仓库根目录**作为工作目录执行命令
- 勿假设技能文件夹名为 `dev-pipeline`

权威说明见仓库根目录 `SKILL.md`「脚本（可选）」。

### 2.1 AskQuestion 不可用

当运行环境**没有** AskQuestion 工具（或非 Cursor）时：

- 在每个决策点用**编号列表**列出与当前 Phase 的 `phase-*.md` 中**完全一致**的选项标签
- 请用户回复**序号**或**复制选项关键词**，并将选择映射为与原 AskQuestion 相同的下一步
- 要求自由文本的场景（需求描述、提案修改、自定义提交信息等）仍只通过普通消息收集，不使用编号决策列表

**Error Handling** 表中凡写「使用 AskQuestion 询问」的，均改为：**先展示与表中语义一致的编号选项，再等待用户选择**。

### 2.2 子技能缺失时的 fallback 对照表

不要求单独加载或 invoke 下列子技能。若子技能未安装、不在技能列表中或无法调用，**直接执行本技能下列等价流程**（权威步骤始终在 `references/phase-*.md`）：

| 子技能 | 本技能中的等价流程 |
|--------|---------------------|
| `openspec-propose` | Phase 1，`phase-1-propose.md`（步骤 3–4） |
| `openspec-apply-change` | Phase 2，`phase-2-apply.md`（步骤 5–7） |
| `openspec-archive-change` | Phase 4，`phase-4-archive.md`（步骤 12–15） |

**Git（审查 / 提交 / 合并）**：不依赖任何独立的 `git-*` skill；见 **Phase 3**（审查与报告）、**Phase 5**（审查后单元测试门禁）、**Phase 6**（暂存提交、推送、合并与冲突处理）。

**Phase 3 `fix-cr` 子流程**：创建 `openspec/changes/fix-cr-*/` 并**必经** `phase-1-propose.md` **决策点 1** 后，再按 `phase-2-apply.md` 实施；**禁止**跳过提案门禁直接改业务代码。等价流程即 **Phase 1 / Phase 2**（fix change 名称），无需加载任何外部 openspec 子技能。

### 2.3 Schema 识别与适配

- Phase 0 预检通过后，可运行 `bash <SKILL_ROOT>/scripts/dev-pipeline-detect-schema.sh [<name>]` 识别：
    - 当前 `schema`
    - 是否存在 `openspec/config.yaml`
    - 当前 change 是否已有 `.openspec.yaml`
    - `stacks`
- 若 `schema = custom`：按 `assets/schema-adapter-summary.md` 启用 schema-aware 增强路径：
    - expected artifacts 按 schema 定义处理
    - change 的 `.openspec.yaml` 中应声明相应的元数据
    - Apply / Review / Phase 5 使用 schema 定义的 merged context
    - Archive 前必须先解析并执行 verify
- 若 schema 无法识别：按默认 schema 路径继续，不阻断主流程

### 2.4 Openspec / Git 版本

本流水线**不锁定** openspec 次版本；若 CLI 子命令或 JSON 字段与文档示例不一致，以实际 `openspec --help` 与命令输出为准。

`openspec/config.yaml` 是项目描述与 schema 配置的首选来源；若缺失，则依次降级使用 `AGENTS.md`、`CLAUDE.md`；若三者都不存在，则回退为读取仓库现有代码、测试与构建文件做启发式判断，并优先走 **Error Handling** 表。

### 2.5 代码与测试风格（项目内）

编写或修改实现代码、测试代码时：**不**引用或依赖任何外部的「框架专用代码生成」类技能。以 **`openspec/config.yaml` / `AGENTS.md` / `CLAUDE.md`**（加载顺序同 Phase 3 **步骤 8**）为规范来源，并对照**本仓库已有实现与单测**保持风格一致。

## 3. Guardrails

- 本流水线在 **Phase 3 / Phase 5 / Phase 6** 内联了代码审查、审查后单元测试门禁、提交推送与分支合并的完整步骤；**Openspec** 类子技能（`openspec-propose`、`openspec-apply-change`、`openspec-archive-change`）的等价流程在 **Phase 1 / 2 / 4**。若单独 skill 有更新，应同步校验本技能 `references/`。**执行时**仅需本技能 Phase 文档与上文 **子技能缺失时的 fallback 对照表**，无需单独的 Git 审查/提交/合并类 skill。

- **schema-aware 规则**：若使用自定义 schema，则以 `assets/schema-adapter-summary.md` 为差异权威来源；Phase 0 负责识别 schema / 元数据，Phase 1 负责补齐 `.openspec.yaml`，Phase 5 负责审查后单元测试门禁，Phase 4 负责 verify-before-archive，二者不得混淆。

- 每个决策点必须向用户提供**明确可选路径**；**首选** AskQuestion tool；**若不可用**则按 **§2.1 AskQuestion 不可用**用编号列表代替。决策点之间的非决策步骤自动连续执行。

- **提案确认门禁**：未经决策点 1 中用户明确选择「确认提案，开始实施」，不得进入 Phase 2；用户提出修改时以对话澄清并改制品，循环直至确认或终止。

- 需要自由文本输入时（如用户描述需求、提案修改意见、自定义提交信息），直接通过文本消息询问，不使用 AskQuestion tool。

- **澄清后强制回到流程**：用户发出与流水线相关的**自由文本**（需求澄清、提案修改、实施说明、审查反馈、提交信息草稿等）后，执行者**不得**只作答复或总结就结束回合。必须在**同一回复**中完成：
    - 同步当前 **Phase**、**change 名称**
    - 按该 Phase 的 `references/phase-*.md` 执行应做的更新与命令
    - 落到**下一个决策点**（**首选** AskQuestion；不可用则 **§2.1** 编号选项）  
    信息不足时先列缺口再追问，用户补答后再次执行本条款直至进入下一决策点或用户明确终止/暂停。

- **退出须用户同意**：多轮对话后仍不得单方以「会话过长」「上下文太多」「先到这里」等为由结束流水线。若执行者认为**必须**结束全流程（且非用户在决策点已选的「终止」），须先说明原因并征求同意（**首选** AskQuestion；不可用则编号选项：**同意结束** / **继续流水线**）：
    - **同意** → 按本页 **§1 流水线中断与恢复**展示断点信息后结束
    - **不同意** → 回到当前 **Phase / change / 未完成步骤**，执行上条「澄清后强制回到流程」并对照当前 `phase-*.md` 继续  
    **例外**：`Error Handling` 中环境与前置失败（如 openspec 不可用、非 git 仓库）按表直接处理；用户已在决策点或「暂停流水线」路径上**明示**终止/暂停的，从其选择。

- 「暂停流水线」类选项统一行为：展示恢复指引后退出，用户重新传入 change 名称即可从断点续接。

- 代码审查修复循环最多 3 轮，超过后强制暂停。

- 提案修改以用户确认「与原始需求一致」为终止条件，不设固定次数上限；多轮仍无法对齐时须建议暂停/拆分并由用户决定是否终止。

- 编写代码时：按 **§2.4 代码与测试风格（项目内）** 的约定对齐当前仓库，禁止依赖外部代码生成类技能。

- **审查后单元测试（Phase 5 步骤 16 / 决策点 4b）**：Review 完成并准备进入 Archive 前，须先完成本环节并由用户确认是否编写/补充单测；不得未经 AskQuestion（或附录编号选项）默认跳过。规程全文见 `references/phase-5-unit-tests.md`。

- **verify 与单测的边界**：若使用自定义 schema，Phase 5 的单元测试在前，Phase 4 的 verify 在后；verify 仍属于 **Phase 4** 的 schema / workflow 门禁。即便 Phase 5 已跳过或已通过单元测试，也不得默认跳过 **Phase 4** 的 verify。

- **默认**在提交中包含与本 change 相关的 openspec 产物；若目标仓库的 `CONTRIBUTING`、`CLAUDE.md` 或团队约定另有要求，则从仓库约定。

- **默认**提交信息使用 conventional commit 格式并包含 Co-Authored-By；若仓库或团队另有提交模板则从之。

- 合并后始终切回源分支（除非用户选择删除源分支）。

- 敏感文件检测到时必须警告并确认。

- 不使用 `--no-verify` 或 `--force`，除非用户明确要求。

- 最终摘要根据实际执行路径动态生成，跳过的阶段标记为「⏭️ 已跳过」（与 `phase-6-merge-push.md` **步骤 22** 一致）。

- 多轮审查报告使用 `-round-N` 后缀避免覆盖。

### 3.1 Error Handling

优先原则：

- 先判断是否属于**前置阻断**（不可继续）
- 能在当前 Phase 修复的，优先给出**恢复动作 + 恢复点**
- 涉及风险放行的场景，必须让用户**显式确认**
- 只在确实无法恢复或用户明确选择终止时结束流水线

| 场景 | 处理方式 | 恢复点 |
|------|----------|--------|
| openspec CLI 不可用 | 提示安装并退出 | 无 |
| 不在 git 仓库中 | 提示初始化并退出 | 无 |
| `openspec/config.yaml`、`AGENTS.md`、`CLAUDE.md` 均不存在 | 警告并回退为读取仓库现有代码、测试与构建文件做启发式判断 | 当前 Phase 继续 |
| `schema = custom` 但缺失 `.openspec.yaml` 或元数据 | 回到 Phase 1 补齐 `.openspec.yaml`，由用户确认元数据后继续 | Phase 1 Step 3 / 4 |
| schema 无法识别 | 警告并按默认 schema 路径继续 | 当前 Phase 继续 |
| change 名称冲突 | 询问复用还是创建新名称 | Phase 1 Step 3 |
| change 不存在 | 列出可用 change 让用户选择 | Phase 0 Step 2a |
| change 状态不完整或无法准确判断 | 以较早阶段为保守恢复点，必要时请用户确认从哪个 Phase 续接。`较早阶段` 指最早一个尚未完成的主干阶段或质量门禁；若 `openspec status`、审查报告、文件系统与 git 状态冲突，优先回到不跨越提案确认 / 审查 / 单测 / verify / 归档 / 提交推送合并门禁的更早阶段 | 依用户确认 |
| apply 返回 `state: blocked` | 回到 Phase 1 补充制品，或终止流程 | Phase 1 Step 3 / 3.a |
| Apply / Review 所需 change 元数据缺失 | 回到 Phase 1 补齐 change 元数据，再继续当前流程 | Phase 1 → 原 Phase |
| 审查时无变更可审 | 提示并进入 Phase 5；Phase 5 完成后再进入 Phase 4 | Phase 5 Step 16 |
| 审查报告目录创建失败 | 提示错误，报告仅输出到对话 | 当前 Phase 继续 |
| 审查修复循环达到 3 轮上限 | 强制暂停并提示人工介入 | 重新进入 Phase 3 |
| verify 无法解析 | 先查 `make validate`，再查 `./scripts/validate.sh all`，仍无法确定则询问用户手动确认；未确认前不得宣称满足 verify-before-archive | Phase 4 Step 13 |
| verify 执行失败 | 提供修复后重试 / 暂停流水线 / 终止流程 | Phase 4 Step 13 |
| 自定义 schema 下 verify 未通过 | 禁止进入归档步骤 | Phase 4 Step 13 |
| 归档目标已存在 | 使用 `openspec archive` / `dev-pipeline-archive.sh` 时由 CLI 处理；手动 `mv` 时追加 `-N` 后缀 | Phase 4 Step 15 |
| `openspec archive` 不可用或失败 | 优先重试；必要时降级为手动归档，并保持与用户在 delta/specs 选择上的意图一致 | Phase 4 Step 15 |
| 无法唯一确定测试命令 | 列出 2–3 个候选命令，请用户选择或输入惯用命令 | Phase 5 Step 16.1 |
| 单元测试失败 | 提供修复代码或测试后重试 / 终止流程 | Phase 5 子流程 A 步骤 3 |
| 分支落后或分叉 | 提供 pull --rebase / 继续后续流程（不先 rebase）/ 终止流程 | Phase 6 Step 17 |
| rebase 冲突 | 展示冲突文件，提供暂停流水线，手动调整后继续 / `git rebase --abort` 并终止 | Phase 6 Step 17 或 19 |
| 检测到敏感文件 | 提供排除敏感文件后继续后续流程 / 继续后续流程（包含敏感文件） / 终止流程 | Phase 6 Step 17 |
| 推送失败 | 提供 pull --rebase 重试或终止选项 | Phase 6 Step 19 |
| 合并前工作区不干净 | 询问先 stash / 先提交 / 终止流程 | Phase 6 Step 20 |
| 合并冲突 | 展示冲突文件，提供中止/theirs/ours/暂停手动解决选项 | Phase 6 Step 20 |
| openspec 命令执行失败或返回非预期格式 | 展示错误输出；询问（首选 AskQuestion；否则编号选项）：重试 / 跳过当前步骤 / 终止流程 | 当前步骤 |
| openspec 命令超时（>30s 无响应） | 终止命令，提示可能原因（网络、配置），提供重试或终止选项 | 当前步骤 |

### 3.2 决策点总览

#### 决策自动化分级规则

为降低后续 Step B2/B3 优化时的误判风险，决策点统一分为三类：

- **A 类：必须用户确认**
  - 用于不可逆、高风险、会跳过质量门禁或会改变 git / OpenSpec 语义的动作
  - 执行者只能给建议，**不得**静默代选
- **B 类：可推荐，不可静默默认**
  - 用于中低风险但上下文容易不完整、自动代选容易走错阶段或误导用户的分支
  - 执行者可以给出推荐项，但仍须由用户明确确认
- **C 类：仅允许低风险默认 / 保守假设**
  - 用于低风险、可逆、不跳过门禁的内部默认
  - 只可用于保守恢复建议或推荐高亮，**不得**替代 A/B 类决策点上的用户选择

**术语约定：**

- **推荐默认**：在选项中标记为推荐项，但仍需用户确认
- **自动默认**：仅在低风险、可逆、文档已明确允许的场景下自动采用

#### 默认动作触发条件

仅当同时满足以下条件时，才允许采用自动默认：

1. 动作为低风险且可逆
2. 不会跳过提案、审查、单测、verify、归档等质量门禁
3. 不会改变需求语义、git 历史或 OpenSpec 制品状态
4. 不涉及敏感文件、凭据、冲突处理、分支删除、强制覆盖类操作
5. 文档中已明确写出该默认及其适用范围

#### 默认动作禁用条件

任一满足即必须回到用户确认：

1. 会跳过 review / tests / verify / proposal gate
2. 会在存在未完成项或状态不一致时继续归档
3. 涉及敏感文件或疑似凭据
4. 涉及 merge / rebase / push 失败后的补救
5. 涉及 merge conflict 的 `theirs` / `ours` / `abort`
6. 涉及 fix-review、直接修复、继续后续流程等路径选择
7. 涉及目标分支、合并策略、删除源分支
8. verify 命令或测试命令无法唯一确定
9. repo 状态、OpenSpec 状态、文件系统状态彼此不一致

#### 统一动作语义

为减少用户在不同 Phase 间的理解切换，决策点文案统一采用以下语义：

- `继续`：进入当前分支对应的下一阶段或下一步骤
- `补充/修改`：通过自由文本补充信息，更新当前 Phase 所需制品或状态后，回到当前决策点
- `暂停流水线，手动调整后继续`：展示恢复指引后退出，用户后续以 change 名称从指定断点续跑
- `终止流程`：结束当前流水线，不再自动推进后续 Phase
- `继续后续流程`：跳过当前可选处理环节，进入当前主干定义的下一必经阶段
- `⏭️ 已跳过`：该阶段或环节经用户显式选择后未执行，并已按主干规则进入下一阶段；仅用于最终摘要或阶段状态表

| # | 阶段 | 决策内容 | 选项 | 自动化级别 | 是否允许默认 | 推荐项 | 禁用默认条件 |
|---|------|----------|------|------------|--------------|--------|--------------|
| 0 | 入口 | 已有 change 续接确认 | 从 Phase X 继续 / 从头开始（新名称）/ 终止 | B | 仅允许保守恢复建议，不可代选 | 状态不完整时推荐较早阶段作为保守恢复点；较早阶段指最早一个尚未完成的主干阶段或质量门禁 | 状态冲突、阶段判断不唯一、涉及跳过门禁 |

#### 已有 change 续接的保守恢复建议

当已有 change 的状态来源彼此不一致时，续接建议按以下顺序保守裁决：

1. **先看是否会跨越主干门禁**：若某个推荐阶段会跳过提案确认、审查、单测、verify、归档、提交/推送/合并中的任一门禁，则该推荐无效，改为回到更早阶段
2. **未归档链路优先回到更早的 OpenSpec 主干阶段**：
   - 制品未完成 → 推荐 Phase 1
   - 制品完成但任务未完成 → 推荐 Phase 2
   - 任务完成但无审查报告 → 推荐 Phase 3
   - 已有审查报告但审查后测试 / 归档链路未完成 → 推荐 Phase 5，再进入 Phase 4
3. **已归档链路优先看 git 门禁**：
   - 有未提交变更 → 不得推荐到 Phase 6 Step 19/20 之后
   - 有未推送提交 → 不得推荐到 Phase 6 Step 20 之后
4. **冲突时宁可回早，不可冒进推晚**：
   - `openspec status` 与文件系统冲突 → 推荐较早阶段
   - git 显示仍有未提交 / 未推送状态 → 不得推荐到比当前 git 门禁更晚的阶段
   - 审查报告存在但任务仍未完成 → 优先回到任务完成前阶段，而不是直接进入 Phase 5 / Phase 4

以下场景可作为高频参考：

| 观察到的状态 | 推荐续接点 |
|---|---|
| `applyRequires` 制品未完成 | Phase 1 Step 3 |
| 制品完成但任务未完成 | Phase 2 |
| 任务完成且无审查报告 | Phase 3 |
| 有审查报告但未归档 | Phase 5（完成后进入 Phase 4） |
| 已归档且有未提交变更 | Phase 6 Step 17/18 |
| 已归档且有未推送提交 | Phase 6 Step 19 |

> 以上推荐仍属于 **B 类确认**：执行者可以高亮推荐项，但不得替用户静默代选。

> **注**：编号带字母后缀的为条件触发决策点，仅在对应条件满足时出现。决策点 3a 在每轮修复循环中触发，并复用 `phase-1-propose.md` 决策点 1 的三选项；若用户决定放弃当前 `fix-cr-*`，通过「终止流程」退出子流程，再按 `phase-3.1-fix-review.md` 的清理与续接说明回到原 change。**决策点 4b** 在 Review 完成后、进入 Archive 前必经；规程全文见 `references/phase-5-unit-tests.md`；若用户选「暂停」，从 Phase 5 **步骤 16** 续跑。
