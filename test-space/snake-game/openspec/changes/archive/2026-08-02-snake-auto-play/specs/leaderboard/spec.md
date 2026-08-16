# leaderboard Specification (Delta)

## Purpose
本地排行榜系统 —— 扩展 `result` 字段以支持挂机模式标注。

## MODIFIED Requirements

### Requirement: 数据存储与容量管理

系统 MUST 在 localStorage 中以 `snake-leaderboard` 为 key 存储排行榜数据，每条记录包含必要字段，容量上限为 20 条。挂机产生的记录在 `result` 字段值后追加 `:auto` 后缀。

(Previously: `result` 字段仅存储终局原因，不含后缀。)

#### Scenario: 存储新成绩记录
- **GIVEN** 游戏刚刚结束，玩家当前分数为 42
- **WHEN** 系统调用排行榜存储方法
- **THEN** 一条新记录被插入 `snake-leaderboard` 数组中
- **AND** 记录包含以下字段：`id`（时间戳）、`score`（42）、`date`（ISO 日期字符串）、`mode`（当前游戏模式）、`playerName`（当前昵称快照）、`snakeLength`（终局蛇长）、`result`（终局原因）、`skin`（当前皮肤 ID）

#### Scenario: 存储挂机模式成绩记录
- **GIVEN** 挂机模式运行的游戏刚刚结束，终局原因为 `collision`
- **WHEN** 系统调用排行榜存储方法
- **THEN** 记录的 `result` 字段值为 `collision:auto`

#### Scenario: 存储非挂机模式成绩记录
- **GIVEN** 手动模式运行的游戏刚刚结束，终局原因为 `timeUp`
- **WHEN** 系统调用排行榜存储方法
- **THEN** 记录的 `result` 字段值为 `timeUp`（不含 `:auto` 后缀）

#### Scenario: 排行榜容量上限
- **GIVEN** 排行榜已有 20 条记录，当前分数为 30
- **WHEN** 新记录需要插入，且 30 分低于当前排行榜所有记录
- **THEN** 新记录被丢弃，排行榜保持 20 条不变

#### Scenario: 淘汰最低分
- **GIVEN** 排行榜已有 20 条记录，最低分为 25（含 `:auto` 后缀），当前分数为 30
- **WHEN** 新记录插入
- **THEN** 最低分的 25 分记录被移除，30 分新记录按分数降序插入
- **AND** 挂机与非挂机记录在容量淘汰中地位相同

#### Scenario: 同分按日期排序
- **GIVEN** 排行榜中已有 50 分的记录（日期 2026-07-25），当前游戏也获得 50 分（日期 2026-07-26）
- **WHEN** 新记录插入
- **THEN** 新 50 分记录排在旧 50 分记录之前

#### Scenario: 零分不保存
- **GIVEN** 游戏结束，当前分数为 0
- **WHEN** 系统判断是否需要保存成绩
- **THEN** 该成绩不被保存到排行榜

#### Scenario: localStorage 不可用时静默降级
- **GIVEN** 浏览器不支持 localStorage 或存储已满
- **WHEN** 系统尝试读写排行榜数据
- **THEN** 操作静默失败，不抛出异常，不影响游戏正常运行

---

### Requirement: 排行榜条目展示内容

每条排行榜条目 MUST 展示排名、昵称、分数、日期、模式图标和终局结果。挂机产生的记录在结果列显示 🤖 标记。

(Previously: 结果列仅显示终局原因图标，不区分挂机与手动。)

#### Scenario: 条目完整展示
- **GIVEN** 排行榜面板打开，有 5 条记录
- **WHEN** 表格渲染
- **THEN** 每行显示：排名序号、玩家昵称、分数（加粗）、日期（MM-DD 格式）、模式图标（🐍或⏱）、结果图标（💀/⏰/💥/🎉）

#### Scenario: 挂机记录显示 🤖 标记
- **GIVEN** 排行榜中有一条 `result` 为 `collision:auto` 的记录
- **WHEN** 表格渲染该行
- **THEN** 结果列显示 "💀 🤖"
- **AND** 🤖 标记在结果图标右侧

#### Scenario: 前三名特殊标识
- **GIVEN** 排行榜有 10 条记录（含挂机记录）
- **WHEN** 表格渲染
- **THEN** 第 1 名显示 🥇，第 2 名显示 🥈，第 3 名显示 🥉
- **AND** 挂机与非挂机记录在排名中地位相同

#### Scenario: 当前局排名高亮
- **GIVEN** 排行榜面板从游戏结束覆盖层的"查看排行榜"按钮打开
- **WHEN** 表格渲染
- **THEN** 与刚结束对局匹配的记录行有特殊高亮样式（⭐ 图标或背景色区分）

#### Scenario: 兼容旧记录（无 :auto 后缀）
- **GIVEN** 排行榜中存在旧记录，`result` 为 `bomb`（旧格式，无后缀）
- **WHEN** 表格渲染该行
- **THEN** 结果列仅显示 "💥"（不显示 🤖 标记）
- **AND** 不因格式不同而报错
