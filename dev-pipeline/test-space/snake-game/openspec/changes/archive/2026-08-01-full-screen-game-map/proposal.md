# 提案：贪吃蛇全屏地图

## Why

当前贪吃蛇游戏地图为固定 25×25 网格（500×500px），居中显示在页面中央。在桌面端大屏幕（1920×1080 及以上）上，游戏区域仅占视口面积的约 12%，大量屏幕空间被浪费；在移动端，固定 500px 宽度在小屏设备（375px 宽）上导致页面溢出或缩放问题。本次变更将游戏地图升级为全屏自适应布局，使游戏在不同设备上都能充分利用屏幕空间，同时保留经典贪吃蛇的离散网格和四方向移动核心手感。

## What Changes

- Canvas 布局从固定 500×500px 改为铺满浏览器视口，消除页面滚动条和边距
- 网格尺寸从编译时常量（COLS=25, ROWS=25）改为运行时根据视口动态计算（CELL_SIZE 保持 20px）
- 顶部得分面板和底部工具栏改造为半透明浮动 HUD，叠加在 Canvas 之上，支持自动淡化
- 食物数量从固定 1 个改为按地图面积动态调整：`foodCount = max(1, floor(totalCells / 400))`
- 炸弹最大数量按地图面积平方根缩放，保持不同屏幕尺寸下的威胁密度
- 开始/排行榜/游戏结束/暂停覆盖层适配全屏尺寸
- D-pad 方向键改为 Canvas 区域内浮动定位（仅触摸设备显示）
- 窗口 resize 处理：游戏中锁定当前网格并居中显示，新游戏开始时重新计算
- 移除未使用的 `GRID_SIZE` 常量；`COLS`/`ROWS` 从 `const` 改为 `let`

## Capabilities

### New Capabilities

- `fullscreen-layout`: 全屏布局系统 — Canvas 铺满浏览器视口，半透明浮动顶栏（得分/时间/护盾状态）和底栏（设置/静音/帮助按钮），覆盖层（开始/暂停/结束/排行榜/设置面板）适配全屏，D-pad 画布内浮动定位（仅触摸设备），HUD 自动淡化机制
- `dynamic-grid`: 动态网格系统 — 根据视口尺寸计算网格行列数（COLS/ROWS），固定 CELL_SIZE=20px，游戏中 resize 锁定网格并居中显示（Letterbox），新游戏开始时重新计算网格，食物和炸弹数量按地图面积自适应缩放

### Modified Capabilities

无。现有能力模块（skin-system、bomb-system、difficulty-presets、game-settings、leaderboard、timed-mode、beginner-tutorial、pixel-welcome-screen、explosion-sound）的规格级行为不变。

## Impact

### 代码模块影响

- **CSS 布局**：`body`、`.container`、`.header`、`.canvas-wrapper`、`canvas`、`.skin-selector`、`.controls-info`、`.dpad` 样式重构
- **HTML 结构**：header 和 bottom toolbar 从 `.container` 内移到 `body` 级浮动层；覆盖层布局调整
- **JavaScript 常量**：`COLS`/`ROWS` 改为 `let`；移除 `GRID_SIZE`；新增视口计算和 resize 处理逻辑
- **Canvas 渲染**：`draw()` 函数中的背景填充和网格线绘制适配动态尺寸
- **游戏逻辑**：`spawnFood()` 支持多食物；`BOMB_CONFIG.maxBombs` 动态赋值

### UI/UX 影响

- **布局变化**：从"页面居中固定方块"变为"Canvas 铺满全屏 + 浮动 HUD"，视觉冲击力显著增强
- **交互流程**：开始→欢迎界面→开始覆盖层→游戏→结束覆盖层的流程不变，但覆盖层变为全屏
- **视觉风格**：HUD 半透明化 + 自动淡化，减少 UI 对游戏的遮挡；皮肤系统的配色和风格不受影响

### 浏览器/设备兼容性

- **桌面端（≥601px）**：键盘操作不变；HUD 始终可见（不自动淡化），控件提示保留
- **移动端（≤600px）**：D-pad 浮动显示；HUD 可自动淡化以增加游戏可见区域；触摸滑动方向控制不变

### 游戏平衡性影响

- **非破坏性**：蛇速曲线、得分规则、道具概率、难度预设值均不变
- **可感知变化**：大屏幕上蛇到达边界需要更长时间（地图更大），这被视为大屏"奖励"而非平衡问题
- **自适应补偿**：食物和炸弹数量随面积增加，保持探索密度和威胁感

### 破坏性变更

无。localStorage 数据结构和键名不变，CSS 变量名不变，现有功能行为不变。
