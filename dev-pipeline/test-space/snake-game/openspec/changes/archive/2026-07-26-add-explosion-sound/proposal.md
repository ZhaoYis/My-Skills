# Proposal: 爆炸音效系统

## Why

当前游戏已具备完善的视觉爆炸系统（炸弹引爆、连锁反应、粒子动画），但完全没有音频反馈。每次爆炸在视觉上冲击力十足，却听不到任何声音——这是一种感官体验的缺失。为爆炸事件添加程序化音效，可以在不引入外部依赖的前提下，大幅提升游戏的沉浸感和爽快感。

## What Changes

- **新增 AudioManager 模块**：封装 Web Audio API 的初始化和音效播放逻辑，支持静音切换
- **新增爆炸音效**：使用程序化合成（噪声爆发 + 低频振荡器扫频），在炸弹引爆时播放
- **音效随连锁级别变化**：`chainLevel` 越高，音调越高、音量越大，让连锁爆炸听感逐级增强
- **集成到现有触发点**：在 `triggerExplosion()` 和 `startGame()` 中挂载音效调用，不改变爆炸逻辑
- **可选的静音按钮**：提供简易的播放器静音控制

## Capabilities

### New Capabilities

- `explosion-sound`: 基于 Web Audio API 的程序化爆炸音效，覆盖音效合成、播放控制、用户静音和浏览器自动播放策略兼容

### Modified Capabilities

（无。本次仅新增音效，不修改任何现有规格行为。）

## Impact

- **代码**：`index.html` — 新增 `AudioManager` 模块（约 50-80 行 JS）；在 `startGame()` 中初始化 AudioContext；在 `triggerExplosion()` 中触发音效播放
- **性能**：爆炸音效合成在 `triggerExplosion()` 调用时执行（非每帧），单次耗时 < 1ms，对帧率无影响
- **浏览器兼容性**：Web Audio API 在 Chrome 34+, Firefox 25+, Safari 14+, Edge 12+ 均受支持，与现有 `roundRect()` 的兼容范围一致；通过先检测 `window.AudioContext` 做优雅降级
- **自动播放策略**：在 `startGame()` 的用户手势回调中初始化 AudioContext，符合浏览器自动播放策略；若 AudioContext 因任何原因不可用，音效静默降级不影响游戏运行
- **文件大小**：纯程序化合成，不引入任何音频文件，增量约 2-3 KB（压缩后更少）
