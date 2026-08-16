# Tasks

## 1. AudioManager 模块搭建
- [x] 1.1 在 `index.html` 的 `<script>` 中创建 `AudioManager` IIFE 模块（`ensureContext` / `playExplosion` / `toggleMute`）
- [x] 1.2 实现 Web Audio API 可用性检测与优雅降级
- [x] 1.3 实现 `ensureContext()`：懒初始化 + 自动恢复 suspend 的 AudioContext

## 2. 爆炸音效合成
- [x] 2.1 实现 `playExplosion(chainLevel)`：白噪声 BufferSource + BiquadFilter (bandpass) + GainNode 链路
- [x] 2.2 添加低频振荡器链路（OscillatorNode sine + exponentialRampToValueAtTime 扫频 + GainNode）
- [x] 2.3 实现 chainLevel 参数映射（filter frequency、gain、decay time 随 chainLevel 变化）

## 3. 集成到游戏流程
- [x] 3.1 在 `startGame()` 中调用 `AudioManager.ensureContext()`（利用用户手势合规自动播放策略）
- [x] 3.2 在 `triggerExplosion()` 末尾调用 `AudioManager.playExplosion(chainLevel)`

## 4. 静音按钮
- [x] 4.1 在 HTML 皮肤选择器旁添加静音切换按钮（🔊/🔇 emoji）
- [x] 4.2 添加按钮样式（复用 `.skin-swatch` 风格）
- [x] 4.3 绑定点击事件调用 `AudioManager.toggleMute()` 并更新按钮图标

## 5. 验证
- [x] 5.1 在 Chrome、Firefox、Safari 中测试爆炸音效播放
- [x] 5.2 测试静音切换功能
- [x] 5.3 测试连锁引爆音效变化
- [x] 5.4 测试不支持 Web Audio API 时的优雅降级
