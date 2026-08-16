## Context

当前项目是一个单文件 (`index.html`) 贪吃蛇游戏，包含皮肤系统、炸弹系统、计时模式、排行榜等功能。所有 UI 覆盖层（Start Overlay、Game Over、Leaderboard）均使用 CSS 绝对定位覆盖在游戏画布之上。本次变更在现有覆盖层之前新增一个独立全屏欢迎界面。

**约束**:
- 所有改动在 `index.html` 单文件内完成
- 不动现有游戏逻辑、皮肤系统、排行榜的任何代码
- 不引入外部构建依赖（仅引入一个 Google Font）

## Goals / Non-Goals

**Goals:**
- 全屏 Game Boy 绿屏像素风欢迎界面
- CRT 扫描线 + 边框 + 暗角视觉特效
- "Press Start 2P" 像素字体标题
- 16×16 迷你像素画布上 AI 蛇自动游走
- Web Audio API 合成的 Game Boy 风格开机音效
- CRT 关机线过渡动画进入 Start Overlay
- Enter / Space / 点击触发过渡

**Non-Goals:**
- 不改动现有 Start Overlay 的任何逻辑或视觉
- 不做响应式适配外的复杂布局
- 不引入键盘/手柄配置界面
- 不替换现有的音效系统（AudioManager）
- 不过度优化迷你蛇的 AI（只需观感上"活"的）

## Decisions

### Decision 1: 欢迎界面作为独立 DOM 层，而非 canvas 全屏模式

**选择**: 使用一个独立的 `<div id="welcomeScreen">` 覆盖全屏，内部用小型 `<canvas>` 渲染像素蛇。

**理由**: 现有代码已有成熟的覆盖层模式（`.overlay.active`），复用同一模式保持一致性。如果全屏模式切换主 canvas 上下文，会增加状态管理和渲染分支的复杂度。

**替代方案**: 复用主 `#gameCanvas` 并切换渲染模式 → 放弃，因为与游戏循环共享 canvas 会导致上下文切换复杂、容易引入 bug。

### Decision 2: CRT 效果用 CSS 实现，不依赖 canvas 后处理

**选择**: 扫描线 = `repeating-linear-gradient` 半透明覆盖层；暗角 = `radial-gradient`；边框 = 纯 CSS 盒模型。

**理由**: 
- 纯 CSS 效果不消耗 GPU 混合运算，在主线程之外运行
- 不需要在 canvas 上每帧绘制扫描线，节省迷你画布的渲染预算
- 声明式，易于调整参数

**替代方案**: 在 canvas 上绘制后处理效果 → 放弃，增加每帧计算量且不必要。

### Decision 3: 迷你画布 16×16 逻辑网格，8× 放大渲染

**选择**: 16×16 逻辑单元格，cellSize = 10px → 内部 canvas 160×160px，CSS 放大到 ~240-280px 显示区域。

**理由**:
- 16×16 网格在像素美学上足够展示蛇的运动，同时保持游戏空间可读
- 8× 放大确保每个"像素"可辨识（原始像素 = 10px → CSS 放大后 ~15-18px）
- `image-rendering: pixelated` + `crisp-edges` 保证缩放时不产生模糊

**替代方案**: 使用 sprite sheet / CSS animation → 放弃，无法实现"AI 真的在走"的动态效果。

### Decision 4: AI 蛇使用简单 wander 算法

**选择**: 蛇每个 tick 优先直行（80% 概率），在以下情况转向：接近墙壁（距离 ≤ 2 格）、随机方向变化（20% 概率）。食物随机重生，蛇朝食物方向偏转。蛇长度限制在 3-8 段，循环增长/缩短。

**理由**:
- 不需要路径规划或复杂 AI — 目的人类只是看一眼觉得"有条蛇在动"
- 简单的规则就能产生观感上自然的运动
- 代码轻量（~40 行 JS）

**替代方案**: A* 寻路 / 神经网络 → 严重过度设计。

### Decision 5: 开机音效用双音上升音程

**选择**: Web Audio API 创建两个 OscillatorNode，第一个 440Hz (A4)、第二个 880Hz (A5)，间隔 150ms，每个持续 150ms，使用 sine wave 类型，带简易 ADSR envelope（attack: 20ms, decay: 130ms, sustain: 0, release: 0）。

**理由**:
- Game Boy 开机音效的本质是"叮～叮↗"双音上升
- 两个正弦波振荡器只需约 15 行代码
- 无需外部音频文件
- 与现有 AudioManager 共享 AudioContext（可能已是 running 状态）

**替代方案**: 加载外部音频文件 → 放弃，增加加载开销且 Game Boy 音效极为简单，合成更合理。

### Decision 6: CRT 关机过渡动画

**选择**: CSS `clip-path: inset(50% 0 50% 0)` → `inset(0 0 0 0)` 反向动画（收缩到中心水平线），配合一条居中的白色水平线在 `::after` 伪元素中闪烁后消失。动画时长 ~400ms。动画结束后 `display: none` 隐藏欢迎层，Start Overlay 以标准 `.active` 类淡入。

**理由**:
- 使用 CSS transform/clip-path 动画，GPU 加速
- 白色水平线模拟 CRT 电子束回扫的余光
- 与现有覆盖层模式兼容（`.overlay.active` 控制显隐）

**替代方案**: Canvas 逐帧绘制关机效果 → 过度实现。

### Decision 7: Google Font 加载策略

**选择**: `<link rel="preload">` + `font-display: swap` + `font-family: 'Press Start 2P', 'Courier New', monospace`。

**理由**:
- `preload` 让浏览器尽早开始下载
- `swap` 保证在字体加载期间使用降级字体，不阻塞渲染
- `Courier New` 等宽字体作为降级，在一瞬间也是可接受的呈现

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| "Press Start 2P" 字体 ~40KB 下载延迟 | 用户可能在几百毫秒内看到 Courier New 标题 | `font-display: swap` + 字体加载完成后标题无闪烁切换 |
| Web Audio API 在部分浏览器默认静音 | 开机音效不播放 | AudioContext 需在用户手势后 resume；welcome screen 出现时状态可能为 suspended，在 transition 触发时 resume 并播放（因为 transition 由用户手势触发） |
| 迷你画布 `requestAnimationFrame` 持续运行 | 在欢迎界面停留期间消耗少量 CPU | 画布尺寸极小 (160×160)，每帧渲染量极低；transition 后 canvas 随 DOM 一同隐藏停止渲染 |
| CRT 关机效果 `clip-path` 兼容性 | Safari 旧版本可能动画不平滑 | 使用 `clip-path` 是标准属性，Safari 14+ 支持；降级为简单 `opacity` 过渡 |

## Migration Plan

1. 在 `index.html` 中新增 `<div id="welcomeScreen">...</div>` 及其 CSS，置于 `<body>` 最前
2. 在现有 `<script>` 中新增 Welcome Screen 模块代码，置于 IIFE 顶部
3. 修改页面初始化逻辑：页面加载后显示 welcome screen 而非 start overlay
4. 部署：单文件变更，无数据库迁移，无 API 变更
5. 回滚：恢复 `index.html` 到上一版本即可

## Open Questions

- 无。
