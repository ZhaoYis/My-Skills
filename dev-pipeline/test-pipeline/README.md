# Pipeline Delivery Flow Tests

使用 **AI Agent 真实执行**的方式，端到端测试 `opsx-dev-pipeline` 的完整交付流程。

## 架构

```
Test Scenario (vitest)
  → EnvironmentFactory: 创建临时全栈项目 (git init + openspec init + pipeline init)
  → PipelineAgentOrchestrator: 按序启动 Agent 执行各阶段
    ├─ Phase 0 (Entrance) — 环境预检 + Schema 检测
    ├─ Phase 1 (Propose) — 创建 change + proposal/tasks/specs
    ├─ Phase 2 (Apply) — 逐任务实现 + self-review
    ├─ Phase 3 (Review) — 多维代码审查
    ├─ Phase 4 (Archive) — 验证 + 归档
    ├─ Phase 5 (Unit Tests) — 单元测试门禁
    └─ Phase 6 (Merge & Push) — commit + push + merge
  → PhaseValidator: 验证每个阶段产物
  → ReportGenerator: 生成 JSON + Markdown 报告
```

## 前置条件

- **OpenSpec CLI** 必须安装：`which openspec && openspec --version`
- **Node.js >= 20**
- **Git** 已配置（`git config user.name` / `user.email`）

## 运行测试

```bash
# 运行所有场景
cd test-pipeline && npm test

# 运行特定场景
npx vitest run scenarios/happy-path/fullstack-todo-full-flow

# 监听模式
npx vitest
```

## 测试报告

每次运行生成时间戳报告：

```
test-pipeline/reports/
├── YYYY-MM-DDTHH-mm-ss-<scenario>/
│   ├── report.json    # 机器可读
│   └── report.md      # 人类可读
└── latest/            # 最新运行符号链接
```

## 示例项目

`fullstack-todo` — Express + React 全栈 Todo 应用，含真实代码和测试。

## 测试场景

| 分类 | 场景文件 | 描述 | 测试数 |
|------|---------|------|--------|
| happy-path | `fullstack-todo-full-flow.test.ts` | 完整交付流程框架验证 | 17 |
| happy-path | `fullstack-todo-simple-feature.test.ts` | 简单后端特性 (只改 API) | 10 |
| error-recovery | `missing-openspec.test.ts` | 缺失 OpenSpec 时的降级处理 | 3 |
| error-recovery | `archive-with-pending-tasks.test.ts` | 未完成任务归档时的阻断与恢复 | 7 |
| schema-variations | `custom-backend-schema.test.ts` | 自定义 backend-only schema | 4 |
| schema-variations | `custom-fullstack-schema.test.ts` | 自定义 backend+frontend 多栈 schema | 8 |

**总计: 6 个场景, 49 个测试** (运行 `npm test` 全部通过)

## 报告示例

```json
{
  "meta": {
    "scenarioName": "fullstack-todo-framework-verification",
    "sampleProject": "fullstack-todo",
    "overallStatus": "pass",
    "schema": "default"
  },
  "summary": {
    "totalPhases": 12,
    "passedPhases": 12,
    "overallScore": 100
  }
}
```
