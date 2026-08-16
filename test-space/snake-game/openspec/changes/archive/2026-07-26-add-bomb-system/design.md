# Design: 炸弹系统

## Context

当前 `index.html` 是单文件应用，约 1730 行，包含 HTML/CSS/JS。游戏以 `gameMode` 变量区分经典/计时模式，通过 `ITEM_TYPES`/`ITEM_PROBABILITIES`/`ITEM_EFFECTS` 管理特殊道具。`SKINS` 注册表管理 4 套皮肤的 CSS 变量和 Canvas 绘制参数。

炸弹系统作为横切关注点注入现有架构，需同时兼容两种模式，且不能破坏已有功能。

## Goals / Non-Goals

**Goals:**
- 实现休眠/不稳定两种炸弹类型的完整生命周期
- 3×3 范围爆炸 + 连锁引爆机制
- 与现有道具系统（护盾/闪电/金苹果）的交互
- 特殊道具扩展到经典模式
- 每套皮肤支持炸弹渲染参数
- 保持单文件架构，不引入外部依赖

**Non-Goals:**
- 不新增游戏模式（无模式卡片变更）
- 不改变 localStorage 存储结构
- 不引入音效（保持纯视觉反馈）
- 玩家不能主动放置/操控炸弹

## Decisions

### 1. 炸弹数据结构

```javascript
// 炸弹对象
{ x, y, type: 'dormant' | 'unstable', spawnTime: performance.now(), fuseDuration: number }

// 爆炸动画对象
{ x, y, startTime: performance.now(), chainLevel: number }
```

**选择**：使用轻量对象而非 class 实例，与现有 `snake[]`/`particles[]` 风格一致。`fuseDuration` 仅对不稳定炸弹有意义（在 spawn 时预设 3000-8000ms 随机值）。

### 2. 爆炸范围计算

```javascript
function getCellsInRadius(x, y, radius = 1) {
  const cells = [];
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      cells.push({ x: x + dx, y: y + dy });
    }
  }
  return cells; // 3×3 = 9 cells including center
}
```

**选择**：直接返回坐标数组，在 `triggerExplosion()` 中遍历检测。不使用空间索引——25×25 网格足够小，暴力遍历 O(9) 无性能问题。

### 3. 爆炸对蛇身的截断逻辑

```
爆炸中心在蛇身上的定位:
  - 蛇头在爆炸范围 → gameOver（除非护盾激活）
  - 蛇身在爆炸范围 → 从爆炸波及的最靠近蛇头的段之后截断
  - 多段被波及 → 取最靠近蛇头的那段作为截断点

实现: 遍历蛇身，找到爆炸范围内索引最小的段，截断 snake = snake.slice(0, index)
```

**选择**：从头部方向截断而非从尾部——这样更直观（爆炸削掉了头后面的身体），且避免出现"头身分离"的怪异状态。

### 4. 爆炸动画方案

使用 `explosions[]` 数组管理并行爆炸动画。每帧检查 `performance.now() - startTime`：

| 阶段 | 时间 | 视觉效果 |
|------|------|----------|
| Flash | 0-50ms | 纯白圆覆盖爆炸中心格 |
| Blast | 50-200ms | 橙红冲击波扩展到 3×3，不透明度 0.8→0.4 |
| Decay | 200-400ms | 火海渐弱 + 粒子飞溅，不透明度 → 0 |

**选择**：基于时间的动画而非帧计数——与 `performance.now()` 的 `gameLoop` 一致，不受帧率波动影响。

### 5. 连锁引爆的分数倍率

```javascript
// 初始引爆 chainLevel=1，每连锁一颗 +1
// 被连锁炸死的蛇身段按 chainLevel × baseScore 计分
// baseScore = 每段 5 分
```

**选择**：倍率直接等于连锁级别（第 1 颗 ×1，第 2 颗 ×2...），简单直观。不作为独立得分事件，而是叠加在被波及段的价值上。

### 6. 炸弹与食物的空间关系

炸弹占用格子后，该格子不能生成食物。炸弹爆炸摧毁的食物需要重生（调用 `spawnFood()`），保持棋盘上始终有 1 个食物。

**选择**：炸弹和食物严格互斥——同一格子不能同时存在两者。简化渲染和碰撞检测。

### 7. 经典模式道具概率

沿用计时模式的概率表：

```javascript
ITEM_PROBABILITIES: NORMAL 80%, GOLDEN 12%, LIGHTNING 5%, SHIELD 3%
```

经典模式下闪电和护盾的效果与计时模式一致（加速 3s、免死一次），仅不加时间。

### 8. 皮肤参数扩展

每套皮肤 `canvas` 对象新增：

```javascript
{
  bombDormantBody: '#...',      // 休眠炸弹主体色
  bombDormantGlow: 'rgba(...)', // 休眠炸弹光晕
  bombUnstableBody: '#...',     // 不稳定炸弹主体色
  bombUnstableGlow: 'rgba(...)',// 不稳定炸弹光晕
  bombUnstableSpark: '#...',    // 不稳定炸弹火花色
  explosionFlash: '#ffffff',    // 爆炸闪光色
  explosionBlast: '#...',       // 爆炸冲击波色
  explosionParticle: '#...',    // 爆炸粒子色
  explosionGround: 'rgba(...)', // 爆炸焦痕色
}
```

**选择**：每个皮肤定义自己的炸弹配色以保持视觉一致性。默认值从现有皮肤色板推导（经典→暗红炸弹、午夜→紫色炸弹等）。

## Component / Data Flow

```
                    ┌────────────────────────────────┐
                    │          gameLoop()             │
                    │  ┌──────────────────────────┐  │
                    │  │ bombSpawnTimer += dt      │  │
                    │  │ if >= nextBombSpawnAt:    │  │
                    │  │   spawnBomb()             │  │
                    │  └──────────────────────────┘  │
                    │  ┌──────────────────────────┐  │
                    │  │ for bomb in bombs:        │  │
                    │  │   if unstable && fuse:    │  │
                    │  │     triggerExplosion()    │  │
                    │  └──────────────────────────┘  │
                    │  ┌──────────────────────────┐  │
                    │  │ update() modified:        │  │
                    │  │   after move, check bomb  │  │
                    │  │   collision before food   │  │
                    │  └──────────────────────────┘  │
                    │  ┌──────────────────────────┐  │
                    │  │ draw() modified:          │  │
                    │  │   drawBombs()             │  │
                    │  │   drawExplosions()        │  │
                    │  │   drawSnake() (unchanged) │  │
                    │  │   drawFood() (unchanged)  │  │
                    │  └──────────────────────────┘  │
                    └────────────────────────────────┘

    triggerExplosion(bomb, chainLevel)
      ├─ getCellsInRadius(bomb.x, bomb.y, 1)
      ├─ for each cell:
      │   ├─ snake head? → gameOver() or shield consume
      │   ├─ snake body? → sever tail
      │   ├─ food? → spawnFood()
      │   └─ other bomb? → triggerExplosion(otherBomb, chainLevel+1)
      ├─ bombs.splice(bombIndex, 1)
      └─ explosions.push({ x, y, startTime, chainLevel })
```

## Risks / Trade-offs

- **[连锁爆炸可能清空半个棋盘]** → 上限 6 颗炸弹 + 每颗间距随机，实际连锁概率低，属于稀有高光时刻
- **[休眠炸弹扣段可能让蛇过短]** → 蛇长 ≤ 扣段数时直接死亡，与撞墙体验一致
- **[爆炸动画帧开销]** → explosions[] 最多 6 个并发，每个 400ms，每帧遍历开销可忽略
- **[经典模式难度提升]** → 特殊道具（护盾/闪电）平衡了炸弹威胁，且休眠炸弹扣段不致命
