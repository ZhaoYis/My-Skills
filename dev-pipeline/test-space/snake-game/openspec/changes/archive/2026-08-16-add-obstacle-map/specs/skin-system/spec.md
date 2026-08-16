## ADDED Requirements

### Requirement: 皮肤包含障碍物配色

系统 MUST 在每个皮肤定义中包含障碍物配色方案。

每个皮肤 MUST 包含以下 Canvas 配色字段：
- `obstacleBody`: 障碍物主体颜色
- `obstacleBorder`: 障碍物边框颜色
- `obstacleHighlight`: 障碍物高光颜色

#### Scenario: 经典皮肤障碍物配色

- **GIVEN** 当前皮肤为 `classic`
- **WHEN** 读取皮肤配置
- **THEN** `obstacleBody = '#475569'`（slate-600）
- **AND** `obstacleBorder = '#334155'`（slate-700）
- **AND** `obstacleHighlight = 'rgba(148,163,184,0.4)'`

#### Scenario: 复古皮肤障碍物配色

- **GIVEN** 当前皮肤为 `retro`
- **WHEN** 读取皮肤配置
- **THEN** `obstacleBody = '#854d0e'`（yellow-800）
- **AND** `obstacleBorder = '#713f12'`（yellow-900）
- **AND** `obstacleHighlight = 'rgba(253,224,71,0.3)'`

#### Scenario: 午夜皮肤障碍物配色

- **GIVEN** 当前皮肤为 `midnight`
- **WHEN** 读取皮肤配置
- **THEN** `obstacleBody = '#1e3a5f'`（深蓝）
- **AND** `obstacleBorder = '#0f172a'`（slate-900）
- **AND** `obstacleHighlight = 'rgba(96,165,250,0.3)'`

#### Scenario: 日落皮肤障碍物配色

- **GIVEN** 当前皮肤为 `sunset`
- **WHEN** 读取皮肤配置
- **THEN** `obstacleBody = '#9a3412'`（orange-800）
- **AND** `obstacleBorder = '#7c2d12'`（orange-900）
- **AND** `obstacleHighlight = 'rgba(253,186,116,0.3)'`

---

### Requirement: 皮肤切换时更新障碍物渲染

系统 MUST 在皮肤切换时立即更新障碍物渲染颜色。

#### Scenario: 游戏中切换皮肤

- **GIVEN** 游戏正在运行
- **AND** 地图上存在障碍物
- **WHEN** 用户切换皮肤
- **THEN** 障碍物立即使用新皮肤的配色渲染

#### Scenario: 游戏未开始时切换皮肤

- **GIVEN** 游戏未开始（显示开始覆盖层）
- **WHEN** 用户切换皮肤
- **THEN** 调用 `draw()` 重新渲染
- **AND** 障碍物（如果存在）使用新皮肤配色

---

### Requirement: 皮肤配置完整性

系统 MUST 确保所有现有皮肤都包含障碍物配色字段。

#### Scenario: 皮肤配置验证

- **GIVEN** 系统加载皮肤配置
- **WHEN** 检查所有皮肤定义
- **THEN** 每个皮肤都包含 `obstacleBody`、`obstacleBorder`、`obstacleHighlight` 字段
- **AND** 字段值不为 `undefined` 或 `null`

#### Scenario: 新增皮肤时必须包含障碍物配色

- **GIVEN** 开发者新增自定义皮肤
- **WHEN** 定义皮肤配置
- **THEN** MUST 包含障碍物配色字段
- **AND** 否则皮肤配置不完整
