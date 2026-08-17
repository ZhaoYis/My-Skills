## Purpose

定义 `openspec/config.yaml` 中 `pipeline.routes` 配置的 schema 规范，包括三个内置 route（trivial/standard/full）的 phase 矩阵、字段定义和默认值。

## Requirements

### Requirement: Route 配置结构

`openspec/config.yaml` 必须支持 `pipeline.routes` 配置节点，包含三个预定义 route：`trivial`、`standard`、`full`。每个 route 必须包含 `description`（字符串）、`phases`（整数数组）字段。

#### Scenario: 有效 route 配置解析

- **WHEN** `openspec/config.yaml` 包含 `pipeline.routes.trivial`、`pipeline.routes.standard`、`pipeline.routes.full` 配置
- **THEN** 系统正确解析每个 route 的 `description` 和 `phases` 字段

#### Scenario: 缺少必需字段时报错

- **WHEN** route 配置缺少 `description` 或 `phases` 字段
- **THEN** 系统输出配置错误信息并终止执行

### Requirement: Phase 矩阵定义

每个 route 的 `phases` 字段必须声明该 route 执行的 phase 编号列表。`trivial` 必须包含 `[0, 2, 6]`，`standard` 必须包含 `[0, 1, 2, 5, 6]`，`full` 必须包含 `[0, 1, 2, 3, 4, 5, 6, 7]`。

#### Scenario: trivial route phase 矩阵

- **WHEN** 用户选择 `trivial` route
- **THEN** 系统仅执行 Phase 0（入口）、Phase 2（应用）、Phase 6（提交），跳过 Phase 1/3/4/5/7

#### Scenario: standard route phase 矩阵

- **WHEN** 用户选择 `standard` route
- **THEN** 系统执行 Phase 0/1/2/5/6，跳过 Phase 3/4/7

#### Scenario: full route phase 矩阵

- **WHEN** 用户选择 `full` route
- **THEN** 系统执行完整 Phase 0-7 流程

### Requirement: 默认 route 行为

当 `openspec/config.yaml` 未配置 `pipeline.routes` 或状态文件无 `route.choice` 字段时，系统必须默认使用 `full` route。

#### Scenario: 无配置时默认 full route

- **WHEN** `openspec/config.yaml` 不存在 `pipeline.routes` 配置
- **THEN** 系统使用 `full` route，执行完整 Phase 0-7 流程

#### Scenario: 旧状态文件兼容

- **WHEN** 状态文件（`.pipeline-state/<name>.json`）无 `route.choice` 字段
- **THEN** 系统默认使用 `full` route 继续执行

### Requirement: Route 配置验证

系统在初始化时必须验证 route 配置的合法性：`phases` 数组中的值必须在 0-7 范围内，且必须包含 Phase 0 和 Phase 6（入口和提交不可跳过）。

#### Scenario: 非法 phase 编号拒绝

- **WHEN** route 配置的 `phases` 包含小于 0 或大于 7 的值
- **THEN** 系统输出配置错误并终止执行

#### Scenario: 缺少必要 phase 拒绝

- **WHEN** route 配置的 `phases` 不包含 Phase 0 或 Phase 6
- **THEN** 系统输出配置错误并终止执行
