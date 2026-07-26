## Why

当前贪吃蛇游戏页面加载后直接进入带有模式选择的开始覆盖层，缺少一个令人印象深刻的"第一印象"瞬间。增加一个 Game Boy 绿屏像素风独立欢迎界面，让玩家在进入模式选择前体验到像素时代的仪式感，营造怀旧氛围。

## What Changes

- 新增独立全屏欢迎界面（Welcome Screen），位于现有 Start Overlay 之前
- 欢迎界面采用 Game Boy 经典四色绿屏配色（#0f380f / #306230 / #8bac0f / #9bbc0f）
- 使用 "Press Start 2P" Google Font 呈现像素风 "SNAKE" 标题
- CRT 显示效果：扫描线、暗色边框、边缘暗角
- 迷你像素画布（16×16 逻辑网格）上 AI 控制的蛇自动游走，`image-rendering: pixelated` 保持硬边像素质感
- Game Boy 风格开机音效（Web Audio API 合成，类似 Game Boy 启动"叮"声）
- 用户按 Enter / Space / 点击任意位置后过渡到 Start Overlay，过渡动画为 CRT 关机线效果
- 每次页面加载都经过欢迎界面，不自动跳过
- 所有新增 CSS、HTML、JS 均在 `index.html` 单文件内完成，不引入外部构建依赖
- 现有 Start Overlay、游戏逻辑、皮肤系统、排行榜均保持不动

## Capabilities

### New Capabilities
- `pixel-welcome-screen`: Game Boy 绿屏像素风全屏欢迎界面，包含 CRT 视觉效果、像素蛇 AI 动画、开机音效和交互过渡

### Modified Capabilities
<!-- 本次变更不修改任何现有能力的规格级别行为 -->

## Impact

- **受影响文件**: `index.html`（新增 ~200 行 CSS + ~30 行 HTML + ~150 行 JS）
- **新增外部依赖**: "Press Start 2P" Google Font（~40KB，通过 `<link>` 加载，`font-display: swap` 降级）
- **浏览器兼容**: 现代浏览器（Chrome/Firefox/Safari/Edge），要求支持 CSS `backdrop-filter`、`repeating-linear-gradient`、Web Audio API
- **性能**: 迷你画布在 `requestAnimationFrame` 中独立渲染，不阻塞主游戏逻辑加载
