# opsx-dev-pipeline Agent 化架构设计

## 1. 结论

当前系统已经具备 Agent 化所需的大部分控制面能力：

- Phase 0-7 流水线状态机
- OpenSpec proposal、design、spec、tasks 制品链路
- review、tests、verify、archive、commit、push、merge 门禁
- `.pipeline-state/<change>.json` 持久化、暂停、恢复和审计
- Git 与 OpenSpec 的事实校验
- metrics-server 对流水线状态的采集和分析

下一步不应继续堆叠一份更长的 Skill Prompt，而应将系统拆成：

> LLM 负责理解、规划和提出动作；确定性 Runtime 负责状态、门禁、工具执行和交付安全。

## 2. 当前系统与目标系统

当前系统的主要链路是：

```text
用户
  -> Skill / Command Markdown
  -> AI 解释流程并拼接命令
  -> .mjs 脚本
  -> OpenSpec / Git / 测试
  -> openspec/.pipeline-state/*.json
```

目标形态是：

```text
Host Adapter
  Claude Skill / Codex / Cursor / CLI
          |
          | Agent Protocol
          v
Pipeline Agent Runtime
  Context Builder
  Planner
  Policy / Approval Engine
  Action Executor
  State Store
  Evidence / Event Logger
          |
          +--> OpenSpec Adapter
          +--> Git / Test Adapter
          +--> Human Interaction Adapter
          |
          v
  pipeline state + OpenSpec artifacts + Git facts
```

Skill、Command、CLI 和未来的 MCP Server 都应该只是入口适配层，共用同一套 Runtime，避免 Claude、Codex、Cursor 各自维护一份流程逻辑。

## 3. Agent 核心循环

Agent 每次只决定下一步动作，不直接掌管整个 Phase 0-7：

```text
Observe
  -> Build Context
  -> Plan next action
  -> Check policy / approval
  -> Execute typed tool
  -> Validate result and evidence
  -> Persist state and event
  -> Continue / Ask user / Pause
```

伪代码：

```ts
while (run.status === 'active') {
  const state = await stateStore.load(runId);
  const facts = await observer.collect(state);

  if (facts.divergence) {
    await runtime.pause(runId, facts.reason);
    break;
  }

  const proposal = await planner.nextAction({
    state,
    facts,
    phaseDefinition: phaseRegistry.get(state.currentPhase),
  });

  if (policy.requiresApproval(proposal)) {
    await interaction.requestDecision(proposal);
    break;
  }

  const result = await executor.execute(proposal);
  await postconditionValidator.check(proposal, result);
  await stateStore.persist(result.stateChanges);
  await eventLog.append(proposal, result);
}
```

## 4. 现有模块到 Agent Runtime 的映射

| 当前模块 | Agent 化后的职责 |
| --- | --- |
| `dev-pipeline-state.mjs` | `StateStore` + `GateEngine` |
| `pipeline-lib.mjs` | 基础命令执行和仓库适配器 |
| `phase-*.md.hbs` | Phase Definition、约束和上下文模板 |
| OpenSpec 脚本 | `OpenSpecAdapter` |
| Skill / Command 文件 | Host Adapter，只负责启动 Agent |
| `metrics-server` | Event Consumer / Analytics Read Model |

建议先把 `dev-pipeline-state.mjs` 的领域逻辑迁移为 TypeScript 模块，原有 `.mjs` 保留为兼容 CLI wrapper。

## 5. 工具协议

Agent 不应拥有未限制的 `Bash *`。所有副作用通过类型化工具执行，并返回统一结果。

### 5.1 状态工具

```ts
state.get(runId)
state.init(input)
state.recordDecision(runId, decision)
state.recordAttempt(runId, scope, result)
state.transition(runId, target)
state.pause(runId, reason)
state.complete(runId)
```

### 5.2 OpenSpec 工具

```ts
openspec.preflight()
openspec.listChanges()
openspec.createChange(name)
openspec.status(change)
openspec.instructions(change, artifact?)
openspec.validate(change)
openspec.apply(change)
openspec.archive(change)
```

### 5.3 Git 工具

```ts
git.status()
git.diff()
git.branch()
git.fetch()
git.stage(paths)
git.commit(message)
git.push(branch)
git.merge(source, target, strategy)
git.listConflicts()
```

### 5.4 测试、验证和交互工具

```ts
tests.detect()
tests.run(command)
verify.detect()
verify.run(command)
interaction.askDecision(request)
```

统一结果格式：

```ts
type ToolResult = {
  status: 'succeeded' | 'needs_approval' | 'blocked' | 'failed';
  summary: string;
  evidence: Evidence[];
  stateChanges?: StateChange[];
  nextActions?: string[];
};
```

例如，提交工具应先返回待提交文件和 diff 摘要，状态为 `needs_approval`；用户确认后才执行真正的 `git commit`。

## 6. 门禁与审批策略

门禁策略必须是 Runtime 的显式配置，而不是只写在 Prompt 中。

| 动作 | 默认策略 |
| --- | --- |
| 读取文件、搜索代码、读取 Git 状态 | 自动 |
| 生成 proposal/design/spec/tasks 草稿 | 自动 |
| 运行静态检查、测试和 verify | 自动 |
| 按 tasks 修改业务代码 | 自动，但受任务和作用域约束 |
| 确认 proposal | 必须用户确认 |
| 确认 implementation | 必须用户确认 |
| 跳过 review | 必须用户确认 |
| 跳过测试或记录技术债务 | 必须用户确认 |
| archive | 必须用户确认 |
| commit、push、merge | 必须用户确认 |
| 删除分支、创建 tag、强制操作 | 单独确认 |

现有状态字段可以直接作为第一版 Approval Policy 的依据：

```text
proposalApproved
implementationConfirmed
reviewDisposition
reviewResult
postArchiveAction
commitApproved
sourcePushApproved
mergeApproved
targetPushApproved
```

模型不能通过推测设置这些高风险决策。独立 OpenSpec 命令产生的历史记录也不能自动等价于交付确认。

## 7. 状态模型

现有 `.pipeline-state/<change>.json` 可以继续作为本地持久化格式，但代码层应抽象为运行聚合：

```ts
type PipelineRun = {
  runId: string;
  changeName: string;
  currentPhase: number;
  currentStep: number;
  status: 'active' | 'paused' | 'completed';
  decisions: Record<string, unknown>;
  phaseHistory: PhaseRecord[];
  attempts: AttemptRecord[];
  evidence: EvidenceRef[];
  pendingApproval?: DecisionRequest;
  version: number;
};
```

建议在现有 Schema v3 基础上增加：

- `lastActionId`：动作幂等键
- `pendingAction`：进程中断时的未完成动作
- `blockedReason`：结构化暂停原因
- `lastObservedFacts`：最近一次 Git/OpenSpec 事实快照
- `executionLease`：防止同一 change 被多个 Agent 同时执行
- `correlationId`：关联一次完整运行和外部事件

现有 `_version` 乐观锁应保留；同时增加运行 lease，以避免两个 Agent 并行修改同一个 change。

## 8. Phase 定义

每个 Phase 不应只是一份 Markdown，而应具有可执行定义：

```ts
type PhaseDefinition = {
  id: number;
  name: string;
  objective: string;
  allowedActions: string[];
  entryChecks: Check[];
  exitGates: Gate[];
  approvalPoints: ApprovalPoint[];
  recoveryRoutes: RecoveryRoute[];
};
```

Markdown reference 仍然保留，用于给模型补充领域规则和写作约束，但不再作为唯一的流程真相。

例如 Phase 3 可以规定：

- 允许读取 diff、运行 review、记录 review attempt
- 只有 `review.status=passed` 才能进入 Phase 4
- 发现严重问题时只能进入修复提案流程或暂停
- 需求错误可回到 Phase 1，代码错误可回到 Phase 2

## 9. Agent 分层

第一版不建议拆成多个互相通信的自治 Agent。推荐一个主编排 Agent 加局部 Worker：

```text
主编排 Agent
  ├── OpenSpec Worker：生成和校验制品
  ├── Coding Worker：按 tasks 修改代码
  ├── Review Worker：只读分析 diff 并产出报告
  └── Test Worker：识别、执行和解释测试
```

主 Agent 负责状态、门禁、审批和恢复；Worker 只负责局部任务。Review Worker 最适合以后接入真正的独立子 Agent，因为它需要独立上下文、只找问题、不修改代码。

## 10. 对外入口

所有入口共用一个 Runtime：

```text
opsx-agent run "实现用户头像上传"
opsx-agent resume <change>
opsx-agent status <change>
opsx-agent approve <change> <decision>
```

未来可以提供 MCP 工具：

```text
pipeline.start
pipeline.observe
pipeline.next_action
pipeline.approve
pipeline.pause
pipeline.resume
pipeline.status
```

Claude、Codex、Cursor 的 Skill/Command 只负责把宿主对话转换为这些 Runtime 调用。

## 11. 落地顺序

### 阶段一：抽取控制层

新增：

```text
src/agent/
  domain/
    pipeline-state.ts
    phase-definition.ts
    gates.ts
    decisions.ts
  runtime/
    agent-runtime.ts
    planner.ts
    policy.ts
    executor.ts
  tools/
    state-tools.ts
    openspec-tools.ts
    git-tools.ts
    test-tools.ts
  adapters/
    claude.ts
    codex.ts
    cursor.ts
```

### 阶段二：实现本地 Runtime

先支持：

```text
start -> propose -> ask approval -> apply -> review -> test -> archive
```

暂时不自动执行 merge、push、tag 和分支删除。

### 阶段三：统一宿主入口

让 Claude、Codex、Cursor 和 CLI 都调用同一套工具协议和状态服务。

当前实现：`agent-stdio` 使用官方 `@modelcontextprotocol/sdk` 暴露 MCP
`tools/list` 和 `tools/call`，所有工具调用仍由本地 `ToolRegistry` 执行，并要求
`runId` 后从 `StateStore` 解析当前流水线状态。旧的 newline-delimited JSON-RPC
实现保留在 `StdioToolServer`，用于兼容已有本地集成和协议单元测试；它不是业务逻辑
的第二份实现。

### 阶段四：接入事件流和指标

每个动作记录：

```json
{
  "runId": "...",
  "phase": 3,
  "action": "review.run",
  "actor": "agent",
  "result": "issues-found",
  "durationMs": 12300,
  "evidence": []
}
```

metrics-server 可以消费这些事件，而不是仅从最终状态文件反推过程。

### 阶段五：增加自动化等级

提供三种模式：

```text
assisted      所有高风险动作询问用户
semi-auto     低风险动作自动，高风险动作询问
autonomous    仅在 CI 沙箱和预设策略下执行
```

默认使用 `assisted`。

## 12. 必须避免的设计

不要做成：

```text
一个超级 Prompt
  -> 允许 Bash *
  -> 模型自行修改 JSON、执行 git push
```

这种设计会导致 gate 被绕过、状态与代码不一致、无法恢复和重放、不同宿主行为不一致，以及审计数据无法验证。

最终产品应定位为：

> 一个由 LLM 驱动、具备人机协同审批能力的规范研发流水线执行器。

最优先的工程动作是把 `dev-pipeline-state.mjs` 和各 Phase reference 背后的规则抽成 `Pipeline Runtime`，再让 Skill、CLI、MCP 统一调用它。完成这一步后，系统才真正从“提示词驱动的流程”变成“状态机驱动的 Agent”。
