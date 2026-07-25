# Tasks

## 1. Skin Definitions
- [ ] 1.1 创建 `SKINS` 注册表对象，定义 `classic`、`retro`、`midnight`、`sunset` 四套皮肤
- [ ] 1.2 每套皮肤包含完整的 `css`（9 个 CSS 变量）和 `canvas`（约 18 个色值参数）以及 `ambientGlow1`/`ambientGlow2`

## 2. Skin Application Logic
- [ ] 2.1 实现 `applySkin(id)` 函数：更新 `:root` CSS 变量、替换 `body` 背景渐变、设置 `currentSkin`
- [ ] 2.2 实现 `cycleSkin()` 函数，按注册表顺序循环切换
- [ ] 2.3 页面启动时从 `localStorage` 读取 `snake-skin`，恢复上次皮肤或使用默认值

## 3. Canvas Color Migration
- [ ] 3.1 重构 `draw()` 函数：棋盘背景、网格线、食物（光晕3层+渐变3层+高光）改为 `currentSkin.canvas.*`
- [ ] 3.2 重构蛇身绘制：蛇头色、蛇身起止 RGB 改为 `currentSkin.canvas.snakeHead`/`snakeBodyStart`/`snakeBodyEnd`
- [ ] 3.3 重构蛇眼、粒子系统、暂停遮罩的颜色为 `currentSkin.canvas.*`
- [ ] 3.4 重构 `spawnParticles()` 中的粒子 HSL 色相为 `currentSkin.canvas.particleHue` + `particleHueRange`

## 4. Skin Selector UI
- [ ] 4.1 在 HTML 中新增 `.skin-selector` 容器，含 4 个圆形色块按钮（在 canvas 和 controls-info 之间）
- [ ] 4.2 编写 swatch 按钮样式：圆形、皮肤预览色填充、激活态外环、hover tooltip 显示皮肤名称
- [ ] 4.3 实现 swatch 点击事件：调用 `applySkin()` 并更新激活态 UI
- [ ] 4.4 移动端适配：触屏设备 swatch 最小 44px 触摸目标

## 5. Keyboard Shortcut
- [ ] 5.1 在 `keydown` 事件中新增 `T` / `t` 键绑定，调用 `cycleSkin()`

## 6. Verification
- [ ] 6.1 浏览器中验证：点击切换皮肤 → DOM + Canvas 配色同步变化
- [ ] 6.2 验证 `T` 键循环切换，游戏运行中切换不断
- [ ] 6.3 验证刷新后皮肤持久化（待补充 E2E 测试）
- [ ] 6.4 移动端触摸切换验证
