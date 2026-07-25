## Context

当前项目是单文件 (`index.html`) 贪吃蛇游戏，CSS 变量 + Canvas 2D 渲染，纯 Vanilla JS（IIFE 模式）。所有视觉参数硬编码。本次改动不改变项目架构模式，仅在现有文件中新增皮肤系统模块。

**约束**：保持单文件结构，不引入外部依赖，不拆分文件，所有现代浏览器兼容。

## Goals / Non-Goals

- **Goals**:
  - 4 套纯色皮肤定义和双向（CSS + Canvas）应用
  - 皮肤持久化到 localStorage
  - 点击色块或按 `T` 键循环切换
  - 所有现有硬编码颜色迁移为动态读取
- **Non-Goals**:
  - 不改变游戏逻辑、蛇/食物形状、动画速度
  - 不拆分文件或引入构建工具
  - 不支持自定义皮肤编辑器
  - 不做皮肤预览动画

## Decisions

### Decision 1: 皮肤数据模型 — 单一 JS 对象，双向驱动

每个皮肤是一个 JS 对象，包含 `css`（应用到 `:root` 变量）和 `canvas`（`draw()` 读取）两个子对象。`applySkin(id)` 统一处理 DOM 和 Canvas 同步。

- **Alternatives considered**:
  - 纯 CSS `data-theme` 方案：Canvas 无法读取 CSS 变量，需要 `getComputedStyle` 每帧调用，性能浪费。
  - CSS + JS 独立定义：容易出现 CSS 和 Canvas 颜色不一致的 bug，维护两套数据。
  - **选择单一 JS 定义**：一份数据、两个消费端，保证一致性。

### Decision 2: 皮肤切换 UI — 圆形色块按钮行

在 canvas 和键盘提示之间插入一行 4 个小圆点（直径 24px），蛇头色填充，棋盘背景色内圈。激活态有外圈环。

- **Alternatives considered**:
  - 下拉菜单：实现简单但需要额外点击，视觉预览弱。
  - 纯键盘操作：无障碍性差，移动端不可用。
  - **选择色块行**：视觉直观，点击和键盘均可操作，始终可见但低调。

### Decision 3: 皮肤存储键名

皮肤 ID 存储在 `localStorage` 的 `snake-skin` 键下，与已有的 `snake-best-score` 并列。

### Decision 4: 蛇身颜色插值算法不变

蛇身的头→尾 RGB 渐变保持现有线性插值逻辑 `lerp(start, end, t)`，仅将起点/终点的 RGB 三元组改为从皮肤读取。

## Architecture

```
┌──────────────────────────────────────────────────┐
│                  SKINS 注册表                      │
│  const SKINS = { classic: {...}, retro: {...},    │
│                  midnight: {...}, sunset: {...} } │
│                                                    │
│  ┌─────────────┐    ┌───────────────────────────┐  │
│  │  CSS 层      │    │  Canvas 层                 │  │
│  │              │    │                           │  │
│  │ :root vars  │    │ draw()                     │  │
│  │ body bg     │◄───│  ├─ boardBg/gridColor      │  │
│  │ .btn grad   │    │  ├─ snakeHead/bodyStart/End│  │
│  │ .title grad │    │  ├─ food (6 stops)         │  │
│  │ .key-badge  │    │  ├─ particles (hue range)  │  │
│  │ .dpad-btn   │    │  ├─ pause overlay          │  │
│  └─────────────┘    │  └─ eyes white/pupil       │  │
│                      └───────────────────────────┘  │
│                                                    │
│  applySkin(id):                                    │
│    1. documentElement.style.setProperty(k, v)      │
│    2. body.style.backgroundImage = ...              │
│    3. currentSkin = SKINS[id]                      │
│    4. localStorage.setItem('snake-skin', id)       │
│    5. draw()  // re-render if not running          │
│                                                    │
│  cycleSkin():                                      │
│    currentIndex = (currentIndex + 1) % 4           │
│    applySkin(keys[currentIndex])                   │
└──────────────────────────────────────────────────┘
```

## Component Tree

因为是单文件，没有组件树。逻辑分层如下：

```
index.html
├── <style> ── :root 变量 (动态注入) + 静态布局样式
├── <body> ── background-image (动态替换)
│   ├── .header ── 标题 + 分数 (颜色依赖 CSS 变量)
│   ├── .canvas-wrapper ── canvas + overlay
│   ├── .skin-selector ── **[新增]** 4 个 swatch 按钮
│   ├── .controls-info ── 键盘提示
│   └── .dpad ── 移动端方向键
└── <script>
    ├── SKINS 定义 (新增)
    ├── applySkin(), cycleSkin() (新增)
    ├── draw() ── 改用 currentSkin.canvas.* (修改)
    ├── spawnParticles() ── 改用 currentSkin.canvas.* (修改)
    └── 其余游戏逻辑 (不变)
```

## Data Flow

```
用户点击 swatch / 按 T
    │
    ▼
cycleSkin() / applySkin(id)
    │
    ├─► documentElement.style.setProperty()  ──► 浏览器重绘 DOM
    ├─► document.body.style.backgroundImage  ──► 背景渐变更新
    ├─► currentSkin = SKINS[id]              ──► draw() 下次调用生效
    └─► localStorage.setItem('snake-skin', id)

页面加载:
    loadSkinFromStorage() ──► applySkin(savedOrDefault)
```

## Risks / Trade-offs

- [Risk] 皮肤切换时正在运行的游戏中，下一帧立即变色——视觉跳跃感。但这是即时切换的合理行为，不需要过渡动画。
- [Risk] localStorage 不可用时降级为默认皮肤。已有 try/catch 模式。

## Open Questions

- 无（Explore 阶段已澄清）
