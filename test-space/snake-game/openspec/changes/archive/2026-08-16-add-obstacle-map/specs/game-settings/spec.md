## ADDED Requirements

### Requirement: 设置面板包含障碍物开关

系统 MUST 在设置面板的"游戏"分组中提供障碍物开关。

#### Scenario: 设置面板显示障碍物开关

- **GIVEN** 用户打开设置面板
- **WHEN** 查看"游戏"分组
- **THEN** 显示"障碍物"开关
- **AND** 开关位于"网格线"开关下方

#### Scenario: 障碍物开关默认状态

- **GIVEN** 首次启动游戏
- **WHEN** 打开设置面板
- **THEN** 障碍物开关为开启状态（`showObstacles = true`）

#### Scenario: 切换障碍物开关

- **GIVEN** 用户在设置面板中
- **WHEN** 点击障碍物开关
- **THEN** `showObstacles` 值翻转
- **AND** 设置被持久化到 localStorage
- **AND** 开关状态立即更新

---

### Requirement: 设置持久化包含障碍物开关

系统 MUST 将障碍物开关状态持久化到 localStorage。

#### Scenario: 保存障碍物开关状态

- **GIVEN** 用户切换障碍物开关
- **WHEN** 设置被保存
- **THEN** `snake-settings` 中的 `showObstacles` 字段被更新

#### Scenario: 加载障碍物开关状态

- **GIVEN** localStorage 中存在 `snake-settings`
- **WHEN** 游戏启动并加载设置
- **THEN** `showObstacles` 从 localStorage 读取
- **AND** 设置面板显示正确的开关状态

#### Scenario: 向后兼容旧设置

- **GIVEN** localStorage 中存在旧的 `snake-settings`（无 `showObstacles` 字段）
- **WHEN** 游戏启动并加载设置
- **THEN** `showObstacles` 使用默认值 `true`
- **AND** 设置面板显示开关为开启状态

---

### Requirement: 默认设置包含障碍物开关

系统 MUST 在 `DEFAULT_SETTINGS` 中包含 `showObstacles` 字段。

#### Scenario: 默认设置定义

- **GIVEN** 系统初始化默认设置
- **WHEN** 读取 `DEFAULT_SETTINGS`
- **THEN** 包含 `showObstacles: true`

#### Scenario: 重置设置

- **GIVEN** 用户点击"重置设置"
- **WHEN** 设置被重置
- **THEN** `showObstacles` 恢复为 `true`
