---
name: opsx-dev-pipeline
description: 需求开发全流程一站式执行：openspec + git 仓库预检（Phase 0）→ 按入口类型续接 Phase 1/2/3 或新建提案（opsx-propose）→ 方案与需求一致门禁 → 应用（opsx-apply）→ 审查与修复回路（含 fix-cr 子流程）→ 归档（opsx-archive）→ 按决策点 4 选择仅推送或推送后合并。关键环节由用户决策。
license: MIT
compatibility: Requires openspec CLI and git CLI.
metadata:
  author: zhaoyi
  version: "1.7"
---

# 需求开发全流程流水线

## 技能目录布局（标准结构）

执行流水线时：**元数据与本页指令优先**；Phase 细则以 `references/` 下路径为准。

一站式完成从需求描述到代码合并的完整开发周期，在关键环节提供明确选项让用户决策。

**流程概览（与 `references/phase-0`～`phase-5` 一致的主干）：**

下列 Mermaid 图为摘要；`opsx-*` 为方便称呼的别名，**以各 Phase 文件中的命令与决策点为准**。图无法画全所有 AskQuestion 分支时，以引用文件为权威。

```mermaid
flowchart TD
  START([开始]) --> OPEN{openspec CLI 可用?}
  OPEN -->|否| PROMPT[提示安装 openspec]
  PROMPT --> ENDNODE([结束])
  OPEN -->|是| GIT{在 git 仓库内?}
  GIT -->|否| GIT_WARN[提示 git init 或进入仓库]
  GIT_WARN --> ENDNODE
  GIT -->|是| P0[Phase 0 入口 -> 需求 / 已有 change / 无输入]
  P0 -->|终止| ENDNODE
  P0 -->|需求描述·新建| P1[Phase 1 -> 提案与制品 -> opsx-propose]
  P0 -->|已有 change·续接 Phase 1| P1
  P0 -->|已有 change·从头新建 change| P1
  P0 -->|已有 change·续接 Phase 2| APPLY
  P0 -->|已有 change·续接 Phase 3| REVIEW
  P1 --> ALIGN[Phase 1 决策点 1 -> 提案与原始需求一致?]
  ALIGN -->|确认·开始实施| APPLY[Phase 2 -> opsx-apply]
  ALIGN -->|补充/修改·对话澄清| P1
  APPLY --> REVIEW[Phase 3 -> CodeReview]
  REVIEW --> R3[Phase 3 决策点 3 -> 归档 / 修复回路 / 暂停…]
  R3 -->|修复回路未结束| REVIEW
  R3 -->|进入归档| ARCHIVE[Phase 4 -> opsx-archive]
  ARCHIVE --> D4{Phase 4 决策点 4}
  D4 -->|终止流程| ENDNODE
  D4 -->|仅提交并推送| PUSH[Phase 5 -> commit + push]
  PUSH --> ENDNODE
  D4 -->|提交代码并合并| PUSHM[Phase 5 -> commit + push]
  PUSHM --> MERGE[Phase 5 决策点 6 -> 合并到目标分支]
  MERGE --> ENDNODE
```

**文字要点（与引用文件同序，补充图中未画细的路径）：**

1. **环境预检（Phase 0）**：`openspec` 不可用 → 提示安装后结束；不在 git 仓库 → 提示初始化或进入仓库后结束。
2. **入口（Phase 0）**：无输入则文本询问；需求描述则推导 change 名并进入 Phase 1；**已有 change** 则 `openspec status`，按制品/任务状态判断续接 **Phase 1 Step 3 / Phase 2 / Phase 3**，并由用户确认「从 Phase X 继续 / 从头新建 / 终止」——**不是**一律先进入 Phase 1 门禁。
3. **提案与门禁（Phase 1）**：凡从 Phase 1 走向实施前，必须经过**决策点 1**（未确认不得进入 Phase 2）。用户要求修改时以**文本对话**改制品并回到该决策点；可与「需求澄清」式探索合并在同一 Phase 1 流程中（不必单独命名 `opsx-explore`，除非你在项目里固定使用该别名）。
4. **实施与审查（Phase 2～3）**：Phase 2 的**决策点 2** 允许「暂停」「**跳过审查直接归档**」「终止」等，不一定进入 Phase 3（见 `phase-2-apply.md`）。进入审查后，未通过时可走 **fix-cr 提案子流程**、**直接修复再审**、**暂停** 等（见 `phase-3-review.md`），图中以 `R3`→`REVIEW` 示意「修复回路」而非简化为「回到 Phase 1 同一节点」。
5. **归档与 Git（Phase 4～5）**：归档后 **决策点 4** 三选一——**终止** / **仅提交并推送** / **提交并合并**。**合并（决策点 6）仅在选「提交并合并」后出现**；选「仅推送」则在 push 后结束，不再问合并。

细则、逐步命令与完整选项表仍以 `references/phase-0-entrance.md` 等文件为准。

**重要：** 所有输出使用中文。

---

**Input**: 用户的需求描述，或一个已有的 change 名称。

**Steps**

**澄清后强制回到流程（必填）**：用户以文本回复需求澄清、提案修改意见、实施/审查/归档/提交相关的补充说明等之后，执行者**不得**在仅解释或确认该段文字后就结束本轮。须**在同一回合内**：(1) 明确写出当前 **Phase** 与 **change 名称**；(2) 重新阅读并执行当前 Phase 对应 `references/phase-*.md` 中的步骤（含更新 openspec 制品、运行阶段内规定的命令等）；(3) 推进到该阶段的**下一个决策点**——若该决策点要求使用 AskQuestion，则**必须**调用 AskQuestion，不得以纯聊天代替。若信息仍不足，先列出缺口再追问，但仍须锚定流程，并在得到补充后重复本条款。

**退出须用户同意（多轮对话后仍适用）**：进入流水线后因多轮澄清、阻滞或上下文变长时，执行者**不得**以对话过长、信息过多、不便继续等为由**单方面收口**或结束会话。若执行者判断**确有理由结束全流程**（非正常决策点内用户已选的「终止」），必须先简述原因，并用 AskQuestion（或等价地给出明确二元/多元选项并得到用户明示）征得用户**同意退出**；**用户不同意**→必须回到当前 **Phase / change / 未完成步骤**，执行附录 `references/recovery-guardrails-appendix.md` 中的「澄清后强制回到流程」并按对应 `references/phase-*.md` **继续推进**。例外：环境与前置不满足时按该附录 **Error Handling** 处理（无须额外征求「退出」）；用户在决策点或「暂停流水线」路径上**已明示**终止/暂停的，按其选项执行。

执行时按 Phase 顺序阅读并严格遵循下列文件中的步骤与决策点（正文已拆分至 `references/`，逻辑与原文一致）：

| Phase | 说明 | 引用文件 |
|-------|------|----------|
| 0 | 入口判断 | `references/phase-0-entrance.md` |
| 1 | 提案编写 (Propose) | `references/phase-1-propose.md` |
| 2 | 提案应用 (Apply) | `references/phase-2-apply.md` |
| 3 | 代码审查 (Review) | `references/phase-3-review.md` |
| 4 | 提案归档 (Archive) | `references/phase-4-archive.md` |
| 5 | 提交合并推送 (Merge & Push) | `references/phase-5-merge-push.md` |
| — | 中断恢复、护栏、错误处理、决策点总览 | `references/recovery-guardrails-appendix.md` |

表中 `references/…` 路径均相对于技能根目录 `opsx-dev-pipeline/`。
