---
name: recovery-guardrails-appendix
description: 流水线中断与恢复、兼容性与降级（含 AskQuestion fallback）、Guardrails、Error Handling 与决策点总览。
---

## 1. 流水线中断与恢复

多轮澄清或长对话不构成自动退出理由；非正常结束全流程须征得用户同意，见下文 **Guardrails** 中「退出须用户同意」。

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
- 勿假设技能文件夹名为 `opsx-dev-pipeline`

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

- Phase 0 预检通过后，可运行 `bash <SKILL_ROOT>/scripts/opsx-detect-schema.sh [<name>]` 识别：
    - 当前 `schema`
    - 是否存在 `openspec/config.yaml`
    - 当前 change 是否已有 `.openspec.yaml`
    - `stacks`
- 若 `schema = custom`：按 `references/schema-adapter.md` 启用 schema-aware 增强路径：
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

- **schema-aware 规则**：若使用自定义 schema，则以 `references/schema-adapter.md` 为差异权威来源；Phase 0 负责识别 schema / 元数据，Phase 1 负责补齐 `.openspec.yaml`，Phase 5 负责审查后单元测试门禁，Phase 4 负责 verify-before-archive，二者不得混淆。

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

| 场景 | 处理方式 |
|------|----------|
| openspec CLI 不可用 | 提示安装并退出 |
| 不在 git 仓库中 | 提示初始化并退出 |
| `openspec/config.yaml`、`AGENTS.md`、`CLAUDE.md` 均不存在 | 警告并回退为读取仓库现有代码、测试与构建文件做启发式判断 |
| `schema = custom` 但缺失 `.openspec.yaml` 或元数据 | 在 Phase 1 补齐 `.openspec.yaml`，由用户确认元数据后继续 |
| schema 无法识别 | 警告并按默认 schema 路径继续 |
| change 名称冲突 | 询问复用还是创建新名称 |
| change 不存在 | 列出可用 change 让用户选择 |
| 审查时无变更可审 | 提示并进入 Phase 5；Phase 5 完成后再进入 Phase 4 |
| 推送失败 | 提供 pull --rebase 重试或终止选项 |
| 合并冲突 | 展示冲突文件，提供中止/theirs/ours/手动解决选项 |
| 审查报告目录创建失败 | 提示错误，报告仅输出到对话 |
| 归档目标已存在 | 使用 `openspec archive` / `opsx-archive.sh` 时由 CLI 处理；手动 `mv` 时追加 `-N` 后缀 |
| openspec 命令执行失败或返回非预期格式 | 展示错误输出；询问（首选 AskQuestion；否则编号选项）：重试 / 跳过当前步骤 / 终止流程 |
| 无法解析 verify 命令 | 先查 `make validate`，再查 `./scripts/validate.sh all`，仍无法确定则询问用户手动确认；未确认前不得宣称满足 verify-before-archive |
| openspec 命令超时（>30s 无响应） | 终止命令，提示可能原因（网络、配置），提供重试或终止选项 |

### 3.2 决策点总览

| # | 阶段 | 决策内容 | 选项 |
|---|------|----------|------|
| 0 | 入口 | 已有 change 续接确认 | 从判断阶段继续 / 从头开始（新名称）/ 终止 |
| 1 | Propose | 确认提案（Apply 门禁） | 确认开始实施 / 对话修改制品直至一致 / 终止 |
| 1a | Propose | change 名称冲突 | 在已有 change 上继续 / 创建新名称 |
| 2a | Apply | state=blocked | 回到 Phase 1 补充制品 / 终止 |
| 2b | Apply | 任务阻塞 | 补充说明 / 跳过任务 / 终止 |
| 2 | Apply | 实施完成后 | 审查 / 暂停手动调整 / 跳过审查 / 终止 |
| 3 | Review | 审查结果处理 | 生成修复提案并应用 / 直接修复 / 暂停手动修复 / 忽略 / 终止 |
| 3a | Review 子流程 | 修复提案确认 | 确认修复 / 修改提案 / 放弃修复（清理 change） |
| 4a | Archive | 未完成项处理 | 继续归档 / 回到实施 / 终止 |
| 4 | Archive | 归档后操作 | 提交并合并 / 仅提交推送 / 终止 |
| 4b | Phase 5 | Archive 前是否编写/补充单元测试（步骤 16） | 需要（编写并运行通过）/ 不需要（跳过）/ 暂停流水线 |
| 5a | Commit | 分支落后/分叉 | pull --rebase / 忽略 / 终止 |
| 5b | Commit | 敏感文件检测 | 排除后继续 / 包含继续 / 终止 |
| 5 | Commit | 确认提交信息 | 确认 / 修改（文本输入）/ 取消（退出） |
| 5c | Push | 推送失败 | pull --rebase 重试 / 终止 |
| 6 | Merge | 目标分支 + 策略 | 分支选择 / 策略选择 |
| 6a | Merge | 合并冲突 | 中止 / theirs / ours / 暂停手动解决 |
| 6b | Merge | 合并后操作 | 保留源分支 / 删除源分支 |

> **注**：编号带字母后缀的为条件触发决策点，仅在对应条件满足时出现。决策点 3a 在每轮修复循环中触发。**决策点 4b** 在 Review 完成后、进入 Archive 前必经；规程全文见 `references/phase-5-unit-tests.md`；若用户选「暂停」，从 Phase 5 **步骤 16** 续跑。
