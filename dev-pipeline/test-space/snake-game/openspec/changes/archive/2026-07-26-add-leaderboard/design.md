## Context

当前项目为纯前端单文件应用（`index.html`），无框架、无构建工具、无后端。所有持久化通过 localStorage 实现，现有 4 个存储 key（`snake-best-score-classic`, `snake-best-score-timed`, `snake-game-mode`, `snake-skin`）。

排行榜功能需要在保持项目零依赖特性的前提下，扩展数据存储模型、新增 UI 组件，并与现有的游戏结束流程和开始界面集成。

**约束:**
- 仅修改 `index.html` 单文件
- 不能引入任何外部依赖
- 保持与现有 localStorage 模式的兼容性
- 现有 HTML/CSS 样式体系保持一致（CSS 自定义属性 + 皮肤变量）

## Goals / Non-Goals

**Goals:**
- 实现 Top 20 排行榜的本地存储、读写、排序和淘汰
- 首次加载时自动将旧的单一最高分数据迁移到排行榜
- 开始界面展示排行榜 Top 5 摘要
- 独立排行榜全屏面板，支持按模式筛选
- 游戏结束时自动记录成绩并在覆盖层中显示排名
- 玩家可自定义昵称，修改后同步更新所有历史记录

**Non-Goals:**
- 不实现后端服务或在线排行榜
- 不实现数据导出/导入功能
- 不实现多设备同步
- 不修改现有的游戏核心逻辑（移动、碰撞、炸弹系统等）
- 不修改皮肤系统的架构

## Decisions

### 1. 存储结构：单 key 数组 vs 多 key 分片

**选择**: 单个 `snake-leaderboard` key 存储 JSON 数组

**理由**: localStorage API 是同步的，每次读写整个数组（最多 20 条，约 2-3KB）性能开销可忽略。多 key 分片会增加代码复杂度，且排序/筛选需要额外的元数据管理。

**备选方案**: 每行一个 key (`snake-leaderboard-<id>`)，通过索引 key 关联。复杂度高且无性能收益，放弃。

### 2. 数据迁移策略

**选择**: 首次加载时自动检测并迁移，迁移后清除旧 key

**理由**: 对用户透明，不需要手动触发。迁移仅在 `snake-leaderboard` key 不存在且旧 key 存在时执行一次。迁移后的条目标记为"匿名"玩家。

### 3. 昵称存储与同步

**选择**: 独立 key `snake-player-name` 存储当前昵称，排行榜记录中存昵称快照

**分析**: 两种策略的权衡 —— (A) 记录中存储昵称引用（修改昵称后所有记录自动更新）vs (B) 记录中存储即时快照（修改昵称仅影响新记录）。

**最终选择**: 采用 (A) 引用模式——记录中存储 `playerName` 字段的快照值，但排行榜渲染时始终从 `snake-player-name` 读取当前昵称并动态覆盖所有记录。这样修改昵称后历史记录即时更新，且旧记录的原始昵称信息不丢失（仍存在于数据中）。

**修正**: 为了简化实现，采用混合模式——记录中存储写入时的昵称快照，修改昵称时通过"重新序列化所有记录并替换 playerName"来同步。这样避免了渲染时的动态覆盖逻辑。

### 4. UI 架构：覆盖层模式

**选择**: 排行榜面板使用与现有 `startOverlay` / `gameOverOverlay` 一致的绝对定位覆盖层

**理由**: 保持 UI 模式一致性，不需要路由或页面切换。覆盖层在 Canvas 上方显示，不影响游戏渲染循环。

### 5. 容量与淘汰策略

**选择**: 最多 20 条，按分数降序排列，同分按日期降序；超出容量时移除最低分中最旧的记录

**理由**: 20 条对 localStorage 来说是极小数据量（<5KB），同时对玩家提供了足够的历史深度。

## Component Tree

```
index.html (.container)
├── .header
│   ├── h1.title ("🐍 贪吃蛇")
│   └── .score-panel
│       ├── .score-card#timerCard         (计时模式剩余时间)
│       ├── .score-card                   (当前得分)
│       ├── .score-card                   (最高分)
│       └── .shield-indicator             (护盾指示器)
│
├── .canvas-wrapper
│   ├── canvas#gameCanvas                 (游戏画布)
│   ├── .overlay#startOverlay             (开始界面)
│   │   ├── .mode-cards                   (模式选择——现有)
│   │   ├── .leaderboard-summary 🆕        (Top 5 排行榜摘要)
│   │   ├── .player-name-row 🆕            (昵称显示/编辑行)
│   │   └── button#startBtn              (开始按钮)
│   └── .overlay#gameOverOverlay          (游戏结束界面)
│       ├── .overlay-title                (结束标题)
│       ├── .overlay-subtitle             (得分 + 排名提示 🆕)
│       └── button#restartBtn            (再来一局)
│
├── .overlay#leaderboardOverlay 🆕         (完整排行榜面板)
│   ├── .leaderboard-header              (标题 + 关闭按钮)
│   ├── .leaderboard-filters             (筛选按钮: 全部/经典/计时)
│   ├── .leaderboard-table               (排行表格)
│   ├── .leaderboard-name-edit           (昵称编辑行)
│   └── .leaderboard-clear               (清空按钮)
│
├── .skin-selector                        (皮肤选择)
├── .controls-info                        (键盘提示)
└── .dpad                                 (移动端方向键)
```

### 状态管理策略

| 状态 | 存储位置 | 读写方式 |
|------|---------|---------|
| 排行榜数据 (Top 20) | `localStorage["snake-leaderboard"]` | JSON 序列化/反序列化，封装在 `LeaderboardStore` 对象中 |
| 玩家昵称 | `localStorage["snake-player-name"]` | 直接读写，默认 `"玩家"` |
| 排行榜 UI 状态 | DOM classList | 筛选模式通过 data 属性跟踪 |
| 排名提示 | 运行时计算 | `gameOver()` 中调用 `LeaderboardStore.getRank(score)` |

## Risks / Trade-offs

- **[数据丢失风险]** 用户清除浏览器数据会导致排行榜丢失 → 这是 localStorage 的固有特性，接受此限制；未来可扩展导出功能
- **[容量风险]** 理论上 localStorage 5MB 限制远远大于 ~3KB 的排行榜数据，无实际风险
- **[隐私风险]** 昵称存储在本地明文 → 仅本地可见，无网络传输，风险可忽略
- **[兼容性风险]** 旧数据迁移可能因数据格式异常失败 → try/catch 包裹迁移逻辑，失败时静默跳过，不影响游戏运行

## Migration Plan

1. 部署新版本后，用户首次打开页面时执行自动迁移：
   - 检查 `snake-leaderboard` 是否存在
   - 若不存在且 `snake-best-score-classic` 或 `snake-best-score-timed` 存在，创建排行榜条目
   - 迁移完成后删除旧 key
2. 迁移失败（如数据损坏）时静默跳过，排行榜从空开始
3. 无回滚需求——旧 key 删除前已转换为新格式，数据不丢失

## Open Questions

<!-- 无待解决问题 —— 所有设计决策已在探索阶段确认 -->
