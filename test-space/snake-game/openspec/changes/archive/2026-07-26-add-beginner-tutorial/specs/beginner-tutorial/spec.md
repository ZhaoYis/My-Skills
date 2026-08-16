# beginner-tutorial Specification

## ADDED Requirements

### Requirement: Welcome Screen Tip Carousel

系统 SHALL 在像素欢迎屏的 mini canvas 与 `▶ PRESS ENTER` 提示之间显示一条轮播规则文案。轮播 MUST 包含至少 3 条提示，每 3 秒自动切换，带淡入淡出过渡。欢迎屏每次页面加载 MUST 显示轮播，不得因 localStorage 跳过。

#### Scenario: 欢迎屏轮播显示
- GIVEN 用户首次或再次打开游戏页面
- WHEN 欢迎屏渲染完成
- THEN 轮播区域显示第一条提示文案
- AND 3 秒后切换至下一条
- AND 循环播放全部提示

#### Scenario: 轮播不阻塞退出
- GIVEN 欢迎屏轮播正在播放
- WHEN 用户按下 Enter、Space 或点击屏幕
- THEN 欢迎屏正常退出
- AND 轮播定时器被清理

---

### Requirement: Persistent Help Modal

系统 MUST 提供常驻「玩法说明」模态框，涵盖：操作方式（桌面键盘 + 移动端 D-pad）、经典/计时模式规则、炸弹类型（休眠/不稳定）、计时模式道具（普通/金苹果/闪电/护盾）。模态框 MUST 在开始覆盖层和游戏进行中均可打开。

#### Scenario: 从开始层打开帮助
- GIVEN 开始覆盖层处于显示状态
- WHEN 用户点击 `?` 帮助按钮
- THEN 玩法说明模态框以半透明遮罩形式出现
- AND 内容包含操作、模式、炸弹、道具四个章节

#### Scenario: 从游戏中打开帮助
- GIVEN 游戏正在运行或已暂停
- WHEN 用户点击皮肤选择器旁的全局 `?` 按钮
- THEN 玩法说明模态框出现
- AND 游戏状态不被重置

#### Scenario: 关闭帮助模态框
- GIVEN 玩法说明模态框已打开
- WHEN 用户点击「知道了」按钮、遮罩区域或按下 Escape
- THEN 模态框关闭
- AND 返回之前的界面状态

---

### Requirement: Contextual Tutorial Toasts

系统 SHALL 在玩家首次遇到特定游戏机制时，于 canvas 顶部显示非阻塞 Toast 提示。每种机制 MUST 仅提示一次，已读状态持久化至 localStorage key `snake-tutorial-hints`。Toast MUST NOT 暂停游戏或抢夺键盘焦点。

#### Scenario: 首次遇到休眠炸弹
- GIVEN `snake-tutorial-hints.bombDormant` 为 false 或未设置
- WHEN 系统生成第一颗休眠炸弹
- THEN canvas 顶部显示 Toast：「灰色炸弹：碰到会缩短蛇身」
- AND 4 秒后自动消失
- AND `bombDormant` 标记为 true 并写入 localStorage

#### Scenario: 首次遇到不稳定炸弹
- GIVEN `snake-tutorial-hints.bombUnstable` 为 false
- WHEN 系统生成第一颗不稳定炸弹
- THEN 显示 Toast：「红色炸弹：3 秒后爆炸！快躲开」
- AND 标记 `bombUnstable` 为 true

#### Scenario: 首次获得护盾
- GIVEN 计时模式下 `snake-tutorial-hints.shield` 为 false
- WHEN 蛇吃到护盾道具
- THEN 显示 Toast：「护盾已激活！可抵挡一次伤害」
- AND 标记 `shield` 为 true

#### Scenario: 首次获得闪电
- GIVEN `snake-tutorial-hints.lightning` 为 false
- WHEN 蛇吃到闪电道具
- THEN 显示 Toast：「加速 5 秒！」
- AND 标记 `lightning` 为 true

#### Scenario: 首次获得金苹果
- GIVEN `snake-tutorial-hints.golden` 为 false
- WHEN 蛇吃到金苹果
- THEN 显示 Toast：「金苹果：双倍分数和时间」
- AND 标记 `golden` 为 true

#### Scenario: 首次开始计时模式
- GIVEN `snake-tutorial-hints.timedMode` 为 false
- WHEN 用户在计时模式下点击开始游戏
- THEN 显示 Toast：「限时 60 秒！吃食物延长时间」
- AND 标记 `timedMode` 为 true

#### Scenario: Toast 队列
- GIVEN 同一帧内触发两条未读 hint
- WHEN 系统需要显示 Toast
- THEN 先显示第一条，第一条消失后再显示第二条
- AND 不丢弃任何提示

#### Scenario: localStorage 不可用降级
- GIVEN localStorage 读写抛出异常
- WHEN 触发任一 hint 条件
- THEN Toast 仍正常显示
- AND 不抛出未捕获错误

---

### Requirement: Mobile D-Pad Tutorial Highlight

系统 MUST 在触控设备上，玩家首次开始游戏时，对 D-pad 方向键区域施加脉冲高亮动画，并显示操作 Toast「用方向键控制蛇」，持续约 5 秒。已读状态写入 `snake-tutorial-hints.dpad`。

#### Scenario: 移动端首次开局 D-pad 引导
- GIVEN 设备为触控设备（`matchMedia('(pointer: coarse)')` 或视口宽度 ≤ 500px）
- AND `snake-tutorial-hints.dpad` 为 false
- WHEN 用户开始第一局游戏
- THEN D-pad 区域显示 pulse 高亮动画
- AND 显示操作 Toast
- AND 5 秒后高亮移除
- AND `dpad` 标记为 true

#### Scenario: 桌面端不显示 D-pad 引导
- GIVEN 设备为非触控桌面环境
- WHEN 用户开始游戏
- THEN 不触发 D-pad 高亮
- AND 不写入 `dpad` hint
