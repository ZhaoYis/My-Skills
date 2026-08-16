## Context

`snake-game` 是一个单文件 HTML 贪吃蛇应用（`index.html`，约 4300 行），无框架、无构建工具。所有状态管理通过 IIFE 闭包 + 模块级变量实现。持久化通过 `localStorage`。

**当前配置状态：**
- 皮肤选择：底部栏 `.skin-selector` 行，4 个色块按钮
- 音效开关：底部栏 `#muteBtn`（🔊/🔇）
- 玩家昵称：开始覆盖层 `#playerNameInput` + 排行榜面板 `#lbNameInput`（两处独立）
- 游戏模式：开始覆盖层 `.mode-cards`（经典/计时）
- 各配置使用独立 `localStorage` key：`snake-skin`, `snake-player-name`, `snake-game-mode` 等

**约束：**
- 零依赖——不能引入框架或库
- 保持单文件结构
- 与现有 CSS 变量主题系统兼容
- 与现有 AudioManager、LeaderboardStore、Tutorial 模块共存

## Goals / Non-Goals

**Goals:**
- 提供统一的设置入口（⚙️ 齿轮图标）和 Modal 设置面板
- 难度预设系统：简单/普通/困难，控制速度曲线和炸弹参数
- 收敛现有散落的配置项到设置面板
- 统一 `localStorage` 持久化为单一 `snake-settings` key
- 迁移旧 localStorage 数据不丢失用户偏好

**Non-Goals:**
- 不改变 Canvas 渲染逻辑或游戏核心循环结构
- 不改变 AudioManager 的音效合成逻辑（只改开关 UI）
- 不改变 LeaderboardStore 数据结构
- 不引入独立滑块（每个参数单独调）——使用难度预设
- 不改变游戏模式选择的位置（仍在开始覆盖层）

## Decisions

### D1: Modal 设置面板 vs 独立设置页面

**选择：Modal 弹窗**

理由：
- 与现有 Help Modal（`#helpModal`）保持一致的模式
- 设置可在游戏中随时打开/关闭，不打断游戏流
- 无需路由或页面跳转
- 实现简单——复制 Help Modal 的 DOM + CSS 模式

### D2: 难度预设 vs 独立参数滑块

**选择：难度预设（简单/普通/困难）**

理由：
- 减少玩家的决策疲劳——一个选择覆盖所有参数
- 各预设经过平衡测试，避免玩家调出"不可玩"组合
- 代码简洁——难度对象包含所有派生参数
- 如需独立自定义，可后续版本扩展"自定义"预设

难度预设参数矩阵：

| 参数 | 简单 | 普通 | 困难 |
|------|------|------|------|
| 基础速度 | 140ms | 110ms | 85ms |
| 速度递减 | -5ms/100分 | -8ms/100分 | -10ms/100分 |
| 最低速度 | 60ms | 45ms | 30ms |
| 炸弹 | 禁用 | 默认参数 | 激进参数 |
| 炸弹间隔 | N/A | 4-6s | 2.5-4s |
| 最大炸弹 | 0 | 6 | 9 |
| 休眠概率 | N/A | 70% | 55% |
| 引信最小/最大 | N/A | 3s/8s | 2s/5s |

### D3: 统一持久化策略

**选择：单一 `snake-settings` key + 一次性迁移**

```javascript
// 新格式
const DEFAULT_SETTINGS = {
    difficulty: 'normal',
    skin: 'classic',
    soundEnabled: true,
    playerName: '玩家',
    showGridLines: true,
};
```

迁移逻辑：
1. 读取 `snake-settings`，如存在则使用
2. 如不存在，依次读取旧 key（`snake-skin`, `snake-player-name`, `snake-game-mode` 等）合并
3. 写入 `snake-settings`，删除旧 key
4. 迁移为一次性（页面加载时执行）

### D4: 底部栏布局调整

**选择：移除皮肤 swatch 行，替换为简洁按钮栏**

```
Before:  🎨 ○○○○ │ ?  🔊
After:   ?  🔊  ⚙️
```

- 皮肤选择移入设置面板（"外观"分区）
- `?` 帮助按钮、`🔊` 静音按钮保留
- 新增 `⚙️` 设置按钮
- T 键皮肤循环快捷键保留（设置面板内按钮映射同样支持 keyboard）

### D5: 难度切换行为

**选择：运行时即时生效**

- 从简单切到普通/困难：炸弹系统立即激活
- 从普通/困难切到简单：现有炸弹清空，停止生成
- 速度参数在下一次 tick 生效
- 游戏运行中切换难度时：不重置分数、蛇位置或游戏状态

## Risks / Trade-offs

- **[R1] 简单模式下无炸弹改变游戏核心体验** → 这是 feature 而非 bug——简单模式明确标记为"纯经典"体验
- **[R2] localStorage 迁移失败** → 迁移使用 try/catch 包裹，任何步骤失败都回退到默认设置，不阻塞游戏启动
- **[R3] 底部栏移除皮肤色块** → T 键皮肤切换 + 设置面板内选择器提供两种替代入口
- **[R4] 设置面板与游戏循环的交互** → 设置面板为纯 DOM 操作，不影响 `requestAnimationFrame` 循环；面板打开时游戏可继续运行

## Migration Plan

1. **部署**：替换 `index.html`
2. **首次加载**：自动执行旧 localStorage key 迁移
3. **回滚**：恢复旧版 `index.html` 即可（旧 localStorage key 已删除，但游戏功能不依赖它们——首次打开使用默认设置）
4. **数据恢复**：用户可通过设置面板"导出数据"按钮下载 JSON 备份

## Open Questions

- 无——所有设计决策已在 explore 阶段澄清
