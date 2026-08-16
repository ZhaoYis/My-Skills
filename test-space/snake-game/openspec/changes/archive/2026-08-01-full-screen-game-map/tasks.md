# 任务清单

## 1. CSS 布局重构（基础设施）

- [x] 1.1 修改 `body` 样式：移除 flex 居中布局，设置 `width: 100vw; height: 100vh; overflow: hidden; margin: 0;`
- [x] 1.2 修改 `.container` 样式：移除 flex 列布局和 padding，改为 `position: relative; width: 100vw; height: 100vh;`
- [x] 1.3 修改 `.canvas-wrapper` 样式：移除固定圆角和阴影，改为 `position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 0;`
- [x] 1.4 修改 `canvas` CSS：添加 `position: absolute; top: 0; left: 0;`，移除固定尺寸依赖
- [x] 1.5 移除 `.header`、`.controls-info`（桌面键盘提示）的旧布局样式，准备改为浮动层
- [ ] 1.6 验证：页面加载后 Canvas 铺满视口，无滚动条、无边距

**完成标准**：桌面端和移动端打开页面，Canvas 占据整个视口，背景色正确填充。

## 2. 网格动态计算模块

- [x] 2.1 将 `COLS`、`ROWS` 从 `const` 改为 `let`；移除未使用的 `GRID_SIZE` 常量
- [x] 2.2 新增 `calcGrid()` 函数：`COLS = clamp(floor(viewportW / CELL_SIZE), 15, 120)`，`ROWS = clamp(floor(viewportH / CELL_SIZE), 20, 80)`
- [x] 2.3 新增 `setCanvasSize()` 函数：基于 COLS/ROWS/CELL_SIZE 设置 Canvas 物理尺寸、CSS 尺寸、DPR 缩放
- [x] 2.4 修改 `initGame()` 函数：在初始化蛇、食物、炸弹前调用 `calcGrid()` 和 `setCanvasSize()`
- [ ] 2.5 验证：不同分辨率（1920×1080、375×667）下网格尺寸计算正确

**完成标准**：
1. 桌面端打开页面 → 开始游戏 → F12 控制台打印 COLS/ROWS 值符合预期
2. 调整窗口大小 → 开始新游戏 → 网格尺寸随视口变化

## 3. resize 处理模块

- [x] 3.1 新增 `handleResize()` 函数：检查 `isRunning` 状态 → 锁定或重算
- [x] 3.2 实现 debounce（200ms）：使用 `ResizeObserver` 监听 `document.documentElement`，debounce 后调用 `handleResize()`
- [x] 3.3 实现 Letterbox 效果：`applyLetterbox()` 函数 → Canvas CSS 居中 + body 背景色填充
- [x] 3.4 在 `initGame()` 和 `startGameLoop()` 中注册 ResizeObserver
- [ ] 3.5 桌面端验证：开始游戏 → 拖拽窗口边缘缩小 → Canvas 保持原尺寸居中，四周填充背景色
- [ ] 3.6 移动端验证：开始游戏 → 旋转设备 → 网格锁定，Canvas 居中

**完成标准**：
1. 游戏中 resize 窗口 → Canvas 不改变尺寸，棋盘居中，四周有背景色
2. 覆盖层显示时 resize → 网格重算，覆盖层适配新视口

## 4. 浮动 HUD 实现

- [x] 4.1 创建顶栏 HTML 结构（`.hud-top`）：得分（左）、计时器（中，仅计时模式）、护盾状态（右）
- [x] 4.2 创建底栏 HTML 结构（`.hud-bottom`）：帮助按钮、静音按钮、设置按钮，水平居中排列
- [x] 4.3 顶栏 CSS：`position: fixed; top: 0; left: 0; right: 0; height: 48px; background: rgba(15,23,42,0.6); backdrop-filter: blur(8px); z-index: 100;`
- [x] 4.4 底栏 CSS：`position: fixed; bottom: 0; left: 0; right: 0; height: 48px;` + 同顶栏背景样式
- [x] 4.5 移动端适配：顶栏/底栏高度 56px，按钮最小触摸区域 44px
- [x] 4.6 HUD 自动淡化逻辑：5 秒无交互 → opacity 0.4；鼠标移动/触摸 → opacity 1（CSS transition 0.5s）
- [x] 4.7 将现有 score/bestScore/timer/shieldIndicator 的数据更新逻辑绑定到新 HUD 元素
- [x] 4.8 将现有 muteBtn/settingsBtn/helpBtn 的事件处理绑定到新底栏按钮
- [ ] 4.9 验证：桌面端 HUD 正常显示；移动端 HUD 适配；自动淡化生效

**完成标准**：
1. 游戏中顶栏显示得分和时间，底栏按钮可点击
2. 5 秒不动鼠标 → HUD 半透明；移动鼠标 → HUD 恢复
3. 移动端 HUD 尺寸更大，按钮可触摸

## 5. D-pad 浮动化

- [x] 5.1 修改 `.dpad` CSS：`position: fixed; bottom: 80px; right: 20px; z-index: 101; opacity: 0.5;`
- [x] 5.2 D-pad 触摸反馈：`touchstart` → opacity 0.9；`touchend` → opacity 0.5
- [x] 5.3 保留仅触摸设备显示的媒体查询逻辑
- [x] 5.4 D-pad 区域内触摸事件 `stopPropagation()`，防止触发 Canvas 滑动手势
- [ ] 5.5 桌面端验证：键盘操作正常，D-pad 不显示
- [ ] 5.6 移动端验证：D-pad 显示在右下角，方向控制正常，不触发 Canvas 滑动

**完成标准**：
1. 移动端 → D-pad 浮动在右下角，半透明，触摸时变亮
2. 移动端 → D-pad 操作与 Canvas 滑动不冲突

## 6. 覆盖层全屏适配

- [x] 6.1 修改 `.overlay` CSS：`position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 200;`
- [x] 6.2 确保开始覆盖层内容（模式卡片、开始按钮、昵称输入）在全屏下居中
- [x] 6.3 确保排行榜覆盖层内容（排行榜面板）在全屏下居中
- [x] 6.4 确保游戏结束覆盖层内容在全屏下居中
- [x] 6.5 确保设置面板覆盖层在全屏下居中
- [ ] 6.6 验证：各覆盖层打开时覆盖整个视口，内容居中，背景半透明可透视

**完成标准**：
1. 每个覆盖层（开始/排行榜/结束/设置）全屏覆盖，内容居中
2. 覆盖层关闭后 HUD 和游戏 Canvas 正常显示

## 7. 游戏平衡自适应

- [x] 7.1 新增 `calcFoodCount()` 函数：`max(1, floor(COLS * ROWS / 400))`
- [ ] 7.2 修改 `spawnFood()` 函数：支持生成多个食物（`foodCount` 个），每个食物独立随机位置
- [x] 7.3 新增 `calcMaxBombs()` 函数：`floor(difficultyMaxBombs * sqrt(COLS * ROWS / 625))`
- [x] 7.4 修改 `BOMB_CONFIG.maxBombs` 赋值：从常量改为 `calcMaxBombs()` 动态赋值
- [ ] 7.5 验证：25×25 网格 → 1 食物 + 6 炸弹（普通难度）；96×54 网格 → 12 食物 + 17 炸弹

**完成标准**：
1. 不同视口尺寸下，食物和炸弹数量随地图面积变化
2. 当前 25×25 尺寸下的数量与改造前一致（向后兼容）

## 8. Canvas 渲染适配

- [x] 8.1 修改背景填充：`draw()` 中背景填充使用动态 `COLS * CELL_SIZE` 而非硬编码 500×500
- [x] 8.2 修改网格线绘制：循环使用动态 COLS/ROWS
- [x] 8.3 修改 Letterbox 背景绘制：Canvas 外部区域填充皮肤背景色
- [ ] 8.4 确保蛇段渲染、食物渲染、炸弹渲染、粒子系统使用 CELL_SIZE 而非硬编码值
- [ ] 8.5 验证：全屏下网格线正确覆盖整个 Canvas；蛇和食物渲染位置和大小正确

**完成标准**：
1. 全屏 Canvas 上蛇、食物、炸弹、网格线渲染正确
2. 所有视觉元素尺寸和间距与改造前一致（基于 CELL_SIZE）

## 9. 皮肤系统兼容

- [ ] 9.1 确保 4 套皮肤（Classic/Retro/Midnight/Sunset）的 CSS 变量在全屏布局下正确应用
- [ ] 9.2 确保浮动 HUD 的背景色和文字色使用皮肤 CSS 变量
- [ ] 9.3 验证：切换 4 套皮肤，全屏布局和 HUD 配色正确

**完成标准**：每套皮肤下全屏布局视觉一致，HUD 颜色与皮肤主题协调。

## 10. 回归验证

- [ ] 10.1 欢迎界面（pixel-welcome-screen）：CRT 动画正常 → 点击进入 → 开始覆盖层全屏显示
- [ ] 10.2 教程系统（beginner-tutorial）：帮助弹窗全屏居中，提示轮播正常
- [ ] 10.3 计时模式（timed-mode）：倒计时显示在顶栏，道具（金苹果/闪电/护盾）正常生成
- [ ] 10.4 炸弹系统（bomb-system）：休眠/不稳定炸弹正常生成和爆炸，动画效果正确
- [ ] 10.5 排行榜（leaderboard）：排行榜覆盖层全屏显示，筛选和操作正常
- [ ] 10.6 音效系统（explosion-sound）：音效在静音/非静音状态下正常
- [ ] 10.7 localStorage：设置、排行榜数据、教程状态读写正常，无数据丢失
- [ ] 10.8 多分辨率截图验证：1920×1080、2560×1440、375×667、768×1024

**完成标准**：所有现有功能在全屏布局下正常运行，无回归问题。
