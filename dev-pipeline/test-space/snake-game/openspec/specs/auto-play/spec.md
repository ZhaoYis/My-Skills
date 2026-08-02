# auto-play Specification

## Purpose
TBD - created by archiving change snake-auto-play. Update Purpose after archive.
## Requirements
### Requirement: 挂机模式开关

系统 MUST 提供挂机模式开关，用户可在开始界面和游戏进行中切换挂机状态，状态跨局保持。

#### Scenario: 开始界面开启挂机
- **GIVEN** 用户在开始界面，挂机开关当前为"关闭"
- **WHEN** 用户点击挂机开关下拉，选择"开启（经典模式）"
- **THEN** `autoPlayEnabled` 设置为 `true`
- **AND** 游戏模式自动切换为经典模式
- **AND** 下拉选择器显示当前选择为"开启（经典模式）"

#### Scenario: 游戏进行中按 H 键开启挂机
- **GIVEN** 游戏正在运行，`autoPlayEnabled` 为 `false`
- **WHEN** 用户按下 H 键
- **THEN** `autoPlayEnabled` 切换为 `true`
- **AND** HUD 顶栏显示 "🤖 挂机中" 指示器
- **AND** 蛇头上方绘制半透明 🤖 标记
- **AND** 从下一帧开始，AI 接管方向控制

#### Scenario: 游戏进行中按 H 键关闭挂机
- **GIVEN** 游戏正在运行，`autoPlayEnabled` 为 `true`
- **WHEN** 用户按下 H 键
- **THEN** `autoPlayEnabled` 切换为 `false`
- **AND** HUD 顶栏隐藏 "🤖 挂机中" 指示器
- **AND** 蛇头 🤖 标记消失
- **AND** 从下一帧开始，方向控制恢复为用户输入

#### Scenario: 游戏结束后挂机状态保持
- **GIVEN** `autoPlayEnabled` 为 `true`，蛇撞墙导致游戏结束
- **WHEN** 用户在游戏结束覆盖层点击"再来一局"
- **THEN** 新游戏开始后 `autoPlayEnabled` 仍为 `true`
- **AND** AI 立即开始控制蛇移动

#### Scenario: 页面刷新后挂机状态重置
- **GIVEN** `autoPlayEnabled` 为 `true`，游戏正在运行
- **WHEN** 用户刷新浏览器页面
- **THEN** `autoPlayEnabled` 重置为 `false`
- **AND** 开始界面挂机开关显示为"关闭"

---

### Requirement: AI 自动移动与吃道具

系统 MUST 在挂机模式下使用加权评分算法自动控制蛇的移动方向，蛇应能自主寻找并吃掉食物。

#### Scenario: AI 朝向食物移动
- **GIVEN** 挂机模式已开启，食物位于蛇头右上方
- **WHEN** AI 决策函数被执行
- **THEN** AI 优先选择使蛇更靠近食物的方向
- **AND** 蛇在若干帧后接近并吃掉食物

#### Scenario: AI 在无威胁时保持方向
- **GIVEN** 挂机模式已开启，蛇前方无墙壁、无炸弹、无自身身体
- **WHEN** AI 决策函数被执行
- **THEN** AI 有 80% 概率保持当前移动方向不变

#### Scenario: AI 避免撞墙
- **GIVEN** 挂机模式已开启，蛇头在网格右边界（x = COLS - 1），当前方向向右
- **WHEN** AI 决策函数被执行
- **THEN** AI 不选择向右的方向作为候选
- **AND** 蛇转向其他安全方向

#### Scenario: AI 避免撞自身
- **GIVEN** 挂机模式已开启，蛇头正前方一格为蛇身
- **WHEN** AI 决策函数被执行
- **THEN** AI 不选择向前方向作为候选
- **AND** 蛇转向其他安全方向

#### Scenario: 所有方向均不安全时保持方向
- **GIVEN** 挂机模式已开启，蛇头被墙壁和自身身体包围，所有候选方向数为 0
- **WHEN** AI 决策函数被执行
- **THEN** AI 返回当前方向（即使会导致碰撞）
- **AND** 游戏循环正常处理碰撞并触发 gameOver

---

### Requirement: 炸弹安全避让

系统 MUST 在挂机模式下检测不稳定炸弹威胁，AI 不主动走向不稳定炸弹及其爆炸范围。

#### Scenario: AI 避开不稳定炸弹本体
- **GIVEN** 挂机模式已开启，蛇头前方一格有一颗不稳定炸弹
- **WHEN** AI 决策函数被执行
- **THEN** 向前方向被标记为危险并从安全候选方向中移除
- **AND** AI 选择其他安全方向

#### Scenario: AI 避开不稳定炸弹爆炸范围
- **GIVEN** 挂机模式已开启，蛇头前方一格处于不稳定炸弹的 3×3 爆炸范围内
- **WHEN** AI 决策函数被执行
- **THEN** 向前方向被标记为危险并从安全候选方向中移除

#### Scenario: 所有方向均危险时选最不坏的
- **GIVEN** 挂机模式已开启，蛇头所有候选方向都在爆炸范围内
- **WHEN** AI 决策函数被执行
- **THEN** 所有候选方向保留（不排除任何方向）
- **AND** AI 按评分选择方向（依赖后续评分机制）

#### Scenario: AI 规避休眠炸弹
- **GIVEN** 挂机模式已开启，蛇头前方两格有一棵休眠炸弹
- **WHEN** AI 决策函数执行评分
- **THEN** 休眠炸弹 2 格范围内的方向在"炸弹规避"评分项不得分
- **AND** 远离休眠炸弹的方向获得更高评分

---

### Requirement: 道具追求

系统 MUST 在挂机模式下使 AI 有意识朝向护盾和闪电道具移动。

#### Scenario: AI 朝向闪电道具移动
- **GIVEN** 挂机模式已开启，当前食物类型为闪电（`foodItem === 'lightning'`）
- **WHEN** AI 决策函数执行评分
- **THEN** 使蛇更靠近食物的方向在"道具吸引"评分项获得 +3 分

#### Scenario: AI 朝向护盾道具移动
- **GIVEN** 挂机模式已开启，当前食物类型为护盾（`foodItem === 'shield'`）
- **WHEN** AI 决策函数执行评分
- **THEN** 使蛇更靠近食物的方向在"道具吸引"评分项获得 +3 分

#### Scenario: 普通食物仅受食物引力影响
- **GIVEN** 挂机模式已开启，当前食物类型为普通（`foodItem === 'normal'` 或 `'golden'`）
- **WHEN** AI 决策函数执行评分
- **THEN** 道具吸引评分项为 0（仅依赖基础食物引力 +5 分）

---

### Requirement: 方向键退出挂机

系统 MUST 在用户按下任意方向键或 WASD 键时立即退出挂机模式，方向输入同时生效。

#### Scenario: 方向键退出挂机并转向
- **GIVEN** 游戏运行中，`autoPlayEnabled` 为 `true`，蛇当前向右移动
- **WHEN** 用户按下上方向键（ArrowUp）或 W 键
- **THEN** `autoPlayEnabled` 切换为 `false`
- **AND** HUD 挂机指示器隐藏
- **AND** 蛇头 🤖 标记消失
- **AND** 蛇立即向上转向

#### Scenario: 同方向方向键不改变方向但退出挂机
- **GIVEN** 游戏运行中，`autoPlayEnabled` 为 `true`，蛇当前向右移动
- **WHEN** 用户按下右方向键（ArrowRight）
- **THEN** `autoPlayEnabled` 切换为 `false`
- **AND** 蛇保持向右移动（不尝试反向）

#### Scenario: 反向方向键退出挂机但不反向
- **GIVEN** 游戏运行中，`autoPlayEnabled` 为 `true`，蛇当前向右移动，蛇身长度 > 1
- **WHEN** 用户按下左方向键（ArrowLeft）
- **THEN** `autoPlayEnabled` 切换为 `false`
- **AND** 蛇不转向（`changeDirection` 拒绝反向输入）

---

### Requirement: 挂机暂停交互

系统 MUST 在挂机模式下保持暂停功能正常可用，暂停时挂机状态不变。

#### Scenario: 挂机运行中空格暂停
- **GIVEN** 挂机模式运行中，`autoPlayEnabled` 为 `true`
- **WHEN** 用户按下空格键
- **THEN** 游戏暂停（`isPaused` 切换为 `true`）
- **AND** `autoPlayEnabled` 保持 `true` 不变
- **AND** Canvas 显示"已暂停"覆盖文字
- **AND** 覆盖文字下方显示"🤖 挂机模式已激活"

#### Scenario: 挂机暂停中空格恢复
- **GIVEN** 游戏暂停中，`autoPlayEnabled` 为 `true`
- **WHEN** 用户按下空格键
- **THEN** 游戏恢复运行
- **AND** AI 继续控制蛇移动
- **AND** 蛇头 🤖 标记恢复显示

---

### Requirement: HUD 挂机状态指示

系统 MUST 在挂机运行时通过 HUD 顶栏和 Canvas 蛇头提供视觉指示。

#### Scenario: HUD 顶栏显示挂机指示
- **GIVEN** `autoPlayEnabled` 为 `true`，游戏正在运行
- **WHEN** HUD 渲染
- **THEN** HUD 顶栏分数右侧显示 "🤖 挂机中" 文字
- **AND** 文字颜色使用 `var(--accent)` 青色

#### Scenario: HUD 挂机指示在关闭时隐藏
- **GIVEN** `autoPlayEnabled` 为 `false`
- **WHEN** HUD 渲染
- **THEN** HUD 顶栏不显示 "🤖 挂机中" 文字

#### Scenario: Canvas 蛇头挂机标记
- **GIVEN** `autoPlayEnabled` 为 `true`，游戏正在运行，`draw()` 被调用
- **WHEN** Canvas 渲染蛇头
- **THEN** 蛇头上方绘制半透明 "🤖" 文字
- **AND** 文字大小约为 `CELL_SIZE * 0.6`
- **AND** 文字透明度在 0.6~0.8 之间轻微浮动变化

#### Scenario: Canvas 蛇头挂机标记在关闭时消失
- **GIVEN** `autoPlayEnabled` 为 `false`
- **WHEN** Canvas 渲染
- **THEN** 蛇头上方不绘制 "🤖" 标记

---

### Requirement: 开始界面挂机开关 UI

系统 MUST 在开始界面提供挂机模式的下拉开关，样式与现有设置面板风格一致。

#### Scenario: 开始界面挂机开关可见
- **GIVEN** 用户在开始界面，`autoPlayEnabled` 为 `false`
- **WHEN** 开始界面渲染
- **THEN** 模式卡片下方显示挂机模式开关卡片
- **AND** 卡片标题为 "🤖 挂机模式"
- **AND** 副标题为 "系统自动控制蛇移动和吃道具"
- **AND** 下拉选择器显示当前选择为"关闭"

#### Scenario: 挂机开关在移动端隐藏
- **GIVEN** 用户在移动端（屏幕宽度 ≤ 600px）
- **WHEN** 开始界面渲染
- **THEN** 挂机模式开关卡片不显示

#### Scenario: 挂机下拉选择器选项
- **GIVEN** 用户点击挂机开关下拉选择器
- **WHEN** 下拉菜单展开
- **THEN** 显示三个选项：关闭、开启（经典模式）、开启（计时模式）
- **AND** 当前选中项带有勾选标记
