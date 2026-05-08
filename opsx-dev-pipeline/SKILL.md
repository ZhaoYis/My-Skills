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

## 执行说明

**元数据与本页正文优先**；各 Phase 步骤与选项以 `references/` 为准。

**流程概览**（`phase-0`～`phase-5` 主干）：Mermaid 为摘要；`opsx-*` 仅为别名；未尽分支以 Phase 引用文件为准。

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

**要点**（与引用文件同序）：

1. **环境预检（Phase 0）**：`openspec` 不可用 → 提示安装后结束；不在 git 仓库 → 提示初始化或进入仓库后结束。
2. **入口（Phase 0）**：无输入则文本询问；需求描述则推导 change 名并进入 Phase 1；**已有 change** 则 `openspec status`，按制品/任务状态判断续接 **Phase 1 Step 3 / Phase 2 / Phase 3**，并由用户确认「从 Phase X 继续 / 从头新建 / 终止」——**不是**一律先进入 Phase 1 门禁。
3. **提案与门禁（Phase 1）**：进入 Phase 2 前须过**决策点 1**。用户修改需求时以文本改制品并回到该决策点；澄清可与 Phase 1 合并。
4. **实施与审查（Phase 2～3）**：**决策点 2** 可暂停、跳过审查直接归档或终止（`phase-2-apply.md`）。审查未过：**fix-cr**、直接修复再审、暂停等（`phase-3-review.md`）；图中 `R3`→`REVIEW` 表示修复回路。
5. **归档与 Git（Phase 4～5）**：**决策点 4**：终止 / 仅推送 / 提交并合并。选「提交并合并」后出现**决策点 6**；选「仅推送」则 push 后直接结束。

**重要：** 所有输出使用中文。

---

**Input**: 用户的需求描述，或一个已有的 change 名称。

**Steps**

**澄清后强制回到流程（必填）**：用户以文本补充需求澄清、提案修改或实施/审查/归档/提交相关说明后，禁止仅解释或确认后收尾。同一回合内：(1) 标明 **Phase** 与 **change**；(2) 按当前 Phase 的 `references/phase-*.md` 更新制品并执行其中命令；(3) 推进至下一**决策点**（须 AskQuestion 则必须调用）。信息不足可先列缺口再追问，补答后重复本条。

**退出须用户同意**：多轮澄清后禁止以会话过长等理由单方收口。除用户在决策点已选「终止」外，若须结束全流程，须先说明原因并用 AskQuestion 征得同意；**不同意**则回到当前 **Phase / change / 未完成步骤**，按上条「澄清后强制回到流程」与对应 `references/phase-*.md` 继续。例外：附录 **Error Handling** 中环境与前置失败；用户在决策点或「暂停流水线」已选终止/暂停的，从其选项。

按下表顺序阅读并遵循各 Phase 文件中的步骤与决策点：

| Phase | 说明 | 引用文件 |
|-------|------|----------|
| 0 | 入口判断 | `references/phase-0-entrance.md` |
| 1 | 提案编写 (Propose) | `references/phase-1-propose.md` |
| 2 | 提案应用 (Apply) | `references/phase-2-apply.md` |
| 3 | 代码审查 (Review) | `references/phase-3-review.md` |
| 4 | 提案归档 (Archive) | `references/phase-4-archive.md` |
| 5 | 提交合并推送 (Merge & Push) | `references/phase-5-merge-push.md` |
| — | 中断恢复、护栏、错误处理、决策点总览 | `references/recovery-guardrails-appendix.md` |