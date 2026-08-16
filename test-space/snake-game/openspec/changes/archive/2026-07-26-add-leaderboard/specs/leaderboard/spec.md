# leaderboard Specification

## Purpose
本地排行榜系统，支持历史成绩的存储、展示、筛选和迁移。

## ADDED Requirements

### Requirement: 数据存储与容量管理

系统 MUST 在 localStorage 中以 `snake-leaderboard` 为 key 存储排行榜数据，每条记录包含必要字段，容量上限为 20 条。

#### Scenario: 存储新成绩记录
- GIVEN 游戏刚刚结束，玩家当前分数为 42
- WHEN 系统调用排行榜存储方法
- THEN 一条新记录被插入 `snake-leaderboard` 数组中
- AND 记录包含以下字段：`id`（时间戳）、`score`（42）、`date`（ISO 日期字符串）、`mode`（当前游戏模式）、`playerName`（当前昵称快照）、`snakeLength`（终局蛇长）、`result`（终局原因）、`skin`（当前皮肤 ID）

#### Scenario: 排行榜容量上限
- GIVEN 排行榜已有 20 条记录，当前分数为 30
- WHEN 新记录需要插入，且 30 分低于当前排行榜所有记录
- THEN 新记录被丢弃，排行榜保持 20 条不变

#### Scenario: 淘汰最低分
- GIVEN 排行榜已有 20 条记录，最低分为 25，当前分数为 30
- WHEN 新记录插入
- THEN 最低分的 25 分记录被移除，30 分新记录按分数降序插入

#### Scenario: 同分按日期排序
- GIVEN 排行榜中已有 50 分的记录（日期 2026-07-25），当前游戏也获得 50 分（日期 2026-07-26）
- WHEN 新记录插入
- THEN 新 50 分记录排在旧 50 分记录之前

#### Scenario: 零分不保存
- GIVEN 游戏结束，当前分数为 0
- WHEN 系统判断是否需要保存成绩
- THEN 该成绩不被保存到排行榜

#### Scenario: localStorage 不可用时静默降级
- GIVEN 浏览器不支持 localStorage 或存储已满
- WHEN 系统尝试读写排行榜数据
- THEN 操作静默失败，不抛出异常，不影响游戏正常运行

---

### Requirement: 数据迁移

系统 MUST 在首次加载且 `snake-leaderboard` 不存在时，自动将旧版单一最高分数据迁移为排行榜条目。

#### Scenario: 迁移经典模式最高分
- GIVEN 排行榜数据不存在，localStorage 中存在 `snake-best-score-classic` 值为 100
- WHEN 页面首次加载执行迁移
- THEN 一条新排行榜记录被创建，`score` 为 100，`mode` 为 "classic"
- AND 该记录的 `playerName` 为 "匿名"，`date` 为迁移当天的日期
- AND `snake-best-score-classic` key 被删除

#### Scenario: 迁移计时模式最高分
- GIVEN 排行榜数据不存在，localStorage 中存在 `snake-best-score-timed` 值为 80
- WHEN 页面首次加载执行迁移
- THEN 一条新记录被创建，`score` 为 80，`mode` 为 "timed"
- AND `snake-best-score-timed` key 被删除

#### Scenario: 迁移时两个旧 key 同时存在
- GIVEN `snake-best-score-classic` 为 100，`snake-best-score-timed` 为 80
- WHEN 迁移执行
- THEN 两条记录分别被创建（经典 100 + 计时 80），两个旧 key 均被删除

#### Scenario: 已有排行榜数据时跳过迁移
- GIVEN `snake-leaderboard` 已存在
- WHEN 页面加载
- THEN 迁移逻辑不执行，旧 key 不被删除

#### Scenario: 旧数据不存在时跳过迁移
- GIVEN 排行榜数据和旧最高分数据均不存在
- WHEN 页面加载
- THEN 排行榜保持空数组，无异常抛出

---

### Requirement: 排行榜展示

系统 MUST 在开始界面显示 Top 5 排行榜摘要，并提供可打开完整排行榜面板的入口。

#### Scenario: 开始界面 Top 5 摘要
- GIVEN 排行榜中有 8 条记录
- WHEN 开始界面渲染
- THEN 在模式选择卡片下方显示标题为"🏆 排行榜"的摘要区域
- AND 展示前 5 条记录的排名、昵称和分数
- AND 显示"[查看完整榜单 →]"链接

#### Scenario: 排行榜为空时的摘要
- GIVEN 排行榜中没有任何记录
- WHEN 开始界面渲染
- THEN 排行榜摘要区域显示"暂无记录"占位文字
- AND "查看完整榜单"链接仍然可点击

#### Scenario: 打开完整排行榜面板
- GIVEN 用户在开始界面点击"[查看完整榜单 →]"
- WHEN 点击事件触发
- THEN 一个全屏覆盖层面板显示在 Canvas 上方
- AND 面板包含排行榜标题、关闭按钮、筛选标签、排行表格

#### Scenario: 关闭排行榜面板
- GIVEN 排行榜面板处于打开状态
- WHEN 用户点击关闭按钮（✕）或按下 Escape 键
- THEN 排行榜面板关闭，返回开始界面

#### Scenario: 游戏结束后的排名提示
- GIVEN 排行榜面板中显示 8 条记录的高亮"查看排行榜"按钮
- WHEN 用户点击"查看排行榜"
- THEN 完整排行榜面板打开，新记录行高亮显示

---

### Requirement: 按模式筛选

系统 MUST 在排行榜面板中提供模式筛选功能，支持全部、经典模式、计时模式三种视图。

#### Scenario: 默认显示全部
- GIVEN 排行榜面板打开
- WHEN 面板初始渲染
- THEN "全部"筛选按钮处于激活状态
- AND 表格显示所有模式的记录

#### Scenario: 筛选经典模式
- GIVEN 排行榜面板打开，默认选中"全部"
- WHEN 用户点击"经典模式"筛选按钮
- THEN 表格仅显示 `mode` 为 "classic" 的记录
- AND "经典模式"按钮变为激活状态，"全部"按钮取消激活

#### Scenario: 筛选计时模式
- GIVEN 排行榜面板打开
- WHEN 用户点击"计时模式"筛选按钮
- THEN 表格仅显示 `mode` 为 "timed" 的记录

#### Scenario: 筛选结果为空
- GIVEN 排行榜中有 5 条经典模式记录，0 条计时模式记录
- WHEN 用户筛选"计时模式"
- THEN 表格区域显示"暂无记录"占位文字

---

### Requirement: 昵称管理

系统 MUST 允许玩家设置和修改昵称，修改后同步更新所有历史记录中的 `playerName` 字段。

#### Scenario: 首次默认昵称
- GIVEN 玩家首次使用排行榜功能，`snake-player-name` 不存在
- WHEN 页面加载
- THEN 昵称默认设置为 "玩家"

#### Scenario: 修改昵称
- GIVEN 当前昵称为 "玩家"
- WHEN 用户在排行榜面板的昵称编辑区域输入 "小明" 并点击修改
- THEN `snake-player-name` 更新为 "小明"
- AND 所有已有排行榜记录中的 `playerName` 字段被同步更新为 "小明"

#### Scenario: 昵称修改后新记录使用新昵称
- GIVEN 昵称已修改为 "小明"
- WHEN 下一局游戏结束
- THEN 新记录的 `playerName` 为 "小明"

#### Scenario: 空昵称拒绝
- GIVEN 用户在昵称编辑区域
- WHEN 用户输入空字符串或纯空格并提交
- THEN 昵称不被更新，保持原值

---

### Requirement: 清空排行榜

系统 MUST 提供清空排行榜功能，并在执行前要求用户二次确认。

#### Scenario: 清空排行榜确认
- GIVEN 排行榜面板打开，其中有若干条记录
- WHEN 用户点击"清空排行榜"按钮
- THEN 弹出确认提示（浏览器 `confirm()` 对话框或自定义提示）
- AND 用户确认后，`snake-leaderboard` 被清空为空数组
- AND 面板表格立即刷新显示为空

#### Scenario: 取消清空操作
- GIVEN 用户点击"清空排行榜"后弹出确认提示
- WHEN 用户取消确认
- THEN 排行榜数据保持不变

---

### Requirement: 排行榜条目展示内容

每条排行榜条目 MUST 展示排名、昵称、分数、日期、模式图标和终局结果。

#### Scenario: 条目完整展示
- GIVEN 排行榜面板打开，有 5 条记录
- WHEN 表格渲染
- THEN 每行显示：排名序号、玩家昵称、分数（加粗）、日期（MM-DD 格式）、模式图标（🐍或⏱）、结果图标（💀/⏰/💥/🎉）

#### Scenario: 前三名特殊标识
- GIVEN 排行榜有 10 条记录
- WHEN 表格渲染
- THEN 第 1 名显示 🥇，第 2 名显示 🥈，第 3 名显示 🥉
- AND 第 4 名及之后显示数字序号

#### Scenario: 当前局排名高亮
- GIVEN 排行榜面板从游戏结束覆盖层的"查看排行榜"按钮打开
- WHEN 表格渲染
- THEN 与刚结束对局匹配的记录行有特殊高亮样式（⭐ 图标或背景色区分）
