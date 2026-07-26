# game-settings Specification

## Purpose
TBD - created by archiving change add-settings. Update Purpose after archive.
## Requirements
### Requirement: Settings Panel Entry

系统 MUST 在底部控制栏提供 ⚙️ 齿轮图标按钮作为设置面板的唯一入口。

#### Scenario: 底部栏显示设置入口
- GIVEN 页面渲染完成，底部控制栏可见
- WHEN 用户查看底部栏
- THEN 底部栏显示 ⚙️ 齿轮图标按钮
- AND 按钮具有可访问的 aria-label "设置"

#### Scenario: 点击齿轮图标打开设置面板
- GIVEN 设置面板当前关闭
- WHEN 用户点击 ⚙️ 齿轮图标
- THEN 设置面板 Modal 打开
- AND 面板显示当前生效的设置值

#### Scenario: 桌面端入口尺寸
- GIVEN 浏览器视口宽度 > 600px
- WHEN 页面渲染
- THEN ⚙️ 按钮尺寸为 34px × 34px 圆形

#### Scenario: 移动端入口尺寸
- GIVEN 浏览器视口宽度 ≤ 600px 或设备为触摸屏
- WHEN 页面渲染
- THEN ⚙️ 按钮尺寸为 44px × 44px（满足最小触摸目标）

---

### Requirement: Settings Panel Modal

系统 MUST 以 Modal 弹窗形式展示设置面板，包含分区布局。

#### Scenario: 设置面板分区结构
- GIVEN 设置面板已打开
- WHEN 用户查看面板内容
- THEN 面板包含以下分区：
  - 🎮 游戏：难度选择、网格线开关
  - 🎨 外观：皮肤选择器
  - 🔊 音效：音效开关
  - 👤 玩家：昵称输入框和修改按钮
- AND 面板底部显示"重置设置"和"导出数据"操作按钮

#### Scenario: 关闭设置面板
- GIVEN 设置面板已打开
- WHEN 用户点击面板右上角 ✕ 按钮、或点击面板外遮罩区域、或按下 Escape 键
- THEN 设置面板关闭
- AND 游戏状态不受影响（不暂停、不重置）

#### Scenario: 设置面板打开时游戏继续运行
- GIVEN 游戏正在运行中
- WHEN 用户打开设置面板
- THEN 游戏不暂停，继续运行
- AND 设置面板覆盖在游戏画布上方

#### Scenario: 设置面板动画
- GIVEN 设置面板打开/关闭
- WHEN 面板状态切换
- THEN 面板以 fadeIn/fadeOut + scale 动画过渡（~250ms）

---

### Requirement: Settings Persistence

系统 MUST 将所有设置持久化到单一 `snake-settings` localStorage key，并在初始化时迁移旧数据。

#### Scenario: 首次加载迁移旧数据
- GIVEN localStorage 中存在旧 key（`snake-skin`、`snake-player-name` 等），但不存在 `snake-settings`
- WHEN 页面首次加载
- THEN 系统读取所有旧 key 的值合并为 settings 对象
- AND 写入 `snake-settings`
- AND 删除所有旧 key
- AND 使用合并后的设置初始化游戏

#### Scenario: 后续加载直接读取
- GIVEN localStorage 中已存在 `snake-settings`
- WHEN 页面加载
- THEN 系统直接从 `snake-settings` 读取设置
- AND 不执行迁移逻辑

#### Scenario: 修改设置立即持久化
- GIVEN 用户在设置面板中修改任意设置项
- WHEN 修改生效
- THEN 新的设置值立即写入 `snake-settings`
- AND 无需手动保存

#### Scenario: localStorage 不可用降级
- GIVEN localStorage 抛出异常（隐私模式、容量满等）
- WHEN 页面加载或用户修改设置
- THEN 使用 DEFAULT_SETTINGS 作为运行时设置
- AND 游戏正常运行不崩溃
- AND 设置面板仍可操作（但修改不会持久化）

---

### Requirement: Reset Settings

系统 MUST 提供"重置设置"功能，将所有设置恢复为默认值。

#### Scenario: 重置所有设置
- GIVEN 用户已修改多项设置
- WHEN 用户点击"重置设置"按钮并确认
- THEN 所有设置恢复为 DEFAULT_SETTINGS
- AND 设置面板立即反映默认值
- AND `snake-settings` 更新为默认值
- AND 排行榜数据不受影响（独立存储）

#### Scenario: 重置需二次确认
- GIVEN 用户点击"重置设置"按钮
- WHEN 未确认
- THEN 弹出确认对话框
- AND 用户取消后设置不变

---

### Requirement: Export Game Data

系统 MUST 提供"导出数据"功能，将排行榜和设置导出为 JSON 文件。

#### Scenario: 导出游戏数据
- GIVEN 设置面板已打开
- WHEN 用户点击"导出数据"按钮
- THEN 浏览器触发文件下载
- AND 文件名格式为 `snake-data-YYYY-MM-DD.json`
- AND 文件内容为 JSON 对象，包含 `settings` 和 `leaderboard` 两个字段

