## Purpose

定义状态管理脚本的 Route 执行控制机制，包括 transition 命令的路由逻辑、route 升级机制、状态文件扩展和向后兼容处理。

## Requirements

### Requirement: Transition 路由控制

`dev-pipeline-state.mjs` 的 `transition` 命令必须根据当前 route 配置验证目标 phase 是否允许执行。如果目标 phase 不在当前 route 的 `phases` 列表中，系统必须拒绝跳转并返回错误。

#### Scenario: 允许跳转到 route 内的 phase

- **WHEN** 当前 route 为 `trivial`（phases: [0, 2, 6]），执行 `transition 2 6`
- **THEN** 系统允许跳转，更新状态到 Phase 2 Step 6

#### Scenario: 拒绝跳转到 route 外的 phase

- **WHEN** 当前 route 为 `trivial`（phases: [0, 2, 6]），执行 `transition 3 9`
- **THEN** 系统返回错误 `phase-not-in-route`，拒绝跳转

#### Scenario: full route 允许所有 phase

- **WHEN** 当前 route 为 `full`（phases: [0-7]）
- **THEN** 系统允许跳转到任意 phase（0-7）

### Requirement: Route 升级机制

系统必须支持在流程执行过程中升级 route（trivial → standard → full）。升级时必须更新状态文件的 `route.choice` 字段，记录升级历史到 `route.upgradedFrom` 和 `route.upgradedAt` 字段，并立即生效新的 phase 矩阵。

#### Scenario: 从 trivial 升级到 standard

- **WHEN** 当前 route 为 `trivial`，执行 `route upgrade standard`
- **THEN** 系统更新 `route.choice` 为 `standard`，记录 `route.upgradedFrom` 为 `trivial`，记录 `route.upgradedAt` 为当前时间戳

#### Scenario: 从 standard 升级到 full

- **WHEN** 当前 route 为 `standard`，执行 `route upgrade full`
- **THEN** 系统更新 `route.choice` 为 `full`，记录升级历史

#### Scenario: 禁止降级 route

- **WHEN** 当前 route 为 `full`，执行 `route upgrade standard`
- **THEN** 系统返回错误 `route-downgrade-not-allowed`，拒绝降级

#### Scenario: 升级后立即生效

- **WHEN** route 从 `trivial` 升级到 `standard` 后，执行 `transition 1 3`
- **THEN** 系统允许跳转到 Phase 1（standard route 包含 Phase 1）

### Requirement: 状态文件扩展

状态文件（`.pipeline-state/<name>.json`）必须新增 `route` 字段，包含 `choice`（字符串）、`upgradedFrom`（字符串或 null）、`upgradedAt`（时间戳或 null）三个子字段。

#### Scenario: 新状态文件包含 route 字段

- **WHEN** 创建新 change 并选择 route
- **THEN** 状态文件包含 `route: { choice: "<route>", upgradedFrom: null, upgradedAt: null }`

#### Scenario: 升级后状态文件记录历史

- **WHEN** route 从 `trivial` 升级到 `standard`
- **THEN** 状态文件包含 `route: { choice: "standard", upgradedFrom: "trivial", upgradedAt: "<timestamp>" }`

### Requirement: 向后兼容处理

对于未包含 `route` 字段的旧状态文件，系统必须默认使用 `full` route，并确保所有 phase 跳转正常执行。

#### Scenario: 旧状态文件默认 full route

- **WHEN** 读取的状态文件无 `route` 字段
- **THEN** 系统使用 `full` route 配置，允许所有 phase 跳转

#### Scenario: 旧状态文件可升级 route

- **WHEN** 旧状态文件无 `route` 字段，执行 `route upgrade standard`
- **THEN** 系统初始化 `route` 字段，设置 `choice` 为 `standard`，`upgradedFrom` 为 `full`

### Requirement: Route 升级命令

`dev-pipeline-state.mjs` 必须新增 `route upgrade <target-route>` 命令，用于在流程执行过程中升级 route。

#### Scenario: 执行 route upgrade 命令

- **WHEN** 执行 `dev-pipeline-state.mjs route upgrade standard`
- **THEN** 系统验证升级合法性（不允许降级），更新状态文件，返回成功状态

#### Scenario: 升级命令参数验证

- **WHEN** 执行 `dev-pipeline-state.mjs route upgrade invalid-route`
- **THEN** 系统返回错误 `invalid-route-name`，拒绝执行

#### Scenario: 升级命令输出

- **WHEN** route 升级成功
- **THEN** 系统输出 JSON 包含 `status: "ok"`、`route`（升级后的完整 route 对象）
