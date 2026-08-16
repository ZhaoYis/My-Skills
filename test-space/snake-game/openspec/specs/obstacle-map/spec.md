# obstacle-map Specification

## Purpose
TBD - created by archiving change add-obstacle-map. Update Purpose after archive.
## Requirements
### Requirement: 障碍物数据结构

系统 SHALL 维护一个 `obstacles` 数组，存储所有障碍物的坐标信息。

每个障碍物对象 MUST 包含以下字段：
- `x`: 障碍物的列坐标（0 到 COLS-1）
- `y`: 障碍物的行坐标（0 到 ROWS-1）

#### Scenario: 初始化空障碍物数组

- **GIVEN** 游戏刚启动
- **WHEN** 系统初始化
- **THEN** `obstacles` 数组为空数组 `[]`

#### Scenario: 障碍物数组在 initGame 时重置

- **GIVEN** 上一局游戏结束，`obstacles` 数组包含若干障碍物
- **WHEN** 调用 `initGame()` 开始新游戏
- **THEN** `obstacles` 数组被重置为空数组
- **AND** 随后根据难度配置生成新的障碍物

---

### Requirement: 障碍物生成时机

系统 MUST 在 `initGame()` 函数中生成障碍物，且仅在此时生成。

#### Scenario: 游戏初始化时生成障碍物

- **GIVEN** 用户点击"开始游戏"或"再来一局"
- **WHEN** `initGame()` 被调用
- **THEN** 系统根据当前难度配置生成障碍物
- **AND** 生成的障碍物存储到 `obstacles` 数组中
- **AND** 障碍物在游戏运行期间保持不变

#### Scenario: 游戏运行中不生成新障碍物

- **GIVEN** 游戏正在运行（`isRunning = true`）
- **WHEN** 游戏循环执行
- **THEN** 系统不会生成新的障碍物
- **AND** 现有障碍物位置保持不变

---

### Requirement: 障碍物数量计算

系统 SHALL 根据网格总面积和当前难度配置计算障碍物数量。

计算公式：
```
obstacleCount = max(obstacleMin, floor(totalCells / obstacleBase))
maxObstacles = floor(totalCells * 0.15)
finalCount = min(obstacleCount, maxObstacles)
```

其中：
- `totalCells = COLS * ROWS`
- `obstacleBase` 和 `obstacleMin` 来自当前难度配置
- 上限为总格数的 15%

#### Scenario: 简单模式无障碍物

- **GIVEN** 当前难度为 `easy`
- **WHEN** 计算障碍物数量
- **THEN** `obstacleBase = 0`
- **AND** 障碍物数量为 0

#### Scenario: 普通模式小地图

- **GIVEN** 当前难度为 `normal`
- **AND** 网格尺寸为 25×25（625 格）
- **WHEN** 计算障碍物数量
- **THEN** `obstacleCount = max(3, floor(625 / 800)) = max(3, 0) = 3`
- **AND** `maxObstacles = floor(625 * 0.15) = 93`
- **AND** 最终数量为 3

#### Scenario: 普通模式大地图

- **GIVEN** 当前难度为 `normal`
- **AND** 网格尺寸为 96×54（5184 格）
- **WHEN** 计算障碍物数量
- **THEN** `obstacleCount = max(3, floor(5184 / 800)) = max(3, 6) = 6`
- **AND** `maxObstacles = floor(5184 * 0.15) = 777`
- **AND** 最终数量为 6

#### Scenario: 困难模式大地图

- **GIVEN** 当前难度为 `hard`
- **AND** 网格尺寸为 96×54（5184 格）
- **WHEN** 计算障碍物数量
- **THEN** `obstacleCount = max(5, floor(5184 / 500)) = max(5, 10) = 10`
- **AND** `maxObstacles = floor(5184 * 0.15) = 777`
- **AND** 最终数量为 10

#### Scenario: 障碍物数量不超过上限

- **GIVEN** 当前难度配置计算出 `obstacleCount = 1000`
- **AND** 网格总面积为 5000 格
- **WHEN** 计算最终障碍物数量
- **THEN** `maxObstacles = floor(5000 * 0.15) = 750`
- **AND** 最终数量为 750（受上限约束）

---

### Requirement: 障碍物生成位置

系统 MUST 确保障碍物生成在空闲格子上，且不与蛇、食物、炸弹重叠。

#### Scenario: 障碍物不生成在蛇身上

- **GIVEN** 蛇占据若干格子
- **WHEN** 生成障碍物
- **THEN** 障碍物坐标不在蛇身的任何一节上

#### Scenario: 障碍物不生成在食物位置

- **GIVEN** 食物占据某个格子
- **WHEN** 生成障碍物
- **THEN** 障碍物坐标不在食物位置上

#### Scenario: 障碍物不生成在炸弹位置

- **GIVEN** 炸弹占据若干格子
- **WHEN** 生成障碍物
- **THEN** 障碍物坐标不在任何炸弹位置上

#### Scenario: 障碍物之间不重叠

- **GIVEN** 已生成若干障碍物
- **WHEN** 生成新的障碍物
- **THEN** 新障碍物坐标不与现有障碍物重叠

---

### Requirement: 出生点保护区

系统 MUST 在蛇的初始位置周围设置保护区，禁止在该区域内生成障碍物。

保护区范围：
- 以蛇头初始位置为中心
- 向右延伸 5 格（包含蛇头位置）
- 向上/下各延伸 1 格

#### Scenario: 蛇初始位置向右保护区

- **GIVEN** 蛇初始位置为 `(startX, startY)`，初始方向为右
- **WHEN** 生成障碍物
- **THEN** 障碍物不在以下区域内：
  - `x ∈ [startX, startX+5]`
  - `y ∈ [startY-1, startY+1]`

#### Scenario: 保护区不超出地图边界

- **GIVEN** 蛇初始位置靠近地图右边界
- **WHEN** 计算保护区范围
- **THEN** 保护区右边界不超过 `COLS-1`
- **AND** 保护区上/下边界不超过 `ROWS-1` / 不低于 `0`

---

### Requirement: 连通性校验

系统 MUST 在生成障碍物后验证地图的连通性，确保蛇能够到达至少 60% 的非障碍物格子。

校验算法：
1. 使用洪水填充（flood fill）从蛇头位置开始
2. 计算可达的非障碍物格子数量
3. 计算所有非障碍物格子总数
4. 验证：`可达格子数 >= 非障碍物总数 * 0.6`

#### Scenario: 连通性校验通过

- **GIVEN** 生成障碍物后
- **WHEN** 执行连通性校验
- **AND** 蛇头可达格子数 >= 非障碍物总数 * 0.6
- **THEN** 校验通过
- **AND** 障碍物布局被接受

#### Scenario: 连通性校验失败

- **GIVEN** 生成障碍物后
- **WHEN** 执行连通性校验
- **AND** 蛇头可达格子数 < 非障碍物总数 * 0.6
- **THEN** 校验失败
- **AND** 系统重新生成障碍物（最多重试 5 次）

#### Scenario: 连通性校验重试上限

- **GIVEN** 连通性校验已连续失败 5 次
- **WHEN** 第 6 次校验仍然失败
- **THEN** 系统放弃生成障碍物
- **AND** `obstacles` 数组保持为空

#### Scenario: 洪水填充排除障碍物

- **GIVEN** 执行洪水填充算法
- **WHEN** 遍历相邻格子
- **THEN** 障碍物格子被视为不可通行
- **AND** 洪水填充不会越过障碍物

---

### Requirement: 障碍物碰撞检测

系统 MUST 在蛇移动时检测蛇头是否与障碍物碰撞。

#### Scenario: 蛇头撞到障碍物

- **GIVEN** 蛇正在移动
- **WHEN** 蛇头新位置与某个障碍物坐标相同
- **THEN** 触发碰撞处理
- **AND** 游戏结束（除非护盾激活）

#### Scenario: 护盾激活时撞障碍物

- **GIVEN** 蛇正在移动
- **AND** 护盾处于激活状态（`shieldActive = true`）
- **WHEN** 蛇头新位置与某个障碍物坐标相同
- **THEN** 护盾消耗（`shieldActive = false`）
- **AND** 蛇方向反转
- **AND** 游戏继续

#### Scenario: 蛇身撞到障碍物

- **GIVEN** 蛇正在移动
- **WHEN** 蛇身（非蛇头）某节与障碍物坐标相同
- **THEN** 不触发碰撞
- **AND** 游戏继续

---

### Requirement: 障碍物占用查询

系统 SHALL 提供 `cellIsOccupiedByObstacle(cell)` 函数，用于查询指定格子是否被障碍物占据。

#### Scenario: 查询被障碍物占据的格子

- **GIVEN** 坐标 `(x, y)` 处有障碍物
- **WHEN** 调用 `cellIsOccupiedByObstacle({x, y})`
- **THEN** 返回 `true`

#### Scenario: 查询未被障碍物占据的格子

- **GIVEN** 坐标 `(x, y)` 处没有障碍物
- **WHEN** 调用 `cellIsOccupiedByObstacle({x, y})`
- **THEN** 返回 `false`

---

### Requirement: 食物生成排除障碍物

系统 MUST 在生成食物时排除被障碍物占据的格子。

#### Scenario: 食物不生成在障碍物上

- **GIVEN** 若干格子被障碍物占据
- **WHEN** 系统生成新食物
- **THEN** 食物坐标不在任何障碍物位置上

#### Scenario: 食物生成时空格判定

- **GIVEN** 调用 `spawnFood()` 函数
- **WHEN** 判断某格子是否为空
- **THEN** 空格判定 MUST 包含：
  - 不在蛇身上
  - 不在炸弹上
  - 不在障碍物上

---

### Requirement: 炸弹生成排除障碍物

系统 MUST 在生成炸弹时排除被障碍物占据的格子。

#### Scenario: 炸弹不生成在障碍物上

- **GIVEN** 若干格子被障碍物占据
- **WHEN** 系统生成新炸弹
- **THEN** 炸弹坐标不在任何障碍物位置上

#### Scenario: 炸弹生成时空格判定

- **GIVEN** 调用 `spawnBomb()` 函数
- **WHEN** 判断某格子是否为空
- **THEN** 空格判定 MUST 包含：
  - 不在蛇身上
  - 不在食物上
  - 不在其他炸弹上
  - 不在障碍物上

---

### Requirement: 障碍物渲染

系统 SHALL 在 Canvas 上渲染障碍物，使用当前皮肤的配色方案。

渲染层级：
1. 背景
2. 网格线
3. **障碍物**
4. 食物
5. 炸弹
6. 爆炸效果
7. 蛇

#### Scenario: 障碍物在网格线之后渲染

- **GIVEN** 游戏正在运行
- **WHEN** 执行 `draw()` 函数
- **THEN** 障碍物在网格线绘制之后渲染
- **AND** 障碍物在食物绘制之前渲染

#### Scenario: 障碍物使用皮肤配色

- **GIVEN** 当前皮肤为 `classic`
- **WHEN** 渲染障碍物
- **THEN** 障碍物主体颜色为 `obstacleBody`
- **AND** 障碍物边框颜色为 `obstacleBorder`
- **AND** 障碍物高光颜色为 `obstacleHighlight`

#### Scenario: 障碍物渲染样式

- **GIVEN** 渲染某个障碍物
- **WHEN** 绘制该障碍物
- **THEN** 使用 `fillRect` 绘制主体
- **AND** 使用 `strokeRect` 绘制边框
- **AND** 使用 `fillRect` 绘制左上角高光

---

### Requirement: 设置开关控制障碍物

系统 SHALL 提供设置开关，允许用户启用或禁用障碍物。

#### Scenario: 设置开关默认启用

- **GIVEN** 首次启动游戏
- **WHEN** 加载设置
- **THEN** `showObstacles` 默认为 `true`

#### Scenario: 关闭障碍物开关

- **GIVEN** 用户在设置面板中
- **WHEN** 点击"障碍物"开关
- **THEN** `showObstacles` 变为 `false`
- **AND** 设置被持久化到 localStorage

#### Scenario: 新局读取设置开关

- **GIVEN** `showObstacles = false`
- **WHEN** 调用 `initGame()` 生成障碍物
- **THEN** 障碍物数量为 0
- **AND** `obstacles` 数组为空

#### Scenario: 当局不受开关影响

- **GIVEN** 游戏正在运行
- **AND** 当局已生成障碍物
- **WHEN** 用户在设置中关闭障碍物开关
- **THEN** 当局障碍物保持不变
- **AND** 开关仅在下一局生效

---

### Requirement: 游戏结束提示

系统 SHALL 在蛇撞到障碍物死亡时显示特定的游戏结束提示。

#### Scenario: 撞障碍物死亡提示

- **GIVEN** 蛇头撞到障碍物
- **WHEN** 游戏结束
- **THEN** 显示"💥 撞障碍物了!"
- **AND** 与撞墙、撞炸弹的提示区分

