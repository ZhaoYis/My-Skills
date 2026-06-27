# Pipeline Delivery Flow Tests

使用 **AI Agent 真实执行**的方式，端到端测试 `opsx-dev-pipeline` 的完整交付流程。

## 架构

```
Test Scenario (vitest)
  → EnvironmentFactory: 创建临时全栈项目
  → PipelineAgentOrchestrator: 按序启动 Agent 执行各阶段
    ├─ opsx-learn
    ├─ opsx-analysis
    ├─ opsx-design
    ├─ opsx-dev-pipeline Phase 0 (Entrance)
    ├─ opsx-dev-pipeline Phase 1 (Propose)
    ├─ opsx-dev-pipeline Phase 2 (Apply)
    ├─ opsx-dev-pipeline Phase 3 (Review)
    ├─ opsx-dev-pipeline Phase 4 (Archive)
    ├─ opsx-dev-pipeline Phase 5 (Unit Tests)
    ├─ opsx-dev-pipeline Phase 6 (Merge & Push)
    ├─ opsx-verify
    └─ opsx-health
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

| 分类 | 场景 | 描述 |
|------|------|------|
| happy-path | fullstack-todo-full-flow | 完整交付流程 |
| happy-path | fullstack-todo-simple-feature | 简单特性（只改后端） |
| error-recovery | missing-knowledge | 缺少知识库时的降级 |
| error-recovery | archive-pending-tasks | 未完成任务归档 |
| schema-variations | custom-fullstack-schema | 自定义 backend+frontend schema |
