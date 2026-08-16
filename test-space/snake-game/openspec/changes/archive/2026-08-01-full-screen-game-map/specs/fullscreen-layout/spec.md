# 全屏布局系统 (fullscreen-layout)

## ADDED Requirements

### Requirement: Canvas 铺满视口

系统 SHALL 将游戏 Canvas 铺满整个浏览器视口，消除页面滚动条和边距。

#### Scenario: 桌面端全屏渲染

- GIVEN 用户在桌面浏览器中打开游戏，视口尺寸为 1920×1080
- WHEN 页面加载完成并进入游戏
- THEN Canvas CSS 显示尺寸等于视口宽度和高度
- AND 页面 body 无滚动条（overflow: hidden）
- AND Canvas 四周无边距或留白

#### Scenario: 移动端全屏渲染

- GIVEN 用户在手机浏览器中打开游戏，视口尺寸为 375×667
- WHEN 页面加载完成并进入游戏
- THEN Canvas 铺满移动端视口
- AND 无水平或垂直滚动条

### Requirement: 浮动顶栏 HUD

系统 SHALL 在视口顶部渲染半透明浮动信息栏，显示当前得分、剩余时间（计时模式）和护盾状态。

#### Scenario: 经典模式下的顶栏显示

- GIVEN 用户在经典模式下进行游戏
- WHEN 游戏运行中
- THEN 视口顶部显示半透明顶栏
- AND 顶栏包含当前得分
- AND 顶栏不包含计时器（经典模式无时间限制）
- AND 顶栏背景透明度约为 60%（rgba 0.6）+ backdrop-filter blur

#### Scenario: 计时模式下的顶栏显示

- GIVEN 用户在计时模式下进行游戏
- WHEN 游戏运行中，剩余时间为 45 秒
- THEN 顶栏包含剩余时间显示（"45s"）
- AND 时间小于等于 30 秒时显示警告色
- AND 时间小于等于 10 秒时显示危险色

#### Scenario: 护盾激活时的顶栏显示

- GIVEN 玩家蛇拥有激活的护盾
- WHEN 游戏运行中
- THEN 顶栏显示护盾指示器（🛡️ 图标 + "ACTIVE" 文字）

### Requirement: 浮动底栏 HUD

系统 SHALL 在视口底部渲染半透明浮动操作栏，包含帮助、静音和设置按钮。

#### Scenario: 桌面端底栏显示

- GIVEN 用户在桌面端进行游戏
- WHEN 游戏运行中
- THEN 视口底部显示半透明底栏
- AND 底栏包含帮助按钮（?）、静音按钮和设置按钮（⚙️）
- AND 底栏不包含皮肤切换按钮（皮肤在设置面板中选择）

#### Scenario: 移动端底栏显示

- GIVEN 用户在移动端进行游戏
- WHEN 游戏运行中
- THEN 底栏高度适配触摸操作（≥ 44px 触控区域）
- AND 按钮间距足够防止误触

### Requirement: HUD 自动淡化

系统 SHALL 在游戏运行中无交互 5 秒后自动降低 HUD 透明度，鼠标移动或触摸时恢复。

#### Scenario: 自动淡化触发

- GIVEN 游戏运行中，玩家 5 秒内无键盘或触摸操作
- WHEN 5 秒计时器触发
- THEN 顶栏和底栏 opacity 从 1 降至 0.4
- AND 过渡动画平滑（transition: opacity 0.5s）

#### Scenario: 交互恢复

- GIVEN HUD 处于淡化状态（opacity 0.4）
- WHEN 玩家移动鼠标或触摸屏幕
- THEN 顶栏和底栏 opacity 恢复至 1
- AND 5 秒无交互计时器重置

### Requirement: 覆盖层全屏适配

系统 SHALL 使所有覆盖层（开始、排行榜、游戏结束、暂停、设置面板）覆盖整个视口。

#### Scenario: 开始覆盖层全屏

- GIVEN 页面加载完成，显示开始覆盖层
- WHEN 用户查看开始覆盖层
- THEN 覆盖层覆盖整个视口（width: 100vw, height: 100vh）
- AND 覆盖层内模式选择卡片居中显示
- AND 覆盖层半透明背景可透视下方 Canvas（若已渲染）

#### Scenario: 游戏结束覆盖层全屏

- GIVEN 蛇撞墙或撞到自己，游戏结束
- WHEN 游戏结束覆盖层显示
- THEN 覆盖层覆盖整个视口
- AND 显示最终得分和排行榜排名（如有）

### Requirement: D-pad 浮动定位

系统 SHALL 在触摸设备上将 D-pad 方向键渲染为 Canvas 区域内的浮动控件。

#### Scenario: 触摸设备显示浮动 D-pad

- GIVEN 用户在触摸设备上（pointer: coarse 或屏幕宽度 ≤ 600px）进行游戏
- WHEN 游戏运行中
- THEN Canvas 区域右下角显示浮动 D-pad
- AND D-pad 四个方向按钮（▲▼◀▶）可正常触摸操作
- AND D-pad 半透明（opacity 0.5），触摸时升至 0.9

#### Scenario: 桌面端不显示 D-pad

- GIVEN 用户在桌面端（pointer: fine 且屏幕宽度 > 600px）进行游戏
- WHEN 游戏运行中
- THEN D-pad 不显示
- AND 键盘方向键正常控制蛇的移动

#### Scenario: D-pad 触摸不触发 Canvas 滑动

- GIVEN 浮动 D-pad 可见
- WHEN 玩家触摸 D-pad 区域内的方向按钮
- THEN 触摸事件不传播到 Canvas
- AND Canvas 滑动方向检测不被触发

### Requirement: 设置面板适配

系统 SHALL 确保设置面板在全屏布局下正常打开和操作。

#### Scenario: 设置面板打开

- GIVEN 全屏布局模式下
- WHEN 玩家点击底栏设置按钮（⚙️）
- THEN 设置面板作为全屏覆盖层打开
- AND 面板内容（难度选择、皮肤选择、音效开关、网格线开关、昵称设置）完整可见
- AND 关闭按钮正常工作
