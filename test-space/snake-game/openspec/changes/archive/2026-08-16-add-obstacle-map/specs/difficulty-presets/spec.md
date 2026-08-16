## ADDED Requirements

### Requirement: 难度预设包含障碍物配置

系统 MUST 在每个难度预设中包含障碍物生成相关配置。

每个难度预设 MUST 包含以下字段：
- `obstacleBase`: 障碍物密度基数（用于计算障碍物数量）
- `obstacleMin`: 障碍物最小数量

#### Scenario: 简单模式障碍物配置

- **GIVEN** 当前难度为 `easy`
- **WHEN** 读取难度预设
- **THEN** `obstacleBase = 0`
- **AND** `obstacleMin = 0`
- **AND** 障碍物数量为 0

#### Scenario: 普通模式障碍物配置

- **GIVEN** 当前难度为 `normal`
- **WHEN** 读取难度预设
- **THEN** `obstacleBase = 800`
- **AND** `obstacleMin = 3`

#### Scenario: 困难模式障碍物配置

- **GIVEN** 当前难度为 `hard`
- **WHEN** 读取难度预设
- **THEN** `obstacleBase = 500`
- **AND** `obstacleMin = 5`

---

### Requirement: 难度切换时重置障碍物

系统 MUST 在难度切换时重置障碍物状态。

#### Scenario: 游戏中切换难度

- **GIVEN** 游戏正在运行
- **WHEN** 用户在设置中切换难度
- **THEN** 当前局的障碍物保持不变
- **AND** 下一局开始时使用新难度的障碍物配置

#### Scenario: 切换为简单模式

- **GIVEN** 当前难度为 `normal` 或 `hard`
- **WHEN** 用户切换为 `easy` 难度
- **THEN** 下一局开始时 `obstacleBase = 0`
- **AND** 不生成任何障碍物

#### Scenario: 切换为困难模式

- **GIVEN** 当前难度为 `easy` 或 `normal`
- **WHEN** 用户切换为 `hard` 难度
- **THEN** 下一局开始时 `obstacleBase = 500`
- **AND** 障碍物最小数量为 5
