# skin-system Specification

## Purpose
TBD - created by archiving change add-skin-system. Update Purpose after archive.
## Requirements
### Requirement: Skin System Registration

系统 MUST 支持至少 4 套预定义皮肤，每套包含完整的 CSS 变量集、Canvas 绘制参数和炸弹渲染参数。

每套皮肤 MUST 包含以下色值分组：
- CSS 变量：`--bg`、`--surface`、`--border`、`--text`、`--text-secondary`、`--accent`、`--food`、`--snake-head`、`--danger`
- Canvas 参数：棋盘背景色、网格线色、蛇头色、蛇身渐变起止色、食物渐变色（高光/中/暗）、食物光晕色、粒子色相范围、眼白/瞳孔色、暂停遮罩色
- 炸弹 Canvas 参数：休眠炸弹主体色、休眠炸弹光晕色、不稳定炸弹主体色、不稳定炸弹光晕色、不稳定炸弹火花色、爆炸闪光色、爆炸冲击波色、爆炸粒子色、爆炸焦痕色
- 背景光晕：页面 `body` 的两个 radial-gradient 色值

#### Scenario: 默认加载经典皮肤
- **GIVEN** 用户首次打开游戏，localStorage 中无 `snake-skin` 记录
- **WHEN** 页面加载完成
- **THEN** 自动加载"经典"皮肤
- **AND** DOM 使用经典皮肤的 CSS 变量
- **AND** Canvas 使用经典皮肤的绘制参数（包括炸弹参数）

#### Scenario: 加载已保存的皮肤
- **GIVEN** 用户之前选择了"午夜"皮肤，localStorage 中有 `snake-skin: "midnight"`
- **WHEN** 页面加载完成
- **THEN** 自动加载"午夜"皮肤
- **AND** 色块按钮中"午夜"处于激活态

#### Scenario: localStorage 不可用时的降级
- **GIVEN** localStorage 抛出异常（隐私模式、容量满等）
- **WHEN** 页面加载或用户切换皮肤
- **THEN** 使用"经典"皮肤作为默认值
- **AND** 游戏正常运行不崩溃

---

### Requirement: Skin Switching via Click

用户 MUST 能够通过点击色块按钮切换皮肤。

#### Scenario: 点击切换到新皮肤
- GIVEN 当前皮肤为"经典"
- WHEN 用户点击"复古"色块按钮
- THEN CSS 变量立即更新为"复古"配色
- AND Canvas 下一帧使用"复古"配色重绘
- AND "复古"色块显示激活态外环
- AND "经典"色块取消激活态

#### Scenario: 游戏进行中切换皮肤
- GIVEN 游戏正在运行中，蛇正在移动
- WHEN 用户点击不同皮肤的色块按钮
- THEN 游戏不暂停，继续运行
- AND 视觉配色立即切换为新皮肤
- AND 分数、蛇位置等游戏状态不变

---

### Requirement: Skin Switching via Keyboard

用户 MUST 能够通过按下 `T` 键循环切换皮肤。

#### Scenario: T 键循环切换
- GIVEN 当前皮肤为"经典"
- WHEN 用户按下 `T` 键
- THEN 切换为"复古"皮肤
- WHEN 用户再次按下 `T` 键
- THEN 切换为"午夜"皮肤
- AND 循环至末尾后回到"经典"

#### Scenario: 暂停状态下仍可切换皮肤
- GIVEN 游戏处于暂停状态
- WHEN 用户按下 `T` 键
- THEN 皮肤正常切换
- AND 暂停遮罩使用新皮肤配色重新渲染

#### Scenario: T 键不影响文本输入
- GIVEN 页面上无文本输入框（游戏页面无 input 元素）
- THEN `T` 键永远触发皮肤切换，不存在与输入框冲突的场景

---

### Requirement: Skin Persistence

用户选择的皮肤 MUST 保存到 `localStorage`，下次访问时自动恢复。

#### Scenario: 切换后刷新保持
- GIVEN 用户当前使用"暖橙"皮肤
- WHEN 用户刷新页面（F5 或 Cmd+R）
- THEN 页面加载后仍显示"暖橙"皮肤
- AND 最高分记录不受皮肤切换影响（独立存储）

---

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

### Requirement: Skin Color Independence

从皮肤对象中移除所有硬编码的 Canvas 绘制颜色后，`draw()` 函数 MUST 不出现皮肤定义之外的任何硬编码色值，包括炸弹和爆炸的渲染颜色。

#### Scenario: 所有 Canvas 颜色来自皮肤
- **GIVEN** 皮肤系统已加载
- **WHEN** `draw()` 函数执行
- **THEN** 所有 `ctx.fillStyle`、`ctx.strokeStyle` 等的颜色参数来自 `currentSkin.canvas` 对象
- **AND** `spawnParticles()` 的粒子色相来自 `currentSkin.canvas.particleHue` 和 `currentSkin.canvas.particleHueRange`
- **AND** 炸弹和爆炸渲染的所有颜色参数来自 `currentSkin.canvas` 对象

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

### Requirement: 皮肤包含障碍物配色

系统 MUST 在每个皮肤定义中包含障碍物配色方案。

每个皮肤 MUST 包含以下 Canvas 配色字段：
- `obstacleBody`: 障碍物主体颜色
- `obstacleBorder`: 障碍物边框颜色
- `obstacleHighlight`: 障碍物高光颜色

#### Scenario: 经典皮肤障碍物配色

- **GIVEN** 当前皮肤为 `classic`
- **WHEN** 读取皮肤配置
- **THEN** `obstacleBody = '#475569'`（slate-600）
- **AND** `obstacleBorder = '#334155'`（slate-700）
- **AND** `obstacleHighlight = 'rgba(148,163,184,0.4)'`

#### Scenario: 复古皮肤障碍物配色

- **GIVEN** 当前皮肤为 `retro`
- **WHEN** 读取皮肤配置
- **THEN** `obstacleBody = '#854d0e'`（yellow-800）
- **AND** `obstacleBorder = '#713f12'`（yellow-900）
- **AND** `obstacleHighlight = 'rgba(253,224,71,0.3)'`

#### Scenario: 午夜皮肤障碍物配色

- **GIVEN** 当前皮肤为 `midnight`
- **WHEN** 读取皮肤配置
- **THEN** `obstacleBody = '#1e3a5f'`（深蓝）
- **AND** `obstacleBorder = '#0f172a'`（slate-900）
- **AND** `obstacleHighlight = 'rgba(96,165,250,0.3)'`

#### Scenario: 日落皮肤障碍物配色

- **GIVEN** 当前皮肤为 `sunset`
- **WHEN** 读取皮肤配置
- **THEN** `obstacleBody = '#9a3412'`（orange-800）
- **AND** `obstacleBorder = '#7c2d12'`（orange-900）
- **AND** `obstacleHighlight = 'rgba(253,186,116,0.3)'`

---

### Requirement: 皮肤切换时更新障碍物渲染

系统 MUST 在皮肤切换时立即更新障碍物渲染颜色。

#### Scenario: 游戏中切换皮肤

- **GIVEN** 游戏正在运行
- **AND** 地图上存在障碍物
- **WHEN** 用户切换皮肤
- **THEN** 障碍物立即使用新皮肤的配色渲染

#### Scenario: 游戏未开始时切换皮肤

- **GIVEN** 游戏未开始（显示开始覆盖层）
- **WHEN** 用户切换皮肤
- **THEN** 调用 `draw()` 重新渲染
- **AND** 障碍物（如果存在）使用新皮肤配色

---

### Requirement: 皮肤配置完整性

系统 MUST 确保所有现有皮肤都包含障碍物配色字段。

#### Scenario: 皮肤配置验证

- **GIVEN** 系统加载皮肤配置
- **WHEN** 检查所有皮肤定义
- **THEN** 每个皮肤都包含 `obstacleBody`、`obstacleBorder`、`obstacleHighlight` 字段
- **AND** 字段值不为 `undefined` 或 `null`

#### Scenario: 新增皮肤时必须包含障碍物配色

- **GIVEN** 开发者新增自定义皮肤
- **WHEN** 定义皮肤配置
- **THEN** MUST 包含障碍物配色字段
- **AND** 否则皮肤配置不完整

