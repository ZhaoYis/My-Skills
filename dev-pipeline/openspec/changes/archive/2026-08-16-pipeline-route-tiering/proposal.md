## Why

当前所有变更都走完整的 Phase 0-7 流程，即使是 typo 修复也需要经历提案、审查、归档等阶段，仪式成本过高。需要引入 Route 分级机制，根据变更风险自动选择不同重量的 workflow 路径，让简单变更快速交付，复杂变更保持完整保障。

## What Changes

- 在 `openspec/config.yaml` 中新增 `pipeline.routes` 配置，定义三个 route：`trivial`、`standard`、`full`，每个 route 显式声明执行的 phases 列表
- 在 Phase 0 入口模板中增加 Route 评估步骤：AI 分析需求推荐 route，用户确认后记录到状态
- 在 `dev-pipeline-state.mjs` 状态管理脚本中增加 route 支持：transition 命令根据 route 决定允许的跳转，新增 `route upgrade` 命令
- 状态文件扩展：新增 `route` 字段记录选择和升级历史
- 向后兼容：未配置 route 或旧状态文件默认走 `full` route

## Capabilities

### New Capabilities

- `pipeline-route-config`: Route 分级配置规范，定义 config.yaml 中 pipeline.routes 的 schema 和三个内置 route（trivial/standard/full）的 phase 矩阵
- `pipeline-route-selection`: Phase 0 入口的 Route 评估与选择流程，包括 AI 推荐、用户确认、状态记录
- `pipeline-route-enforcement`: 状态管理脚本的 Route 执行控制，包括 transition 路由、route 升级机制、向后兼容

### Modified Capabilities

（无现有 capability 需要修改）

## Impact

- **受影响代码**:
  - `src/templates/common/skills/opsx-dev-pipeline/references/phase-0-entrance.md.hbs`：增加 Route 评估步骤
  - `src/templates/common/skills/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs`：增加 route 字段、transition 路由逻辑、upgrade 命令
  - `src/config/` 中的 config.yaml 模板：增加 pipeline.routes 默认配置
- **向后兼容性**: 完全兼容，未配置 route 时默认走 full route（现有行为）
- **依赖**: 无新增依赖
- **用户影响**: typo 修复等简单变更可从 7 Phase 减少到 3 Phase，显著降低仪式成本
