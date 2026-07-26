# Design: 爆炸音效系统

## Context

当前 `index.html` 约 2170 行，单文件应用。爆炸视觉系统已完整实现（`triggerExplosion()` + `drawExplosions()`），`chainLevel` 参数贯穿连锁引爆链路。原始炸弹系统设计（`design.md`）将"不引入音效"列为 Non-Goal——本次变更有意推翻这一决策，为已有的视觉爆炸补完听觉层。

项目使用 Canvas 2D 渲染，无外部依赖，无构建工具。音效方案必须保持同一架构理念——纯代码驱动、单文件、零外部资源。

## Goals / Non-Goals

**Goals:**
- 为每次炸弹爆炸（含连锁引爆）生成程序化音效
- 音效随 `chainLevel` 变化（更深连锁 = 更响/更高音调）
- 封装 AudioContext 初始化和生命周期管理
- 兼容浏览器自动播放策略（用户手势触发 AudioContext 恢复）
- 支持用户静音控制
- 保持单文件架构，不引入外部音频文件
- 若浏览器不支持 Web Audio API，静默降级不影响游戏

**Non-Goals:**
- 不引入其他音效（吃食物、道具、死亡等）—— 架构留有扩展空间但第一版聚焦爆炸
- 不改变现有爆炸机制、视觉动画或计分逻辑
- 不改变 DOM 布局（静音按钮为可选增强）
- 不使用外部音频文件或 base64 编码音频
- 不使用 AudioBuffer 预加载

## Decisions

### 1. 技术选型：Web Audio API 程序化合成

**选择**：使用 Web Audio API 的 OscillatorNode + 噪声 BufferSource + BiquadFilter + GainNode 合成爆炸音效。

**理由**：
- 爆炸声的本质是"宽带噪声脉冲 + 低频轰鸣衰减"，用振荡器+噪声源可以很好地近似
- 零文件体积，与项目"单文件无外部依赖"的理念一致
- 可参变——`chainLevel`、距离等游戏状态可以直接映射到音效参数
- 浏览器兼容性好（Chrome 34+, Firefox 25+, Safari 14+）

**不选 `<audio>` 元素**：需要 base64 内嵌或外部文件，前者膨胀文件 50-200KB，后者破坏单文件架构。

### 2. AudioManager 模块设计

```javascript
const AudioManager = (function () {
    let audioCtx = null;
    let muted = false;

    function ensureContext() { /* 懒初始化 AudioContext */ }
    function playExplosion(chainLevel) { /* 合成并播放爆炸声 */ }
    function toggleMute() { /* 切换静音状态 */ }
    function dispose() { /* 关闭 AudioContext */ }

    return { ensureContext, playExplosion, toggleMute, get muted() { return muted; } };
})();
```

**选择**：IIFE 模块模式，与现有 `(function () { ... })();` 风格一致。不暴露内部 AudioContext 实例。

**理由**：
- 与项目现有代码风格完全一致
- 模块内部管理 AudioContext 生命周期（懒初始化 + `dispose()`）
- 外部只需调用 `AudioManager.playExplosion(chainLevel)`

### 3. 音效合成链路

```
                    ┌─────────────────┐
  白噪声 Buffer ────│ BiquadFilter    │──┐
   (0.5s, 随机值)   │ bandpass        │  │
                    │ freq: 200+80*cl │  ├── GainNode ──┐
                    │ Q: 0.5          │  │  (0.8→0 0.5s) │
                    └─────────────────┘  │               │
                                         │               ├── destination
                    ┌─────────────────┐  │               │
  OscillatorNode ───│ GainNode        │──┘               │
  sine              │ (0.6→0 0.35s)   │                  │
  freq: 150→30Hz    └─────────────────┘                  │
  (exponentialRamp)                                      │
                                                         │
  chainLevel 影响:                                       │
  - filter.frequency: 200 + chainLevel * 80 Hz           │
  - noiseGain: 0.8 + chainLevel * 0.05                   │
  - oscGain: 0.6 + chainLevel * 0.05                     │
  - noiseGain decay: 0.5 + chainLevel * 0.1 s            │
```

**选择**：两路并行合成——噪声通道（提供"碎裂/嘶嘶"质感）+ 正弦波振荡器（提供"轰"的低频体感），最后混合到 destination。

**理由**：
- 纯噪声听起来像"电视雪花"，没有重量感
- 纯低频听起来像"闷雷"，没有冲击力
- 两者混合才是完整的爆炸声
- chainLevel 通过 filter frequency 和 gain 控制，连锁越深越尖锐越响亮

### 4. 集成点

```
startGame() ──→ AudioManager.ensureContext()  ← 用户手势触发，符合自动播放策略
                    │
triggerExplosion(bomb, chainLevel)
   ├─ 现有：爆炸逻辑（伤害判定、连锁、动画）
   └─ 🆕 AudioManager.playExplosion(chainLevel)
```

**选择**：在 `triggerExplosion()` 末尾调用音效，不影响任何现有逻辑。`ensureContext()` 在用户按空格或点击开始时调用。

### 5. 浏览器自动播放策略合规

现代浏览器要求 `AudioContext` 在用户手势之后才能产生声音。处理逻辑：

```javascript
function ensureContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}
```

`ensureContext()` 在 `startGame()` 中调用（响应空格/按钮点击），此后 `playExplosion()` 产生的音效都可正常播放。若浏览器因任何原因 suspend AudioContext，音效静默，不影响游戏运行。

### 6. 优雅降级

```javascript
// 在 AudioManager 模块顶部
if (typeof window.AudioContext === 'undefined' && typeof window.webkitAudioContext === 'undefined') {
    // 浏览器不支持 Web Audio API，所有方法变为 no-op
}
```

**选择**：检测 API 可用性，不可用时 AudioManager 方法静默返回，不抛异常。确保在不支持 Web Audio 的旧浏览器中游戏仍正常运行。

### 7. 静音按钮（可选增强）

在皮肤选择器旁添加一个简单的静音按钮（🔊/🔇），点击切换 `AudioManager.toggleMute()`。纯 CSS + emoji 实现，约 5 行 HTML + 10 行 JS。

## Component / Data Flow

```
用户按空格/点击"开始游戏"
         │
         ▼
   startGame()
     ├─ ensureContext()  → new AudioContext() / resume()
     ├─ initGame()
     └─ startGameLoop()
           │
           ▼  (游戏中... 炸弹被触发)
           │
   triggerExplosion(bomb, chainLevel)
     ├─ 爆炸范围检测
     ├─ 蛇头判定 (护盾 / 死亡)
     ├─ 蛇身截断
     ├─ 食物销毁
     ├─ 连锁引爆 (递归)
     ├─ explosions.push(...)
     └─ 🆕 AudioManager.playExplosion(chainLevel)
           │
           ▼
   playExplosion(chainLevel)
     ├─ if (muted || !audioCtx) return
     ├─ 创建噪声 BufferSource + BiquadFilter + GainNode
     ├─ 创建 OscillatorNode + GainNode (freq sweep)
     ├─ 连接到 audioCtx.destination
     └─ start() / stop() 定时释放
```

## Risks / Trade-offs

- **音质不如真实录音** → 程序化合成的爆炸声在保真度上不如专业录制的音频文件，但对于 8-bit 风格游戏来说，合成音的"电子感"反而是审美匹配的。如果后续需要更高音质，AudioManager 接口已预留，可替换内部实现
- **AudioContext 数量限制** → 部分浏览器限制 AudioContext 实例数（通常 6 个）。本设计只创建一个实例并复用，不受此限制
- **iOS Safari 限制** → iOS Safari 在低电量模式下可能限制 Web Audio 性能。音效播放失败不会影响游戏逻辑（fire-and-forget 模式）
- **文件体积增加约 2-3KB** → 与视觉爆炸动画（约 100 行渲染代码）相比，音频代码体积很小，比例合理
