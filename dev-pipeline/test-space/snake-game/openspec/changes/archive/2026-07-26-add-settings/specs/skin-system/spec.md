# skin-system Specification (Delta)

## MODIFIED Requirements

### Requirement: Skin Selector UI

皮肤选择器 MUST 在桌面端和移动端均可见且可操作。**主入口从底部栏色块行变更为设置面板内的外观分区。**

#### Scenario: 设置面板内皮肤选择
- GIVEN 用户打开设置面板
- WHEN 查看"外观"分区
- THEN 显示 4 个皮肤选项：经典 🐍、复古 🕹️、午夜 🌙、暖橙 🍊
- AND 当前激活的皮肤显示选中态
- AND 点击即可切换皮肤

#### Scenario: 桌面端设置面板皮肤选择
- GIVEN 浏览器视口宽度 > 600px
- WHEN 设置面板打开
- THEN 皮肤选项以内联按钮形式展示
- AND 每个选项显示皮肤名称和 emoji 图标

#### Scenario: 移动端设置面板皮肤选择
- GIVEN 浏览器视口宽度 ≤ 600px 或设备为触摸屏
- WHEN 设置面板打开
- THEN 皮肤选项尺寸适配触摸操作（最小 44px 触摸目标）

#### Scenario: 底部栏不再显示皮肤色块
- GIVEN 页面渲染完成
- WHEN 用户查看底部控制栏
- THEN 不显示原有的 `.skin-selector` 色块行
- AND 底部栏显示 `?` 帮助按钮、`🔊` 静音按钮、`⚙️` 设置按钮

#### Scenario: 桌面端显示
- GIVEN 浏览器视口宽度 > 600px
- WHEN 页面渲染完成
- THEN 皮肤选择器位于设置面板"外观"分区内
- AND 每个选项为内联按钮，显示皮肤名称和 emoji 图标

#### Scenario: 移动端显示
- GIVEN 浏览器视口宽度 ≤ 600px 或设备为触摸屏
- WHEN 页面渲染完成
- THEN 设置面板内皮肤选项尺寸适配触摸操作（最小 44px 触摸目标）

#### Scenario: 激活态视觉
- GIVEN 当前皮肤为某款皮肤
- WHEN 设置面板打开
- THEN 该皮肤选项显示高亮边框和外圈光晕
- AND 其余皮肤选项无高亮

---

## ADDED Requirements

### Requirement: Settings Panel Skin Integration

设置面板中的皮肤选择 MUST 与现有皮肤系统完全兼容，包括键盘快捷键。

#### Scenario: T 键仍可循环切换皮肤
- GIVEN 游戏运行中
- WHEN 用户按下 `T` 键
- THEN 皮肤正常循环切换
- AND 设置面板内的皮肤选项同步更新选中态

#### Scenario: 面板外仍可通过 T 键切换
- GIVEN 设置面板关闭
- WHEN 用户按下 `T` 键
- THEN 皮肤正常切换（与当前行为一致）
