# timed-mode Specification

## Purpose
TBD - created by archiving change add-timed-mode. Update Purpose after archive.
## Requirements
### Requirement: Mode Selection

系统 MUST 在游戏开始前提供模式选择，默认选中经典模式。

#### Scenario: 默认选中经典模式
- GIVEN 用户首次打开页面
- WHEN 页面加载完成，开始覆盖层显示
- THEN 经典模式卡片处于选中态（高亮边框）
- AND 计时模式卡片处于非选中态
- AND 游戏进入经典模式行为

#### Scenario: 点击切换模式
- GIVEN 开始覆盖层显示，经典模式当前选中
- WHEN 用户点击"计时模式"卡片
- THEN 计时模式卡片切换为选中态
- AND 经典模式卡片取消选中态
- AND 模式选择持久化到 localStorage

#### Scenario: 键盘在开始前切换模式
- GIVEN 开始覆盖层显示（游戏未开始）
- WHEN 用户按下 ← 或 → 方向键
- THEN 选中态在经典模式和计时模式之间切换

#### Scenario: 模式选择仅在游戏开始前有效
- GIVEN 游戏正在运行中
- WHEN 用户点击模式选择区域
- THEN 模式选择不可交互（被覆盖层隐藏）

---

### Requirement: Timed Mode Countdown

计时模式 MUST 提供 60 秒初始倒计时，每吃一个食物增加 5 秒，上限 90 秒。时间归零游戏结束。

#### Scenario: 计时器从 60 秒开始倒计时
- GIVEN 用户选择计时模式并开始游戏
- WHEN 游戏开始
- THEN Header 显示"剩余时间"卡片，初始值为 60s
- AND 每秒递减一次

#### Scenario: 吃普通食物增加时间
- GIVEN 计时模式游戏运行中，剩余时间 45s
- WHEN 蛇吃到普通食物
- THEN 剩余时间增加 5s，变为 50s
- AND 得分增加 10 分

#### Scenario: 时间上限 90 秒
- GIVEN 计时模式游戏运行中，剩余时间 88s
- WHEN 蛇吃到普通食物（+5s）
- THEN 剩余时间变为 90s（不超过上限）

#### Scenario: 时间归零游戏结束
- GIVEN 计时模式游戏运行中，剩余时间 1s
- WHEN 计时器递减至 0s
- THEN 游戏结束
- AND 覆盖层显示"时间到!"（非"游戏结束"）
- AND 显示最终得分

#### Scenario: 暂停时计时器停止
- GIVEN 计时模式游戏运行中，剩余时间 30s
- WHEN 用户按空格暂停
- THEN 计时器停止倒计时
- WHEN 用户再次按空格恢复
- THEN 计时器从 30s 继续倒计时

---

### Requirement: Timer UI Color States

计时器卡片 MUST 根据剩余时间变化颜色。

#### Scenario: 剩余时间 >30s 显示绿色
- GIVEN 计时模式游戏运行中，剩余时间 45s
- WHEN Canvas 渲染
- THEN 计时器卡片文字颜色为 `var(--accent)`（绿色系）

#### Scenario: 剩余时间 10-30s 显示黄色
- GIVEN 计时模式游戏运行中，剩余时间 20s
- WHEN Canvas 渲染
- THEN 计时器卡片文字颜色为 `#fbbf24`（黄色）

#### Scenario: 剩余时间 <10s 显示红色并脉冲
- GIVEN 计时模式游戏运行中，剩余时间 5s
- WHEN Canvas 渲染
- THEN 计时器卡片文字颜色为 `var(--danger)`（红色）
- AND 卡片应用 CSS 脉冲动画（缩放 + 透明度变化）

---

### Requirement: Special Items

计时模式下，食物 MUST 按概率生成为不同物品类型，每种有独特外观和效果。经典模式 MUST 同样支持特殊物品生成。

#### Scenario: 普通食物（80% 概率）
- **GIVEN** 游戏运行中（经典或计时模式）
- **WHEN** 需要生成新食物且随机数 < 0.80
- **THEN** 生成红色渐变球（与经典模式食物外观一致）
- **AND** 吃到后 +10 分 +5s（计时模式）

#### Scenario: 金苹果（12% 概率）
- **GIVEN** 游戏运行中（经典或计时模式）
- **WHEN** 需要生成新食物且随机数在 [0.80, 0.92)
- **THEN** 生成金色闪光球（金色粒子环绕效果）
- **AND** 吃到后 +20 分 +10s（计时模式）

#### Scenario: 闪电（5% 概率）
- **GIVEN** 游戏运行中（经典或计时模式）
- **WHEN** 需要生成新食物且随机数在 [0.92, 0.97)
- **THEN** 生成蓝色电光球（电弧闪烁效果）
- **AND** 吃到后速度减半，持续 3 秒

#### Scenario: 护盾（3% 概率）
- **GIVEN** 游戏运行中（经典或计时模式）
- **WHEN** 需要生成新食物且随机数 ≥ 0.97
- **THEN** 生成紫色光环球（光环脉动效果）
- **AND** 吃到后激活护盾（免死一次，包括爆炸死亡）

#### Scenario: 经典模式无时间加成
- **GIVEN** 游戏处于经典模式
- **WHEN** 蛇吃到金苹果或普通食物
- **THEN** 仅获得分数（+10 或 +20），不增加时间

#### Scenario: 闪电持续 3 秒后恢复
- **GIVEN** 蛇吃到闪电，速度减半
- **WHEN** 3 秒过去
- **THEN** 速度恢复正常
- **AND** 蛇身蓝色描边效果消失

---

### Requirement: Shield Protection

护盾激活时 MUST 在蛇死亡时触发保护，包括碰撞死亡和爆炸死亡，方向反转并消耗护盾。

#### Scenario: 护盾防止撞墙死亡
- **GIVEN** 游戏运行中，护盾已激活
- **WHEN** 蛇头撞到墙壁
- **THEN** 蛇不死亡
- **AND** 方向反转（如向右 → 向左）
- **AND** 护盾状态消耗（变为未激活）
- **AND** 护盾指示器消失

#### Scenario: 护盾防止撞自己死亡
- **GIVEN** 游戏运行中，护盾已激活
- **WHEN** 蛇头碰到自己身体
- **THEN** 蛇不死亡
- **AND** 方向反转
- **AND** 护盾状态消耗

#### Scenario: 护盾防止爆炸死亡
- **GIVEN** 游戏运行中，护盾已激活，蛇头位于爆炸范围内
- **WHEN** 炸弹爆炸波及蛇头
- **THEN** 蛇不死亡
- **AND** 护盾状态消耗
- **AND** 蛇身段仍可能被爆炸截断

#### Scenario: 护盾不防休眠炸弹触碰扣段
- **GIVEN** 游戏运行中，护盾已激活
- **WHEN** 蛇头触碰休眠炸弹
- **THEN** 护盾不被消耗
- **AND** 蛇正常失去 2-3 段身体

#### Scenario: 护盾仅生效一次
- **GIVEN** 第一次碰撞/爆炸已经消耗护盾
- **WHEN** 蛇再次撞墙、撞自己或遭受爆炸
- **THEN** 游戏正常结束（无护盾保护）

#### Scenario: 护盾指示器
- **GIVEN** 护盾已激活
- **WHEN** Canvas 渲染
- **THEN** Header 显示护盾指示器（🛡️ 图标）
- **AND** 蛇头短暂紫色光晕

### Requirement: Score Storage Isolation

经典模式和计时模式的最高分 MUST 分开存储。

#### Scenario: 经典模式最高分独立
- GIVEN 用户玩经典模式
- WHEN 得分超过经典模式最高分
- THEN 更新 `snake-best-score-classic` 到 localStorage
- AND 不修改计时模式最高分

#### Scenario: 计时模式最高分独立
- GIVEN 用户玩计时模式
- WHEN 得分超过计时模式最高分
- THEN 更新 `snake-best-score-timed` 到 localStorage
- AND 不修改经典模式最高分

#### Scenario: 开始覆盖层显示对应最高分
- GIVEN 用户选中经典模式卡片
- WHEN 开始覆盖层显示
- THEN 卡片上显示经典模式的历史最高分
- WHEN 用户切换到计时模式卡片
- THEN 卡片上显示计时模式的历史最高分

---

### Requirement: Game Over Differentiation

计时模式 MUST 区分"时间到"和"碰撞死亡"两种结束方式。

#### Scenario: 时间耗尽结束
- GIVEN 计时模式游戏运行中，剩余时间归零
- WHEN 游戏结束
- THEN 覆盖层标题显示"时间到!"
- AND 标题颜色非红色（使用黄色或 accent 色）

#### Scenario: 碰撞死亡结束
- GIVEN 计时模式游戏运行中（无护盾）
- WHEN 蛇撞墙或撞自己
- THEN 覆盖层标题显示"游戏结束"
- AND 标题颜色为红色 `var(--danger)`

