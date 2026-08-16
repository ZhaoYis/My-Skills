## Context

项目为单文件 `index.html` 贪吃蛇游戏（Vanilla JS + Canvas），已有像素欢迎屏、双模式、炸弹系统、皮肤系统等能力。当前仅有底部键盘提示（桌面可见）和开始层一行文案，无法覆盖炸弹/道具/计时等机制说明。移动端 `.controls-info` 隐藏，操作引导缺失。

## Goals / Non-Goals

**Goals:**

- 实现三层引导：欢迎屏轮播 → 常驻帮助 → 情境 Toast
- 首次触发机制时精准提示，已读后不重复打扰
- 帮助面板随时可查，覆盖完整规则
- 与现有 pixel-welcome-screen 流程无缝衔接

**Non-Goals:**

- 不新增独立「教程模式」或关卡制
- 不做分步 Coach marks（逐个高亮 UI 元素）
- 不教皮肤切换、排行榜、昵称等次要功能（帮助面板一笔带过即可）
- 不修改游戏核心逻辑（炸弹概率、道具概率、模式规则）

## Decisions

### D1: 三层架构（轮播 + 帮助 + Toast）而非单一形式

**选择**: D + E 组合（欢迎屏轮播 + 常驻帮助 + 情境 Toast）

**理由**: 覆盖「扫一眼规则」和「遇到再学」两种学习习惯；开发量可控，无需新游戏模式。

**备选**: 分步 Coach marks — 打断感强、维护成本高；独立教程模式 — 与现有双模式架构冲突。

### D2: Toast 不暂停游戏

**选择**: 非阻塞 Toast 出现在 canvas 顶部，4 秒自动消失

**理由**: 暂停教炸弹会打断节奏；玩家可在提示出现时继续操作。

### D3: localStorage 记已读，欢迎屏轮播不记

**选择**: `snake-tutorial-hints` JSON；欢迎屏每次加载均轮播

**理由**: 与 `pixel-welcome-screen` spec（每次刷新显示）保持一致；情境提示重复价值低。

### D4: 帮助入口双位置

**选择**: 开始覆盖层 `?` 按钮 + 皮肤选择器旁全局 `?` 按钮

**理由**: 游戏中也能查规则，无需回到开始层。

### D5: 组件树（DOM 结构）

```
body
├── #welcomeScreen（已有）
│   └── .tip-carousel          ← 新增：轮播文案
├── .container（已有）
│   ├── #startOverlay
│   │   └── .help-btn          ← 新增
│   ├── .skin-selector
│   │   └── #helpBtnGlobal     ← 新增
│   └── .dpad（已有，加 .tutorial-highlight 类）
├── #helpModal（新增）
│   ├── .help-modal-backdrop
│   └── .help-modal-panel
└── #tutorialToast（新增，fixed 定位在 canvas-wrapper 内）
```

### D6: 状态管理策略

无路由；纯 JS 模块内状态：

```javascript
const TutorialHints = {
  storageKey: 'snake-tutorial-hints',
  seen: { bombDormant, bombUnstable, shield, lightning, golden, timedMode, dpad },
  toastQueue: [],
  isShowingToast: false,
  loadSeen(), markSeen(key), shouldShow(key),
  enqueueToast(message, duration), processQueue(),
  showHelpModal(), hideHelpModal()
};
```

Hook 点：`spawnBomb()`、`applyItemEffect()`、`startGame()`、`initWelcomeScreen()`。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| Toast 与游戏 UI 重叠 | 固定 canvas 顶部居中，z-index 低于 overlay |
| localStorage 不可用 | try/catch 包裹；降级为每次都显示 Toast |
| 多条 hint 同时触发 | Toast 队列顺序播放，不丢弃 |
| 欢迎屏文案过多 | 限制 3 条，每条 ≤ 20 字 |
| index.html 体积膨胀 | 帮助内容为静态 HTML，无额外请求 |

## Migration Plan

1. 部署后现有用户 `snake-tutorial-hints` 为空，首次游戏会收到全套 Toast — 符合预期
2. 无数据库迁移；回滚即 revert `index.html`
3. 不影响现有 localStorage keys

## Open Questions

<!-- 无 -->
