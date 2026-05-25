---
name: phase-2-apply
description: 全局步骤 5–7，含决策点 2。通常进入 phase-3-review.md 步骤 8；跳过审查直接归档则进入 phase-4-archive.md 步骤 12。
compatibility: 需要 openspec CLI、git；编写代码时以当前仓库的项目基准与既有代码风格为准（见正文）。
---

## Phase 2: 提案应用 (Apply)

### 步骤 5：获取实施指令并读取上下文

1. **执行**

    ```bash
    bash <SKILL_ROOT>/scripts/opsx-instructions-apply.sh "<name>"
    ```

2. **等价**

    `openspec instructions apply --change "<name>" --json`

3. **处理返回状态**

    - `state: "blocked"`（缺少制品）→ 使用 **AskQuestion tool**：
        - `回到 Phase 1 补充制品` — 回到 Phase 1 **步骤 3 / 3.a** 续接制品生成
        - `终止流程` — 退出
    - `state: "all_done"` → 所有任务已完成，跳到 Phase 3
    - 其他 → 读取 `contextFiles` 中的所有上下文文件，继续实施

4. **若 `schema = yzw-workflow`：补充读取 stack-aware 上下文**

    - 额外执行：

      ```bash
      bash <SKILL_ROOT>/scripts/opsx-change-context.sh "<name>"
      ```

    - 将输出中的 `contexts` / `standards` / `rulesSummary` 与 OpenSpec 官方 `contextFiles` 一并视为实施基准
    - `contexts` 读取顺序固定为：`shared` → 已声明的 `stacks`
    - `rulesSummary` 按 artifact 维度汇总，仅对当前正在实施的制品应用对应规则
    - 若 `.openspec.yaml` 缺失或 `stacks` 为空：回到 Phase 1 先补齐 change 元数据，再继续 Apply

### 步骤 6：逐任务实施

1. **遍历** `tasks.md` 中的待办任务，逐个实施：

    - 展示当前任务进度：`正在实施任务 N/M: <任务描述>`
    - 执行代码变更时，遵循 **项目基准**（与 Phase 3 **步骤 8** 一致：默认优先 `openspec/config.yaml`，其次 `AGENTS.md`，再次 `CLAUDE.md`；若 `schema = yzw-workflow`，则以 `openspec/config.yaml` 中 `shared` / `stacks` 上下文、对应 standards 为主，`AGENTS.md` / `CLAUDE.md` 仅作不冲突的补充约束），并对照**本仓库同类模块的既有实现**（命名、分层、错误处理、日志、单测目录与风格等），不引入与现场代码不一致的新范式；规范未覆盖处，以相邻文件与本次变更触及的目录为准
    - 若当前 change 的 `stacks = [backend]`：优先关注接口契约、服务边界、数据访问、事务与后端测试习惯
    - 若 `stacks = [frontend]`：优先关注组件边界、状态管理、类型约束、交互一致性与前端测试习惯
    - 若 `stacks = [backend, frontend]`：除上述两类要求外，再额外核对前后端字段、接口契约与错误语义一致性
    - 标记任务完成：`- [ ]` → `- [x]`
    - 继续下一个任务

2. **若遇到阻塞**（任务不明确、设计缺陷等）：使用 **AskQuestion tool**

    - `提供补充说明` — 用户补充后继续当前任务
    - `跳过此任务` — 在 `tasks.md` 中标记为 `- [~] <任务描述> (已跳过)`，继续下一个任务
    - `终止流程` — 退出流水线（提供恢复指引）

### 步骤 7：[决策点 2] 实施完成确认

所有任务完成后，展示实施摘要（完成任务数、跳过任务数、变更文件列表），使用 **AskQuestion tool**。

**选项：**

- `进入代码审查` — 进入 Phase 3
- `暂停流水线，手动调整后继续` — 展示恢复指引后退出；用户调整完后重新触发 pipeline 并传入 change 名称即可从 Phase 3 继续
- `跳过审查，继续后续流程` — 跳到 Phase 5；Phase 5 完成后再进入 Phase 4
- `终止流程` — 退出流水线
