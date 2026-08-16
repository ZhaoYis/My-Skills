## ADDED Requirements

### Requirement: AI 寻路排除障碍物

系统 MUST 在 AI 自动挂机模式下将障碍物视为不可通行的格子。

#### Scenario: AI 方向选择排除障碍物

- **GIVEN** AI 自动挂机模式启用（`autoPlayEnabled = true`）
- **WHEN** AI 计算最佳移动方向
- **THEN** 候选方向 MUST 排除障碍物格子
- **AND** 不会选择朝向障碍物的方向

#### Scenario: AI 洪水填充排除障碍物

- **GIVEN** AI 使用洪水填充评估可达空间
- **WHEN** 执行 `floodFillCount()` 函数
- **THEN** 障碍物格子被视为不可通行
- **AND** 洪水填充不会越过障碍物

#### Scenario: AI 避开障碍物区域

- **GIVEN** 蛇头前方有障碍物
- **WHEN** AI 评估移动方向
- **THEN** AI 选择绕开障碍物的路径
- **AND** 不会直接撞向障碍物

---

### Requirement: AI 安全判定包含障碍物

系统 MUST 在 AI 安全判定逻辑中包含障碍物检测。

#### Scenario: AI 判断格子安全性

- **GIVEN** AI 评估某个格子是否安全
- **WHEN** 检查格子状态
- **THEN** 障碍物格子被视为不安全
- **AND** 与墙壁、蛇身同等对待

#### Scenario: AI 多步预测考虑障碍物

- **GIVEN** AI 进行多步路径预测
- **WHEN** 预测未来位置
- **THEN** 预测路径 MUST 避开障碍物
- **AND** 不会预测穿过障碍物的路径

---

### Requirement: AI 与障碍物碰撞处理

系统 MUST 在 AI 模式下正确处理与障碍物的碰撞。

#### Scenario: AI 模式下撞障碍物

- **GIVEN** AI 自动挂机模式启用
- **WHEN** AI 选择的方向导致蛇头撞向障碍物
- **THEN** 触发碰撞处理
- **AND** 游戏结束（除非护盾激活）

#### Scenario: AI 应该避免的碰撞

- **GIVEN** AI 自动挂机模式启用
- **WHEN** AI 计算移动方向
- **THEN** AI MUST 优先避免撞向障碍物
- **AND** 障碍物碰撞优先级与墙壁相同

---

### Requirement: AI 空间评估考虑障碍物

系统 MUST 在 AI 评估可用空间时考虑障碍物的影响。

#### Scenario: AI 评估可达空间

- **GIVEN** AI 评估当前位置的可达空间
- **WHEN** 计算可达格子数量
- **THEN** 障碍物格子不计入可达空间
- **AND** 评估结果反映障碍物对空间的限制

#### Scenario: AI 选择空间更大的方向

- **GIVEN** AI 有多个可选方向
- **WHEN** 比较各方向的可达空间
- **THEN** AI 优先选择可达空间更大的方向
- **AND** 障碍物会减少某些方向的可达空间
