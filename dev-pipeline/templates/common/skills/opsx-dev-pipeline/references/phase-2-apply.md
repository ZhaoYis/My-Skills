---
name: phase-2-apply
description: 全局步骤 5–7，含决策点 2。通常进入 phase-3-review.md 步骤 8；若跳过审查，则先进入 phase-5-unit-tests.md 步骤 16，再进入 phase-4-archive.md 步骤 12。
compatibility: 需要 openspec CLI、git；编写代码时以当前仓库的项目基准与既有代码风格为准（见正文）。
---

## Phase 2: 提案应用 (Apply)

### 步骤 5：获取实施指令并读取上下文

1. **执行**

    ```bash
    bash <SKILL_ROOT>/scripts/dev-pipeline-instructions-apply.sh "<name>"
    ```

2. **等价**

    `openspec instructions apply --change "<name>" --json`

3. **处理返回状态**

    - `state: "blocked"`（缺少制品）→ 使用 **AskQuestion tool**：
        - `回到 Phase 1 补充制品` — 回到 Phase 1 **步骤 3 / 3.a** 续接制品生成
        - `终止流程` — 退出
    - `state: "all_done"` → 所有任务已完成，跳到 Phase 3
    - 其他 → 读取 `contextFiles` 中的所有上下文文件，继续实施

4. **若检测到自定义 schema：补充读取 schema-aware 上下文**

    - 额外执行：

      ```bash
      bash <SKILL_ROOT>/scripts/dev-pipeline-change-context.sh "<name>"
      ```

    - 该命令是自定义 schema 主路径中的**首选上下文快照入口**；其输出中的 `contexts` / `standards` / `rulesSummary` 应视为后续 **Phase 2 / 3 / 5 / 4** 可复用的同一份 schema-aware 基准
    - 根据 schema 定义的顺序读取上下文
    - `rulesSummary` 按 artifact 维度汇总，仅对当前正在实施的制品应用对应规则
    - 仅在以下场景重新调用：Phase 1 刚补齐 `.openspec.yaml` 或 change 元数据、用户切换 change、或现有上下文结果缺失 / 已失效；其余情况下，后续 Phase 应优先复用本次结果，而不是重复解析同类信息
    - 若 change 元数据缺失：回到 Phase 1 先补齐 change 元数据，再继续 Apply（恢复后从 **步骤 5** 重新获取实施指令与上下文）

### 步骤 6：逐任务实施

1. **遍历** `tasks.md` 中的待办任务，逐个实施：

    - 展示当前任务进度：`正在实施任务 N/M: <任务描述>`
    - **6.0 写前复用门禁（每个任务动手前）**：先在仓库内检索是否已有功能相近的函数 / 模块 / 工具 / 类型 / 常量（按项目语言用对应检索手段）。命中则优先复用并在说明中标注引用路径；找不到再新建。准则：**不造重复轮子**。检索范围、判定与可选的结构化检索增强见 `assets/apply-quality-gate.md` **§1**
    - 执行代码变更时，遵循 **项目基准**（与 Phase 3 **步骤 8** 一致：默认优先 `openspec/config.yaml`，其次 `AGENTS.md`，再次 `CLAUDE.md`；若使用自定义 schema，则以 `openspec/config.yaml` 中定义的上下文、对应 standards 为主，`AGENTS.md` / `CLAUDE.md` 仅作不冲突的补充约束），并对照**本仓库同类模块的既有实现**（命名、分层、错误处理、日志、单测目录与风格等），不引入与现场代码不一致的新范式；规范未覆盖处，以相邻文件与本次变更触及的目录为准
    - 若当前 change 的 `stacks = [backend]`：优先关注接口契约、服务边界、数据访问、事务与后端测试习惯
    - 若 `stacks = [frontend]`：优先关注组件边界、状态管理、类型约束、交互一致性与前端测试习惯
    - 若 `stacks = [backend, frontend]`：除上述两类要求外，再额外核对前后端字段、接口契约与错误语义一致性
    - **6.x 自审查硬门禁（标记 `[x]` 前必做）**：对照 `assets/apply-quality-gate.md` **§2** 的通用自审查清单逐条确认（正确性 / 边界空值 / 错误处理 / 复用与去重 / 命名一致 / 与项目基准一致 / 测试随附等）。**有一条不满足 → 不允许标记完成**，先改到满足；判断不清时用 AskQuestion（不可用时用编号选项）向用户确认，不得静默放过
    - 标记任务完成：`- [ ]` → `- [x]`
    - 继续下一个任务

2. **若遇到阻塞**（任务不明确、设计缺陷等）：使用 **AskQuestion tool**

    - `提供补充说明` — 用户补充后继续当前任务
    - `跳过此任务` — 在 `tasks.md` 中标记为 `- [~] <任务描述> (已跳过)`，继续下一个任务
    - `终止流程` — 退出流水线（提供恢复指引）

### 步骤 7：[决策点 2] 实施完成确认

所有任务完成后，展示实施摘要（完成任务数、跳过任务数、变更文件列表），使用 **AskQuestion tool**。该决策点属于附录定义的 **A 类：必须用户确认**；尤其 `跳过审查，继续后续流程` 不得默认代选。

建议提示格式：

- `Phase：Phase 2 提案应用`
- `change：<name>`
- `当前步骤：步骤 7（决策点 2）`
- `已知状态：任务已完成；<跳过任务数> 个任务被跳过；变更文件 <N> 个`
- `下一动作：等待你选择进入审查、暂停、跳过审查或终止`

**选项：**

- `进入代码审查` — 进入 Phase 3
- `暂停流水线，手动调整后继续` — 展示恢复指引后退出；用户调整完后重新触发 pipeline 并传入 change 名称即可从 Phase 3 继续
- `跳过审查，继续后续流程` — 跳到 Phase 5；Phase 5 完成后再进入 Phase 4
- `终止流程` — 退出流水线
