# Tasks

## 1. TutorialHints 核心模块

- [x] 1.1 实现 `TutorialHints` 对象：`loadSeen()` / `markSeen(key)` / `shouldShow(key)`，storage key 为 `snake-tutorial-hints`
- [x] 1.2 实现 Toast 队列：`enqueueToast(msg, duration)` / `processQueue()` / `showToast()` / `hideToast()`
- [x] 1.3 实现 `showHelpModal()` / `hideHelpModal()`，绑定 Escape、遮罩点击、按钮关闭

## 2. 欢迎屏轮播（Layer 1）

- [x] 2.1 在 `#welcomeScreen .crt-content` 中新增 `.tip-carousel` DOM
- [x] 2.2 编写 3 条轮播文案 CSS（Press Start 2P 或 monospace fallback、淡入淡出、Game Boy 绿色）
- [x] 2.3 实现 `initTipCarousel()`：3 秒 interval 循环，欢迎屏退出时 clearInterval

## 3. 帮助面板（Layer 2）

- [x] 3.1 新增 `#helpModal` HTML 结构（操作/模式/炸弹/道具四章节 + 「知道了」按钮）
- [x] 3.2 编写帮助模态框 CSS（半透明遮罩、居中面板、滚动内容、响应式）
- [x] 3.3 在开始覆盖层添加 `?` 按钮；在 `.skin-selector` 旁添加 `#helpBtnGlobal`
- [x] 3.4 绑定两个帮助按钮的 click 事件

## 4. 情境 Toast Hook（Layer 3）

- [x] 4.1 在 `spawnBomb()` 中 hook：区分 dormant/unstable，首次触发对应 Toast
- [x] 4.2 在道具效果处理中 hook：shield / lightning / golden 首次 Toast
- [x] 4.3 在 `startGame()` 中 hook：计时模式首次 Toast
- [x] 4.4 在 `startGame()` 中 hook：移动端 D-pad pulse 高亮 + 操作 Toast

## 5. Toast & D-pad 样式

- [x] 5.1 编写 `#tutorialToast` CSS（canvas 顶部居中、半透明底、滑入动画）
- [x] 5.2 编写 `.dpad.tutorial-highlight` pulse 动画 CSS
- [x] 5.3 确保 Toast z-index 高于 canvas、低于 overlay

## 6. 集成与验证

- [x] 6.1 验证完整流程：Welcome（轮播）→ Start（帮助按钮）→ Game（Toast）→ GameOver → Start
- [x] 6.2 验证 localStorage 已读后 Toast 不再重复
- [x] 6.3 验证移动端 D-pad 引导仅首次触发
- [x] 6.4 验证 localStorage 异常时不崩溃
- [x] 6.5 手动冒烟：桌面 + 移动视口
