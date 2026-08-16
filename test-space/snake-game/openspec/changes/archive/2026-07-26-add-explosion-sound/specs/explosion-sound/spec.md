# explosion-sound Specification

## Purpose

为游戏中的炸弹爆炸事件提供程序化合成音效，通过 Web Audio API 实现零外部依赖的听觉反馈，提升游戏沉浸感。

## ADDED Requirements

### Requirement: AudioContext 初始化

系统 MUST 在用户首次开始游戏时初始化 AudioContext，以符合浏览器自动播放策略。

#### Scenario: 支持 Web Audio API 时初始化成功
- **GIVEN** 浏览器支持 `window.AudioContext` 或 `window.webkitAudioContext`
- **WHEN** 用户按下空格键或点击"开始游戏"按钮
- **THEN** 系统创建 AudioContext 实例（如尚未创建）或恢复已 suspend 的实例
- **AND** 后续爆炸事件可正常播放音效

#### Scenario: 不支持 Web Audio API 时优雅降级
- **GIVEN** 浏览器既不支持 `window.AudioContext` 也不支持 `window.webkitAudioContext`
- **WHEN** 用户开始游戏或任何音效方法被调用
- **THEN** 系统静默跳过所有音效操作
- **AND** 游戏正常运行，不影响任何游戏机制

#### Scenario: AudioContext 被浏览器 suspend
- **GIVEN** AudioContext 已创建但处于 `suspended` 状态
- **WHEN** 用户再次点击开始游戏
- **THEN** 系统调用 `audioCtx.resume()` 尝试恢复
- **AND** 若恢复失败，音效静默，不影响游戏

---

### Requirement: 爆炸音效播放

系统 MUST 在炸弹爆炸时播放程序化合成的爆炸音效。

#### Scenario: 不稳定炸弹被蛇头触碰时爆炸并播放音效
- **GIVEN** 游戏中存在不稳定炸弹，AudioContext 已初始化且处于 `running` 状态
- **WHEN** 蛇头移动到不稳定炸弹所在单元格
- **THEN** `triggerExplosion()` 被调用，在爆炸逻辑执行后播放爆炸音效
- **AND** 音效为噪声爆发 + 低频振荡器扫频的混合

#### Scenario: 不稳定炸弹自爆并播放音效
- **GIVEN** 棋盘上存在不稳定炸弹，其引信时间已到达
- **WHEN** 炸弹自行爆炸
- **THEN** 系统播放爆炸音效（与触碰引爆的音效播放逻辑一致）

#### Scenario: 连锁引爆播放多重音效
- **GIVEN** 一次爆炸波及另一颗炸弹
- **WHEN** 连锁引爆发生（`triggerExplosion(otherBomb, chainLevel + 1)` 被递归调用）
- **THEN** 每颗被连锁引爆的炸弹都播放一次音效
- **AND** `chainLevel` 越高，音效的音调越高、音量越大

#### Scenario: 静音状态下不播放音效
- **GIVEN** 用户已切换静音状态为开启
- **WHEN** 任何爆炸事件发生
- **THEN** 系统不播放任何音效

#### Scenario: AudioContext 未初始化时不播放音效
- **GIVEN** AudioContext 尚未创建（用户从未开始游戏）
- **WHEN** 任何音频方法被调用
- **THEN** 系统静默返回，不抛异常

---

### Requirement: 音效随连锁级别变化

爆炸音效的参数 MUST 随 `chainLevel` 变化，使玩家能通过听觉感知连锁深度。

#### Scenario: 单颗爆炸的基准音效
- **GIVEN** 炸弹爆炸，`chainLevel = 1`
- **WHEN** 音效合成
- **THEN** 带通滤波器中心频率为基准值（约 200 Hz）
- **AND** 噪声和振荡器增益为基准值

#### Scenario: 深连锁爆炸的音效增强
- **GIVEN** 炸弹爆炸，`chainLevel >= 2`
- **WHEN** 音效合成
- **THEN** 带通滤波器中心频率升高（`200 + chainLevel * 80 Hz`）
- **AND** 噪声和振荡器增益逐步增大
- **AND** 噪声衰减时间略微延长
- **AND** 音效上限有硬性限制，避免破音

---

### Requirement: 静音控制

用户 MUST 能够切换音效的静音状态。

#### Scenario: 默认未静音
- **GIVEN** 游戏页面首次加载
- **WHEN** 用户开始游戏
- **THEN** 音效正常播放（非静音状态）

#### Scenario: 点击静音按钮切换
- **GIVEN** 页面上存在静音控制按钮
- **WHEN** 用户点击静音按钮
- **THEN** 静音状态切换（开 → 关 或 关 → 开）
- **AND** 按钮图标相应变化（🔊 未静音 / 🔇 静音）

#### Scenario: 静音状态不影响游戏机制
- **GIVEN** 用户已切换至静音状态
- **WHEN** 游戏运行
- **THEN** 爆炸机制、视觉效果、计分逻辑完全不受影响
- **AND** 仅有音效播放被跳过
