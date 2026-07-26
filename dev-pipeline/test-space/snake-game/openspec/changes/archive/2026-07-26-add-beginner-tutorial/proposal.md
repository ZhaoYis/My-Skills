## Why

贪吃蛇游戏已具备炸弹、计时模式、道具、皮肤等复杂机制，但缺少系统化的新手引导。新玩家（尤其是移动端用户）容易在首次遇到炸弹或道具时产生困惑，误以为是 bug。需要在不破坏现有游戏节奏的前提下，提供轻量、分层的新手教程体验。

关联需求：[WELCOME-2026-02](https://www.baidu.com)

## What Changes

- **Layer 1 — 欢迎屏轮播提示**：在现有像素欢迎屏上增加 3 条核心规则轮播文案（每 3 秒切换），每次页面加载均显示
- **Layer 2 — 常驻帮助面板**：开始覆盖层与游戏界面均可打开的「? 玩法说明」模态框，涵盖操作、模式、炸弹、道具规则
- **Layer 3 — 情境 Toast**：首次触发特定游戏机制时显示非阻塞提示（炸弹、护盾、闪电、金苹果、计时模式、移动端 D-pad），状态持久化至 `localStorage`
- 新增 Toast 队列系统，支持多条提示顺序展示
- 移动端首次开局时 D-pad 区域脉冲高亮引导
- 所有改动在 `index.html` 单文件内完成，不引入外部依赖

## Capabilities

### New Capabilities

- `beginner-tutorial`: 三层新手引导系统（欢迎屏轮播、常驻帮助面板、情境 Toast + localStorage 已读状态）

### Modified Capabilities

<!-- 本次变更不修改现有能力的规格级行为；欢迎屏仅新增轮播文案，不改变 pixel-welcome-screen 既有交互 spec -->

## Impact

- **受影响文件**: `index.html`（新增 ~150 行 CSS + ~80 行 HTML + ~200 行 JS）
- **UI/UX 影响**:
  - 欢迎屏增加一条轮播提示行，视觉层次在 mini canvas 与 PRESS ENTER 之间
  - 开始覆盖层右上角新增 `?` 按钮；皮肤选择器旁新增全局帮助入口
  - 游戏 canvas 顶部可能出现 Toast 条，不遮挡核心游戏区域
  - 移动端 D-pad 首次使用时叠加 pulse 动画
- **浏览器/设备兼容**:
  - 桌面：Chrome / Firefox / Safari / Edge 最新两个大版本
  - 移动：iOS Safari 15+、Android Chrome 90+；依赖 `localStorage`、CSS animation、`matchMedia` 检测触控设备
  - `localStorage` 不可用时降级：帮助面板仍可用，Toast 每次均显示（graceful degrade）
- **性能**: Toast 与轮播均为轻量 DOM/CSS 操作，不增加游戏主循环负担
- **数据**: 新增 `localStorage` key `snake-tutorial-hints`（JSON 对象，约 200 字节）
