# Phase2: 提案应用 (Apply)

## Step6：获取实施指令

```bash
node <SKILL_ROOT>/scripts/instructions-apply.mjs "<name>"
```

返回状态处理：
- `state: "blocked"` → **AskQuestion**：`回到 Phase1 补充制品` / `终止流程`
- `state: "all_done"` → 不再实施任务，但仍进入 Step8 决策点 2
- 其他 → 读取 `contextFiles` 继续实施

## Step7：逐任务实施

遍历 `tasks.md`，每个任务动手前执行**写前复用门禁**：在仓库内检索已有相近函数/模块/类型/常量，命中则复用，不造重复轮子。

标记任务完成前执行**准出自审查门禁**：

| # | 自审查项 | 通过判据 |
|---|---------|---------|
| 1 | 正确性 | 实现满足任务描述与提案意图 |
| 2 | 边界与空值 | 处理空/缺省/越界/极端输入 |
| 3 | 错误处理 | 失败路径有明确处理，不吞异常 |
| 4 | 复用与去重 | 已执行写前复用门禁；无重复逻辑 |
| 5 | 命名一致 | 与相邻代码、领域术语一致 |
| 6 | 结构/分层一致 | 与项目既有分层、模块边界一致 |
| 7 | 与项目基准一致 | 符合 `openspec/config.yaml` / `AGENTS.md` / `CLAUDE.md`；若三者均不存在，以仓库现有代码风格/模式为准 |
| 8 | 资源与副作用 | 正确释放资源，无泄漏 |
| 9 | 契约/接口一致 | 对外接口、字段、错误语义一致 |
| 10 | 安全与敏感信息 | 无硬编码凭据/密钥 |
| 11 | 可读性 | 关键意图清晰 |
| 12 | 测试随附 | 按项目习惯补充/更新对应测试 |

**有一条不满足 → 不允许标记完成**，先改到满足。

准出全部通过后，编辑 `tasks.md` 将该任务条目的 `- [ ]` 改为 `- [x]`，完成标记。

遇到阻塞时 **AskQuestion**：`提供补充说明` / `回到 Phase1 修改提案` / `跳过此任务`（标记 `[~]`） / `终止流程`

## Step8：[决策点 2] 实施完成确认

展示实施摘要（完成任务数、跳过任务数、变更文件列表），**AskQuestion**：
- `进入代码审查` → Phase3
- `暂停流水线，手动调整后继续` → 展示恢复指引后退出
- `跳过审查，继续后续流程` → Phase4（完成后进入 Phase5）
- `终止流程` → 退出

按选择先记录再迁移：
```bash
# 进入代码审查
node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs decision "<name>" implementationConfirmed true
node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs decision "<name>" reviewDisposition '"review"'
node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs transition "<name>" 3 9

# 显式跳过审查
node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs decision "<name>" implementationConfirmed true
node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs decision "<name>" reviewDisposition '"skip-review"'
node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs transition "<name>" 4 13
```

回到提案时迁移到 Phase1 Step3；暂停时执行 `pause`。任何路径都不得绕过 `implementationConfirmed`。
