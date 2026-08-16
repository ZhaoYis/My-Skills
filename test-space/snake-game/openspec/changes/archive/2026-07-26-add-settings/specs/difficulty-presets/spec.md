# difficulty-presets Specification

## Purpose

三档难度预设系统，通过简单/普通/困难控制游戏速度和炸弹行为，让不同水平的玩家都能获得合适的挑战。

## ADDED Requirements

### Requirement: Difficulty Presets

系统 MUST 提供三档难度预设：简单 (easy)、普通 (normal)、困难 (hard)，默认值为普通。

#### Scenario: 难度参数矩阵
- GIVEN 用户选择了某个难度
- WHEN 游戏运行
- THEN 以下参数按难度生效：

| 参数 | 简单 | 普通 | 困难 |
|------|------|------|------|
| 基础速度 | 140ms/tick | 110ms/tick | 85ms/tick |
| 速度递减 | -5ms/100分 | -8ms/100分 | -10ms/100分 |
| 最低速度 | 60ms/tick | 45ms/tick | 30ms/tick |
| 炸弹启用 | 否 | 是 | 是 |
| 炸弹生成间隔 | N/A | 4-6s | 2.5-4s |
| 最大炸弹数 | N/A | 6 | 9 |
| 休眠炸弹概率 | N/A | 70% | 55% |

#### Scenario: 默认难度为普通
- GIVEN 用户首次打开游戏
- WHEN 页面加载完成
- THEN 难度默认为"普通"
- AND 游戏参数使用普通难度的值
- AND 炸弹系统正常启用

#### Scenario: 简单模式为纯经典体验
- GIVEN 用户选择"简单"难度
- WHEN 游戏运行
- THEN 不生成任何炸弹
- AND 游戏画面仅包含蛇、食物和网格（无炸弹元素）

---

### Requirement: Difficulty Switching

系统 MUST 支持通过设置面板切换难度，运行时即时生效。

#### Scenario: 运行中切换到简单
- GIVEN 游戏正在运行，当前难度为普通，棋盘上有炸弹
- WHEN 用户打开设置面板选择"简单"难度
- THEN 棋盘上所有现有炸弹立即移除
- AND 不再生成新炸弹
- AND 速度参数在下一 tick 生效

#### Scenario: 运行中切换到困难
- GIVEN 游戏正在运行，当前难度为普通
- WHEN 用户打开设置面板选择"困难"难度
- THEN 速度参数在下一 tick 生效
- AND 炸弹生成间隔缩短、最大炸弹数增加
- AND 已存在的炸弹不受影响

#### Scenario: 切换难度不重置游戏
- GIVEN 游戏正在运行，蛇已获得分数
- WHEN 用户切换难度
- THEN 当前分数、蛇位置、游戏状态不变
- AND 游戏不暂停

#### Scenario: 开始界面前选择难度
- GIVEN 游戏未开始，用户在开始覆盖层
- WHEN 用户打开设置面板选择"困难"难度
- THEN 下次开始游戏时使用困难参数
