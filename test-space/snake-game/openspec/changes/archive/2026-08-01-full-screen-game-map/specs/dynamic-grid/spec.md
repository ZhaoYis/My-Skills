# 动态网格系统 (dynamic-grid)

## ADDED Requirements

### Requirement: 网格尺寸动态计算

系统 SHALL 在游戏初始化时根据浏览器视口尺寸动态计算网格行列数，使用固定格子像素大小（CELL_SIZE = 20px）。

#### Scenario: 桌面端网格计算

- GIVEN 浏览器视口尺寸为 1920×1080 像素
- WHEN 游戏初始化（initGame）被调用
- THEN 网格列数 COLS = floor(1920 / 20) = 96
- AND 网格行数 ROWS = floor(1080 / 20) = 54
- AND Canvas 逻辑尺寸为 96×20 = 1920px 宽，54×20 = 1080px 高

#### Scenario: 移动端网格计算

- GIVEN 浏览器视口尺寸为 375×667 像素
- WHEN 游戏初始化（initGame）被调用
- THEN 网格列数 COLS = floor(375 / 20) = 18
- AND 网格行数 ROWS = floor(667 / 20) = 33
- AND Canvas 逻辑尺寸为 360×660px

### Requirement: 网格尺寸边界约束

系统 SHALL 对网格尺寸施加最小值和最大值约束，确保极端屏幕尺寸下的可玩性。

#### Scenario: 极小屏幕的最小网格

- GIVEN 浏览器视口尺寸为 300×400 像素（极小屏幕）
- WHEN 游戏初始化被调用
- THEN COLS 不小于 15（即使 floor(300/20) = 15，仍满足）
- AND ROWS 不小于 20
- AND CELL_SIZE 不小于 16px（若视口过小则调整 CELL_SIZE 以保证最小格数）

#### Scenario: 极大屏幕的最大网格

- GIVEN 浏览器视口尺寸为 2560×1600 像素
- WHEN 游戏初始化被调用
- THEN COLS 不超过 120
- AND ROWS 不超过 80
- AND 多余的视口空间以背景色填充

### Requirement: Canvas 物理尺寸与 DPR 适配

系统 SHALL 根据逻辑网格尺寸和设备像素比设置 Canvas 的物理分辨率和 CSS 显示尺寸。

#### Scenario: 标准 DPR 下的 Canvas 设置

- GIVEN 计算得到 COLS=96, ROWS=54，DPR=1
- WHEN setCanvasSize() 被调用
- THEN Canvas 物理宽度 = 96 × 20 × 1 = 1920px
- AND Canvas 物理高度 = 54 × 20 × 1 = 1080px
- AND Canvas CSS 宽度 = "1920px"
- AND Canvas CSS 高度 = "1080px"
- AND ctx.scale(1, 1) 被调用

#### Scenario: 高 DPR 下的 Canvas 设置

- GIVEN 计算得到 COLS=96, ROWS=54，DPR=2
- WHEN setCanvasSize() 被调用
- THEN Canvas 物理宽度 = 96 × 20 × 2 = 3840px
- AND Canvas CSS 宽度保持 "1920px"
- AND DPR 上限不超过 2（即使设备 DPR > 2）

### Requirement: 游戏进行中 resize 锁定网格

系统 SHALL 在游戏运行中收到窗口 resize 事件时锁定当前网格尺寸，Canvas 居中显示，边缘填充背景色（Letterbox 效果）。

#### Scenario: 游戏进行中缩小窗口

- GIVEN 游戏正在运行，当前网格为 96×54
- WHEN 用户将浏览器窗口缩小至 1200×800
- THEN 网格尺寸保持 96×54 不变
- AND Canvas CSS 居中显示
- AND Canvas 四周填充当前皮肤的背景色
- AND 蛇和食物的网格坐标不受影响

#### Scenario: 游戏进行中放大窗口

- GIVEN 游戏正在运行，当前网格为 18×33
- WHEN 用户将浏览器窗口最大化至 1920×1080
- THEN 网格尺寸保持 18×33 不变
- AND Canvas 居中，四周填充背景色

### Requirement: 非游戏状态 resize 重新计算网格

系统 SHALL 在游戏未运行（未开始、已结束、暂停中）时收到 resize 事件后重新计算网格尺寸。

#### Scenario: 开始覆盖层显示中 resize

- GIVEN 游戏未开始，显示开始覆盖层
- WHEN 用户调整浏览器窗口大小
- THEN 网格尺寸基于新视口重新计算
- AND Canvas 尺寸更新
- AND 开始覆盖层适配新视口

#### Scenario: 游戏结束后 resize

- GIVEN 游戏刚结束，显示游戏结束覆盖层
- WHEN 用户调整浏览器窗口大小
- THEN 网格尺寸基于新视口重新计算
- AND 点击"再来一局"时使用新网格尺寸

### Requirement: resize 防抖处理

系统 SHALL 对 resize 事件应用 200ms debounce，避免频繁触发性能问题。

#### Scenario: 连续快速 resize

- GIVEN 用户正在拖拽浏览器窗口边缘连续改变窗口大小
- WHEN resize 事件以高频率触发（每帧可能多次）
- THEN 网格重算或 Letterbox 调整仅在最后一次 resize 事件 200ms 后执行
- AND 中间态的 resize 事件被忽略

### Requirement: 食物数量动态调整

系统 SHALL 根据地图总格数动态计算食物生成数量。

#### Scenario: 标准网格下的食物数量

- GIVEN 网格尺寸为 25×25（625 格，与当前固定尺寸一致）
- WHEN 游戏初始化
- THEN 食物数量 foodCount = max(1, floor(625 / 400)) = 1
- AND 同时只有 1 个食物在地图上

#### Scenario: 大屏网格下的食物数量

- GIVEN 网格尺寸为 96×54（5184 格）
- WHEN 游戏初始化
- THEN 食物数量 foodCount = max(1, floor(5184 / 400)) = 12
- AND 同时最多有 12 个食物在地图上

#### Scenario: 极小网格下的食物数量

- GIVEN 网格尺寸为 15×20（300 格）
- WHEN 游戏初始化
- THEN 食物数量 foodCount = max(1, floor(300 / 400)) = 1
- AND 至少保证 1 个食物

### Requirement: 炸弹上限动态调整

系统 SHALL 根据地图面积平方根比例动态调整炸弹最大数量。

#### Scenario: 标准网格下的炸弹上限

- GIVEN 网格尺寸为 25×25（625 格），难度为"普通"（基准 maxBombs=6）
- WHEN 游戏初始化
- THEN 缩放因子 scaleFactor = 625 / 625 = 1
- AND 炸弹上限 maxBombs = floor(6 × sqrt(1)) = 6

#### Scenario: 大屏网格下的炸弹上限

- GIVEN 网格尺寸为 96×54（5184 格），难度为"普通"
- WHEN 游戏初始化
- THEN 缩放因子 scaleFactor = 5184 / 625 ≈ 8.29
- AND 炸弹上限 maxBombs = floor(6 × sqrt(8.29)) ≈ floor(6 × 2.88) = 17

#### Scenario: 简单难度无炸弹

- GIVEN 难度为"简单"（bombsEnabled=false）
- WHEN 游戏初始化，无论网格尺寸如何
- THEN 炸弹上限 maxBombs = 0
- AND 无炸弹生成

### Requirement: 设备旋转适配

系统 SHALL 在设备旋转（orientationchange）时根据游戏状态决定是否重算网格。

#### Scenario: 游戏中旋转设备

- GIVEN 移动端游戏正在运行
- WHEN 用户旋转设备（竖屏↔横屏）
- THEN 网格尺寸锁定不变（同 resize 锁定策略）
- AND Canvas 居中显示

#### Scenario: 开始前旋转设备

- GIVEN 游戏未开始，显示开始覆盖层
- WHEN 用户旋转设备
- THEN 网格尺寸基于新视口方向重新计算
- AND 覆盖层适配新方向
