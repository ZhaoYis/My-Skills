## Purpose

定义 Phase 0 入口的 Route 评估与选择流程，包括 AI 推荐、用户确认、状态记录，确保用户能够根据变更性质选择合适的 route。

## ADDED Requirements

### Requirement: Route 评估步骤

Phase 0 入口模板必须包含 Route 评估步骤，在环境预检通过后、进入具体 phase 前执行。评估步骤必须分析用户需求描述，推荐合适的 route，并使用 askTool 获取用户确认。

#### Scenario: AI 推荐 route

- **WHEN** 用户在 Phase 0 提供需求描述
- **THEN** 系统分析需求特征（变更范围、风险等级、影响面），推荐最匹配的 route（trivial/standard/full）

#### Scenario: 用户确认 route

- **WHEN** 系统推荐 route 后
- **THEN** 系统使用 askTool 展示推荐 route 及其理由，并提供三个选项（trivial/standard/full），等待用户确认

#### Scenario: 用户修改 route

- **WHEN** 用户选择不接受推荐的 route
- **THEN** 系统记录用户选择的 route，继续执行流程

### Requirement: Route 选择记录

用户确认的 route 选择必须记录到状态文件的 `route.choice` 字段，同时记录到 `decisions.route_choice` 字段以保持向后兼容。

#### Scenario: 记录 route 选择

- **WHEN** 用户确认 route 选择
- **THEN** 系统执行 `dev-pipeline-state.mjs decision "<change>" route_choice "<route>"` 命令，将选择记录到状态文件

#### Scenario: route 选择持久化

- **WHEN** 状态文件已记录 route 选择
- **THEN** 后续 phase 执行时能够读取并使用该 route 配置

### Requirement: Route 评估时机

Route 评估必须在 Phase 0 的 Step 2（判断入口类型）之后、进入具体 phase 之前执行。对于续接已有 change 的场景，如果状态文件已包含 route 选择，则跳过评估步骤。

#### Scenario: 新 change 执行 route 评估

- **WHEN** 用户创建新 change 并进入 Phase 0
- **THEN** 系统在 Step 2 完成后执行 Route 评估步骤

#### Scenario: 续接 change 跳过 route 评估

- **WHEN** 用户续接已有 change 且状态文件已包含 `route.choice` 字段
- **THEN** 系统跳过 Route 评估步骤，直接使用已记录的 route

### Requirement: Route 推荐依据

AI 推荐 route 时必须基于以下依据：
- trivial：变更范围小、无行为变化、不影响 API 或配置语义
- standard：目标明确、风险可控、验证路径清晰
- full：高风险、涉及核心业务逻辑、需要完整验证和归档

#### Scenario: trivial route 推荐

- **WHEN** 用户需求描述为 typo 修复、格式化、注释修改、import 清理等
- **THEN** 系统推荐 trivial route，理由为"无行为变化的极小变更"

#### Scenario: standard route 推荐

- **WHEN** 用户需求描述为功能开发、Bug 修复、重构等
- **THEN** 系统推荐 standard route，理由为"标准变更，风险可控"

#### Scenario: full route 推荐

- **WHEN** 用户需求描述涉及核心业务逻辑、数据库迁移、安全相关变更
- **THEN** 系统推荐 full route，理由为"高保障变更，需要完整验证"
