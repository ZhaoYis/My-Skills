# Tasks

## 1. 数据结构与配置

- [x] 1.1 在 `index.html` 中添加 `let obstacles = []` 全局变量（与 `bombs` 同级）
- [x] 1.2 在 `DEFAULT_SETTINGS` 中添加 `showObstacles: true` 字段
- [x] 1.3 在 `DIFFICULTY_PRESETS` 中为每个难度添加 `obstacleBase` 和 `obstacleMin` 字段：
  - `easy`: `obstacleBase: 0, obstacleMin: 0`
  - `normal`: `obstacleBase: 800, obstacleMin: 3`
  - `hard`: `obstacleBase: 500, obstacleMin: 5`
- [x] 1.4 在 `SKINS` 的每个皮肤中添加障碍物配色字段：
  - `classic`: `obstacleBody: '#475569'`, `obstacleBorder: '#334155'`, `obstacleHighlight: 'rgba(148,163,184,0.4)'`
  - `retro`: `obstacleBody: '#854d0e'`, `obstacleBorder: '#713f12'`, `obstacleHighlight: 'rgba(253,224,71,0.3)'`
  - `midnight`: `obstacleBody: '#1e3a5f'`, `obstacleBorder: '#0f172a'`, `obstacleHighlight: 'rgba(96,165,250,0.3)'`
  - `sunset`: `obstacleBody: '#9a3412'`, `obstacleBorder: '#7c2d12'`, `obstacleHighlight: 'rgba(253,186,116,0.3)'`

## 2. 障碍物核心函数

- [x] 2.1 实现 `cellIsOccupiedByObstacle(cell)` 函数：查询指定格子是否被障碍物占据
- [x] 2.2 实现 `calcObstacleCount()` 函数：根据网格面积和难度配置计算障碍物数量
  - 公式：`max(obstacleMin, floor(totalCells / obstacleBase))`
  - 上限：`floor(totalCells * 0.15)`
  - 如果 `showObstacles = false` 或 `obstacleBase = 0`，返回 0
- [x] 2.3 实现 `generateObstacles()` 函数：生成障碍物数组
  - 调用 `calcObstacleCount()` 获取数量
  - 随机选择空闲格子（排除蛇、食物、炸弹、已有障碍物）
  - 排除出生点保护区（蛇头右侧 5 格，上下各 1 格）
  - 最多重试 5 次，失败后清空数组

## 3. 连通性校验

- [x] 3.1 实现 `validateObstacleConnectivity(obstacles)` 函数：验证障碍物布局的连通性
  - 使用洪水填充从蛇头位置开始
  - 计算可达的非障碍物格子数量
  - 验证：`可达格子数 >= 非障碍物总数 * 0.6`
- [x] 3.2 修改 `floodFillCount()` 函数：在洪水填充算法中排除障碍物格子
  - 遍历时跳过障碍物格子
  - 障碍物被视为不可通行

## 4. 游戏初始化集成

- [x] 4.1 在 `initGame()` 函数中调用障碍物生成逻辑：
  - 在蛇初始化之后、食物生成之前
  - 调用 `generateObstacles()` 生成障碍物
  - 如果连通性校验失败，重试或清空数组
- [x] 4.2 在 `initGame()` 中重置 `obstacles = []`（每局开始时清空）

## 5. 碰撞检测与占用查询

- [x] 5.1 在 `update()` 函数中添加障碍物碰撞检测：
  - 在计算新蛇头位置后
  - 检查蛇头是否与障碍物碰撞
  - 如果碰撞且护盾未激活，触发 `gameOver()`
  - 如果碰撞且护盾激活，消耗护盾并反转方向
- [x] 5.2 修改 `spawnFood()` 函数：在空格判定中添加 `!cellIsOccupiedByObstacle(cell)`
- [x] 5.3 修改 `spawnBomb()` 函数：在空格判定中添加 `!cellIsOccupiedByObstacle(cell)`

## 6. 渲染系统

- [x] 6.1 实现 `drawObstacles()` 函数：渲染所有障碍物
  - 使用 `fillRect()` 绘制主体（颜色：`currentSkin.canvas.obstacleBody`）
  - 使用 `strokeRect()` 绘制边框（颜色：`currentSkin.canvas.obstacleBorder`）
  - 使用 `fillRect()` 绘制左上角高光（颜色：`currentSkin.canvas.obstacleHighlight`）
- [x] 6.2 在 `draw()` 函数中调用 `drawObstacles()`：
  - 在网格线绘制之后
  - 在食物绘制之前

## 7. AI 挂机模式适配

- [x] 7.1 修改 `getAIDirection()` 函数：在候选方向过滤中排除障碍物格子
  - 在检查墙壁和蛇身后，添加障碍物检查
  - 如果候选方向指向障碍物，跳过该方向
- [x] 7.2 修改 `floodFillCount()` 函数：在洪水填充中排除障碍物（已在 3.2 中完成）
- [x] 7.3 验证 AI 在障碍物地图上的行为：
  - AI 能够绕开障碍物
  - AI 不会直接撞向障碍物

## 8. 设置面板集成

- [x] 8.1 在设置面板 HTML 中添加"障碍物"开关：
  - 位置：在"网格线"开关下方
  - ID：`toggleObstacles`
  - 样式：与"网格线"开关一致
- [x] 8.2 实现开关事件处理：
  - 点击开关时切换 `currentSettings.showObstacles`
  - 调用 `SettingsStore.save()` 持久化设置
  - 更新开关 UI 状态
- [x] 8.3 在 `refreshPanelUI()` 函数中更新障碍物开关状态：
  - 读取 `currentSettings.showObstacles`
  - 设置开关的 active 状态

## 9. 游戏结束提示

- [x] 9.1 在 `gameOver()` 函数中添加障碍物碰撞的死亡原因：
  - 新增 `reason = 'obstacle'` 参数
  - 显示"💥 撞障碍物了!"提示
  - 与撞墙、撞炸弹的提示区分

## 10. 测试与验证

- [x] 10.1 测试简单模式：确认不生成障碍物
- [x] 10.2 测试普通/困难模式：确认障碍物数量符合公式
- [x] 10.3 测试碰撞检测：确认撞障碍物触发游戏结束
- [x] 10.4 测试护盾交互：确认护盾激活时撞障碍物不死亡
- [x] 10.5 测试食物/炸弹生成：确认不在障碍物上生成
- [x] 10.6 测试连通性校验：确认蛇可达至少 60% 非障碍格
- [x] 10.7 测试设置开关：确认关闭后新局无障碍
- [x] 10.8 测试 AI 挂机模式：确认 AI 能绕开障碍物
- [x] 10.9 测试皮肤切换：确认障碍物颜色随皮肤变化
- [x] 10.10 测试不同分辨率：确认障碍物数量随面积变化
