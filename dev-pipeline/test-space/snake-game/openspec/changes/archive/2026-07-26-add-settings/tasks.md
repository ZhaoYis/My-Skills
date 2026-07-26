# Tasks

## 1. 设置数据模型与迁移
- [x] 1.1 定义 `DEFAULT_SETTINGS` 常量、`DIFFICULTY_PRESETS` 常量（含三档参数矩阵）
- [x] 1.2 实现 `SettingsStore` 模块：`load()`（含旧 key 迁移逻辑）、`save()`、`reset()`
- [x] 1.3 实现 `exportGameData()` 函数（导出 settings + leaderboard 为 JSON 下载）
- [x] 1.4 页面初始化时执行数据迁移，删除旧 localStorage key（`snake-skin`、`snake-player-name`、`snake-game-mode`、`snake-best-score-classic`、`snake-best-score-timed`）

## 2. 难度预设系统
- [x] 2.1 实现 `getDifficultyConfig(difficulty)` 函数，返回当前难度的速度、炸弹参数
- [x] 2.2 修改 `initGame()` 和 `startGameLoop()` 使用 `getDifficultyConfig()` 的动态参数替代硬编码常量（`BASE_SPEED`、`BOMB_CONFIG` 等）
- [x] 2.3 实现难度切换时的炸弹处理：切到简单模式时清空棋盘炸弹并停止生成
- [x] 2.4 保留旧常量作为普通难度的默认值（向后兼容游戏逻辑）

## 3. 设置面板 HTML 结构
- [x] 3.1 创建设置面板 Modal DOM 结构（`#settingsModal`），参照 `#helpModal` 的遮罩+面板模式
- [x] 3.2 构建"游戏"分区：难度三选一按钮组 + 网格线开关
- [x] 3.3 构建"外观"分区：皮肤选择器（4 个选项，显示 emoji + 名称）
- [x] 3.4 构建"音效"分区：音效开关按钮
- [x] 3.5 构建"玩家"分区：昵称输入框 + 修改按钮
- [x] 3.6 构建底部操作栏：重置设置按钮 + 导出数据按钮

## 4. 设置面板 CSS 样式
- [x] 4.1 复用 `.help-modal` 的基础样式模式（遮罩、面板、分区标题、关闭按钮）
- [x] 4.2 难度按钮组样式（三选一高亮、等宽排列）
- [x] 4.3 开关 (toggle switch) 样式（网格线、音效的 ON/OFF 开关）
- [x] 4.4 皮肤选择器样式（内联按钮、选中态高亮）
- [x] 4.5 移动端适配（触摸目标 ≥ 44px）

## 5. 设置面板 JS 逻辑
- [x] 5.1 实现打开/关闭面板逻辑（⚙️ 点击打开、✕/遮罩/Escape 关闭）
- [x] 5.2 实现设置读取与面板初始化（打开时从 SettingsStore 读取当前值填充 UI）
- [x] 5.3 实现难度切换事件处理（更新 SettingsStore，触发炸弹/速度参数刷新）
- [x] 5.4 实现皮肤切换事件处理（调用现有 `applySkin()`，更新面板内选中态）
- [x] 5.5 实现音效开关事件处理（调用现有 `AudioManager.toggleMute()` 或新增 `setMute()`）
- [x] 5.6 实现昵称修改事件处理（调用现有 `playerName.set()`，同步更新多处 UI）
- [x] 5.7 实现网格线开关事件处理（更新 Canvas 重绘逻辑）
- [x] 5.8 实现重置设置按钮（二次确认 → `SettingsStore.reset()` → 刷新面板 UI）
- [x] 5.9 实现导出数据按钮（调用 `exportGameData()`）

## 6. 底部栏布局调整
- [x] 6.1 移除 `.skin-selector` 色块行 DOM 和对应 CSS
- [x] 6.2 新增 ⚙️ 设置按钮（`.btn-icon` 风格，与 `?` `🔊` 按钮并列）
- [x] 6.3 调整底部栏布局：移除皮肤色块后的间距修正
- [x] 6.4 保留 `T` 键皮肤循环快捷键（与设置面板独立运作）

## 7. 端到端验证
- [x] 7.1 验证首次加载迁移：清除所有 localStorage → 刷新 → 检查设置默认值生效
- [x] 7.2 验证难度切换：简单模式无炸弹、困难模式速度更快
- [x] 7.3 验证设置持久化：修改设置 → 刷新 → 设置保持
- [x] 7.4 验证导出数据：下载的 JSON 包含完整 settings + leaderboard
- [x] 7.5 验证重置设置：修改后重置 → 所有值恢复默认
- [x] 7.6 验证移动端布局：DevTools 模拟触摸设备 → 设置面板可正常操作
