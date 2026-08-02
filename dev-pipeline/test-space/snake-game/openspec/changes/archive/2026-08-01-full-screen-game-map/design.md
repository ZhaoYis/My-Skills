# 设计：贪吃蛇全屏地图

## Context

当前贪吃蛇为单文件 HTML 应用（index.html，~5080 行），Canvas 固定 25×25 格（500×500px），IIFE 模块架构，零外部依赖。本次改造将其升级为全屏自适应布局，需在保持现有游戏逻辑和皮肤系统不变的前提下，重构 CSS 布局和 Canvas 尺寸管理。

约束：
- 单文件架构，所有改动集中在 index.html
- 浏览器原生环境，可使用 CSS Grid、ResizeObserver 等现代 API
- 必须兼容桌面端（键盘）和移动端（触摸），最小屏幕宽度 320px
- 不可破坏现有 localStorage 数据结构和 9 个能力模块的行为

## Goals / Non-Goals

**Goals:**
- Canvas 铺满浏览器视口，无滚动条和边距
- 网格尺寸根据视口动态计算，CELL_SIZE 保持 20px
- 半透明浮动 HUD 叠加在 Canvas 之上
- 游戏中 resize 锁定网格（Letterbox），新游戏重新计算
- 食物和炸弹数量按地图面积自适应

**Non-Goals:**
- 不引入连续移动模式（如 slither.io 360° 转向）
- 不添加地图滚动/摄像机跟随
- 不新增游戏模式
- 不改变 localStorage 数据格式
- 不引入外部依赖或构建工具

## Decisions

### 决策 1：动态格数 + 固定格子大小

**选择**：CELL_SIZE 保持 20px 常量，COLS/ROWS = floor(视口 / 20)。

**理由**：当前渲染逻辑中蛇段 padding（1.5px）、食物粒子偏移、蛇眼位置等均基于 20px 硬编码。改变 CELL_SIZE 需要重写大量渲染代码。固定格子大小意味着不同设备上的"每格视觉大小"一致，触屏操作精度也一致。

**替代方案**：固定格数 + 缩放格子大小 —— 大屏幕上格子过大、小屏幕上格子过小，体验不一致。已否决。

### 决策 2：浮动 HUD 而非嵌入式

**选择**：顶栏和底栏使用 `position: fixed` 浮动叠加在 Canvas 上，半透明背景 + `backdrop-filter: blur()`。

**理由**：Canvas 铺满视口后没有额外空间放置传统 header/footer。浮动 HUD 是手游和现代网页游戏的标准模式。半透明 + blur 在视觉上融合了信息展示和沉浸感。

**替代方案**：Canvas 留边距嵌入 HUD —— 浪费屏幕空间，与"全屏"目标矛盾。已否决。

### 决策 3：游戏中 resize = 锁定网格

**选择**：游戏运行中收到 resize 事件时，保持当前 COLS/ROWS 不变，Canvas 居中显示，四周填充背景色（Letterbox）。

**理由**：如果在游戏中途改变网格尺寸，蛇和食物的坐标可能超出新边界，需要复杂的坐标重映射和边界裁剪逻辑，且会让玩家感到困惑。锁定策略简单可靠。

**替代方案**：实时重新计算并迁移坐标 —— 复杂、易出错、玩家体验差。已否决。

### 决策 4：食物/炸弹按 sqrt 面积比缩放

**选择**：食物数量线性缩放（totalCells / 400），炸弹数量平方根缩放（sqrt(totalCells / 625)）。

**理由**：食物需要保持一定的"遇到频率"，线性缩放确保大屏幕上不至于找不到食物。炸弹如果线性缩放，大屏幕上会出现过多炸弹（4263 格 → 40 个），平方根缩放更温和（4263 格 → ~15 个）。

### 决策 5：ResizeObserver + debounce

**选择**：使用 `ResizeObserver` 监听 `document.documentElement` 尺寸变化，200ms debounce。

**理由**：ResizeObserver 比 window.resize 事件更可靠（能捕获 CSS 导致的尺寸变化、设备旋转等）。debounce 避免频繁触发导致的性能问题。

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|---------|
| 全屏 Canvas 在大屏高 DPR 下渲染压力大（2560×1440@2x = 5120×2880 物理像素） | DPR 上限保持 2x；如出现掉帧则对大屏降为 1x |
| 浮动 HUD 可能遮挡蛇头或食物 | HUD 透明度 + 自动淡化；后续可考虑智能避让 |
| 单文件 5080 行改动触及多处，容易遗漏或引入回归 | 按模块分步骤实施；每个任务完成后手动验证 |
| 极小屏幕（<320px）网格过小 | COLS 最小值 15、ROWS 最小值 20、CELL_SIZE 最小值 16px 三重保障 |
| D-pad 浮动后与 Canvas 滑动手势冲突 | D-pad 区域内触摸事件 `stopPropagation()` |

## Migration Plan

### 部署步骤

1. 合并 feature 分支到 main
2. 替换服务器上的 index.html（单文件部署）
3. 验证各分辨率下游戏可玩

### 回滚策略

替换为上一版本的 index.html 即可。localStorage 格式不变，无需数据回滚。

### 兼容性

- 现有 localStorage 数据（设置、排行榜、教程状态）完全兼容
- 皮肤系统 CSS 变量集不变
- 键盘和触摸操作方式不变

## Open Questions

1. 食物数量公式 `totalCells / 400` 和炸弹公式 `sqrt(totalCells / 625)` 需实测调优——当前为理论值
2. HUD 自动淡化的触发时间（5 秒）和淡化程度（opacity 0.4）需用户体验验证
3. 极端宽屏（21:9、32:9）下网格是否过宽——COLS 上限 120 可能需要调整
