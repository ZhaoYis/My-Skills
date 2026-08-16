## Why

当前游戏地图为全屏动态网格，仅由"背景 + 可选网格线"构成，没有任何静态地形元素。所有动态威胁（炸弹）每局随机生成，但缺乏长期空间约束，地图视觉与玩法策略深度均偏弱。本次变更在现有全屏动态网格之上叠加一层**静态障碍物**，作为"基础地图"之上的"障碍地图"，在不引入新模式的前提下提升空间规划与路径选择的策略性。

## What Changes

- 新增 `obstacles` 数组与相关占用检测函数，障碍物在 `initGame()` 阶段一次性随机生成，整局不变
- 难度预设新增 `obstacleBase`/`obstacleMin` 字段，简单模式无障碍，普通/困难模式按网格面积比例生成
- 设置面板新增"障碍物"开关，持久化到 `snake-settings`，仅新局生效
- `draw()` 新增障碍物渲染层（位于网格线之后、食物之前），使用当前皮肤的障碍物配色
- AI 挂机模式 `getAIDirection()` 与 `floodFillCount()` 将障碍物视为不可通行
- 皮肤系统 4 个皮肤（classic/retro/midnight/sunset）各新增 `obstacleBody`、`obstacleBorder`、`obstacleHighlight` 配色字段
- 碰撞行为：蛇头进入障碍格时触发 `gameOver(false, 'obstacle')`，护盾可抵挡

**UI/UX 影响**：
- 设置面板"🎮 游戏"分区新增"障碍物"开关（与"网格线"开关并列）
- 游戏画布新增障碍物视觉元素（深灰色方块，带边框和高光）
- 游戏结束界面新增"💥 撞障碍物了!"死亡原因提示

**浏览器/设备兼容性**：
- 与现有游戏一致，支持 Chrome/Firefox/Safari/Edge 最新两个版本
- 支持 iOS Safari / Android Chrome 移动端
- 障碍物渲染使用 Canvas 2D API（`fillRect`/`strokeRect`），无额外兼容性风险

## Capabilities

### New Capabilities

- `obstacle-map`: 障碍物核心系统——生成、碰撞检测、占用查询、渲染、连通性校验

### Modified Capabilities

- `difficulty-presets`: 难度预设新增 `obstacleBase` 和 `obstacleMin` 字段，控制障碍物密度
- `game-settings`: 设置面板新增"障碍物"开关，`DEFAULT_SETTINGS` 新增 `showObstacles: true`
- `skin-system`: 4 个皮肤各新增 3 个障碍物配色字段（`obstacleBody`/`obstacleBorder`/`obstacleHighlight`）
- `auto-play`: AI 挂机模式的 `getAIDirection()` 和 `floodFillCount()` 必须将障碍物视为不可通行

## Impact

- **代码**：`index.html` 单文件，涉及游戏引擎（`initGame`/`update`/`draw`）、AI 引擎（`getAIDirection`/`floodFillCount`）、设置系统（`SettingsStore`/`DEFAULT_SETTINGS`/设置面板 HTML）、难度预设（`DIFFICULTY_PRESETS`）、皮肤系统（`SKINS`）
- **API**：不涉及后端 API
- **依赖**：无新增外部依赖
- **数据**：`snake-settings` localStorage key 新增 `showObstacles` 字段，向后兼容（`Object.assign` 自动填充默认值）
