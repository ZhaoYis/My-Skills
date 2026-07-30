# opsx-dev-pipeline 技术分享文档

> 面向团队内部技术分享，全面介绍 opsx-dev-pipeline 系统的架构设计、核心机制与实现细节。

---

## 一、系统全景

### 1.1 项目定位

**opsx-dev-pipeline** 是面向 AI 驱动开发时代的全流程门禁式研发流水线系统。它解决的核心问题是：

> 团队在用 AI 编程工具提效，但 AI 生成的代码跳过测试、忽略规范、甚至提交了密钥文件。如何在"速度"和"质量"之间建立可控的平衡？

opsx-dev-pipeline 不试图让 AI 变慢——它要求 AI **先写提案、通过门禁、留下记录**，才能合并代码。它是 vibe coding 的反面，让 AI 的产出可以被团队信任。

### 1.2 整体架构

```mermaid
flowchart TB
    subgraph CLI["opsx-dev-pipeline CLI"]
        ADAPTER["多 AI 工具适配器<br/>Claude Code · Cursor · Codex"]
        STATE_MACHINE["7 阶段流水线状态机<br/>Phase 0-6"]
        TEMPLATES["Handlebars 模板引擎<br/>Skills · Commands · Schema"]
    end

    subgraph METRICS["opsx-metrics-server"]
        API["Express REST API<br/>30+ 端点"]
        COLLECTOR["Git 采集器<br/>指纹验证 · 去重 · Upsert"]
        CRON["node-cron 调度<br/>定时采集 · 数据保留"]
    end

    subgraph WEBSITE["opsx-metrics-website"]
        DASHBOARD["Next.js Dashboard<br/>个人仪表盘 · 团队面板 · 管理页面"]
    end

    subgraph STORAGE["数据层"]
        DB["MySQL / PostgreSQL<br/>Prisma ORM 双数据库支持"]
        GIT["Git Repositories<br/>流水线状态 JSON 文件"]
    end

    CLI -->|"初始化项目<br/>生成模板"| GIT
    CLI -->|"推送 pipeline-state<br/>JSON 文件"| GIT
    COLLECTOR -->|"git clone/fetch<br/>遍历 commits"| GIT
    COLLECTOR -->|"upsert 指标数据"| DB
    API -->|"聚合查询"| DB
    WEBSITE -->|"HTTP API 调用"| API
```

系统由三个核心组件构成：

| 组件 | 技术栈 | 职责 |
|---|---|---|
| **opsx-dev-pipeline CLI** | TypeScript · CAC · Handlebars · Zod | 一键初始化 AI 研发基础设施，生成 Skills/Commands/Schema |
| **opsx-metrics-server** | Express 5 · Prisma · simple-git · node-cron | 采集 Git 仓库中的流水线状态，提供指标查询 API |
| **opsx-metrics-website** | Next.js 16 · React 19 · Recharts · NextAuth | 可视化仪表盘，展示个人和团队效能指标 |

### 1.3 核心理念

**Spec-Driven Development（规范驱动开发）** 是贯穿整个系统的设计哲学：

```
Proposal → Specs → Design → Tasks → Apply → Review → Test → Archive → Merge
```

每次变更都从提案开始，经过规范定义、设计文档、任务拆解，再由 AI 按任务逐条实施。整个过程的每一步都记录在 `openspec/.pipeline-state/<changeName>.json` 中，形成永久可追溯的变更档案。

---

## 二、CLI 工具 — 一键搭建 AI 研发基础设施

### 2.1 多 AI 工具适配器架构

opsx-dev-pipeline 支持三种主流 AI 编程工具，通过统一的适配器抽象层生成各自原生格式的产物：

```
                    ┌─────────────────────────────┐
                    │     适配器注册表 (Adapter)      │
                    │   config/tools.json          │
                    └──────────┬──────────────────┘
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │  Claude Code  │  │    Cursor    │  │  Codex (OAI) │
    ├──────────────┤  ├──────────────┤  ├──────────────┤
    │ CLAUDE.md    │  │ .cursor/     │  │ .codex/      │
    │ .claude/     │  │   rules/     │  │   prompts/   │
    │   skills/    │  │   commands/  │  │   commands/  │
    │   commands/  │  │ .mdc rules   │  │ agents/      │
    └──────────────┘  └──────────────┘  └──────────────┘
```

每个适配器生成三种通道的产物：

| 通道 | 用途 | Claude Code 示例 | Cursor 示例 | Codex 示例 |
|---|---|---|---|---|
| **Skills** | 专业领域知识和工作流 | `.claude/skills/opsx-dev-pipeline/` | `.cursor/rules/opsx-dev-pipeline/` | `.codex/prompts/opsx-dev-pipeline/` |
| **Commands** | 快捷命令入口 | `.claude/commands/opsx-dev-pipeline.md` | `.cursor/commands/opsx-dev-pipeline.md` | `.codex/commands/opsx-dev-pipeline.md` |
| **Docs** | 项目级指令 | `CLAUDE.md` | `opsx-dev-pipeline.mdc` | `agents/openai.yaml` |

### 2.2 技术栈模板体系

支持两种项目类型的一键初始化：

| 维度 | Frontend | Backend |
|---|---|---|
| 技术栈 | React 18+ · TypeScript · Vite | Java 17+ · Spring Boot 3.x · Maven/Gradle |
| Schema 覆盖 | UI/UX 影响分析 · 浏览器兼容 · 组件树 · 路由与状态管理 | API 契约 · 数据库迁移 · 数据模型 · 中间件与拦截器 |
| 模板产出 | proposal.md · design.md · spec.md · tasks.md | proposal.md · design.md · spec.md · tasks.md |

每次 `init` 只安装一套 stack schema，记录在 pipeline manifest 中，后续 `sync` 和 `upgrade` 会保持一致。

### 2.3 Handlebars 模板引擎

模板系统采用两层结构：

```
templates/
├── common/                      # 通用模板（跨 AI 工具）
│   ├── base/                    # README, .gitignore
│   ├── commands/                # AI 命令模板
│   ├── config/                  # OpenSpec config.yaml
│   ├── schemas/                 # 前后端 schema 模板
│   └── skills/opsx-dev-pipeline/ # 流水线 Skill bundle
└── tools/                       # 工具特定覆盖层
    ├── claude/overlay/          # Claude 专属覆盖
    ├── cursor/overlay/          # Cursor 专属覆盖
    └── codex/overlay/           # Codex 专属覆盖
```

Handlebars 变量如 `{{toolId}}`、`{{stack}}`、`{{skillsDir}}` 在渲染时动态替换，一套模板即可适配多种工具和项目类型。

### 2.4 Manifest 生命周期管理

Manifest 是文件生命周期的核心追踪机制，支持五个命令：

```mermaid
flowchart LR
    INIT["init<br/>安装 + 写入 Manifest"] --> SYNC["sync<br/>重新渲染已托管文件"]
    INIT --> UPGRADE["upgrade<br/>sync + 采纳新增模板"]
    INIT --> DOCTOR["doctor<br/>检查完整性与兼容性"]
    INIT --> UNINSTALL["uninstall<br/>删除托管文件并清理"]
```

Manifest 采用双存储策略：优先嵌入 `package.json`（`opsxDevPipeline` 键），fallback 到独立文件。记录内容包括：tool、stack、features、templateVersion、managedAssets（含 bundle 成员追踪）。

### 2.5 Feature Flag 系统

通过 `--feature` 参数按需启用功能模块：

| Feature | 类型 | 说明 |
|---|---|---|
| `base` | 必装 | README, .gitignore 等基础文件 |
| `skills` | 必装 | 流水线 Skill bundle |
| `commands` | 必装 | AI 命令入口 |
| `docs` | 必装 | 项目指令文档 |
| `schema` | 必装 | Stack schema 和模板 |
| `structural-analysis-hint` | 可选 | 代码结构分析提示 |

---

## 三、流水线状态机 — 7 阶段门禁引擎

### 3.1 Phase 0-6 完整流程

```mermaid
flowchart TD
    START(["新需求 / 变更"]) --> P0["Phase 0 · 预检<br/>环境检查 · 入口类型判断"]

    P0 --> P1["Phase 1 · 提案<br/>Proposal → Specs → Design → Tasks"]

    P1 --> DP1{"决策点 1"}
    DP1 -->|"确认提案"| P2["Phase 2 · 实施<br/>按 tasks.md 逐条实现"]
    DP1 -->|"补充修改"| P1

    P2 --> DP2{"决策点 2"}
    DP2 -->|"进入审查"| P3["Phase 3 · 审查<br/>5 维度审查 · 最多 3 轮修复"]
    DP2 -->|"跳过审查"| P4["Phase 4 · 单测<br/>测试门禁验证"]
    DP2 -->|"需求有误"| P1

    P3 --> DP3{"决策点 3"}
    DP3 -->|"审查通过"| P4
    DP3 -->|"审查未过"| FIX["修复 → 再审"]
    FIX --> P3

    P4 --> DP4{"决策点 4"}
    DP4 -->|"需要单测"| UT["编写并运行单测"]
    UT --> P5["Phase 5 · 归档<br/>Verify → Delta Spec 合并"]
    DP4 -->|"跳过单测"| P5

    P5 -->|"归档完成"| DP5{"决策点 5"}
    DP5 -->|"仅推送"| P6["Phase 6 · 交付<br/>Commit → Push"]
    DP5 -->|"合并"| P6MERGE["Phase 6 · 交付<br/>Commit → Push → Merge"]

    P6 --> DONE(["交付完成"])
    P6MERGE --> DONE
```

### 3.2 状态持久化设计

状态文件以 `openspec/.pipeline-state/<changeName>.json` 存储，Schema v3 包含 26 个字段：

| 核心字段 | 说明 |
|---|---|
| `schemaVersion` | 固定为 3 |
| `_version` | 单调递增计数器，乐观并发控制 |
| `changeName` | kebab-case 格式的变更名称 |
| `status` | `active` / `paused` / `completed` |
| `executionMode` | `pipeline` / `standalone` / `hybrid` |
| `currentPhase` / `currentStep` | 当前所在阶段和步骤 |
| `phaseHistory` | 每个 Phase 的执行记录（执行人、耗时、决策） |
| `review` | 审查状态（轮次、报告、决策） |
| `tests` / `verify` | 测试和验证状态（尝试次数、结果） |
| `delivery` | 交付状态（commit SHA、推送状态、tag） |
| `fingerprintId` | RSA-OAEP 加密的防篡改签名 |
| `decisions` | 高风险决策键值存储 |

**原子写入**：状态更新采用 `write-to-temp + rename` 模式，确保崩溃不丢数据、不产生损坏文件。

**乐观并发控制**：每次写入递增 `_version`，读取时记录版本号，写入时检查版本是否一致，防止并发覆盖。

### 3.3 决策记录系统

每个高风险决策都记录在状态文件的 `decisions` 字段中，形成完整的决策审计链：

| 决策键 | 位置 | 说明 |
|---|---|---|
| `proposalApproved` | Phase 1 | 提案是否已批准 |
| `mergeStrategy` | Phase 6 | 合并策略（standard/squash/no-ff） |
| `postArchiveAction` | Phase 5 | 归档后动作（push/merge） |
| `skipReview` | Phase 2→4 | 是否跳过审查阶段 |
| `skipTests` | Phase 4 | 是否跳过测试门禁 |

### 3.4 可恢复性设计

流水线支持在任意阶段中断后精确恢复：

- 状态文件 `${change}.json` 是唯一恢复权威
- 恢复时并行核对：OpenSpec change 状态 + Git 分支/冲突 + 任务勾选 + 审查报告
- 状态与事实不一致 → 暂停并列出差异，禁止猜测跳阶段
- 状态丢失但 change 存在 → 询问用户后按检测事实重建

### 3.5 安全门禁机制

| 门禁 | 机制 |
|---|---|
| **敏感文件检测** | 自动扫描 `.env`、`*.key`、`*.pem`、`*.p12`、`*.pfx`、`credentials.json`、私钥块 |
| **禁止破坏性操作** | 禁用 `git add -A`、`git push --force`、`git branch -D` |
| **分步确认** | commit、push、merge、delete branch、create tag 各自独立确认，禁止合并审批 |
| **重试上限** | 审查修复最多 3 轮、测试/verify 最多 3 次尝试，超限自动暂停 |
| **合并冲突协议** | 列出冲突文件 → 逐文件选择策略（禁止全局 ours/theirs）→ 所有冲突解决后才允许完成 |

---

## 四、metrics-server — 指标采集与分析引擎

### 4.1 数据模型设计

13 张 Prisma 模型，分为四个逻辑层：

```
┌─────────────────────────────────────────────────────────┐
│  组织架构层                                               │
│  ┌──────────┐         ┌──────────────┐                  │
│  │  Team     │──────◀│  Developer   │                   │
│  │  树形层级  │        │  角色 · 团队归属 │                  │
│  └──────────┘         └──────┬───────┘                  │
│                              │                          │
├──────────────────────────────┼──────────────────────────┤
│  采集运行层                   │                          │
│  ┌──────────┐     ┌──────────▼───────┐                  │
│  │  Repo     │────▶│  PipelineRun     │                  │
│  │  Git 仓库  │     │  26 个字段 · 去重  │                  │
│  └──────────┘     └──┬───────┬───────┘                  │
│                      │       │                          │
│         ┌────────────┼───────┼──────────────┐           │
│         ▼            ▼       ▼              ▼           │
│  PhaseHistoryEntry  ReviewRound  PipelineDecision      │
│  PhaseEntryDecision ReviewRoundDecision                 │
│  PhaseEntryGate     PipelineGateBypassed               │
│                                                        │
├────────────────────────────────────────────────────────┤
│  审计日志层                                             │
│  ┌───────────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ CollectionLog  │  │ SyncLog   │  │ RetentionOpLog   │ │
│  │ 采集作业记录    │  │ 同步记录   │  │ 保留清理记录      │ │
│  └───────────────┘  └──────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**关键设计决策：**

- **Prisma ORM** 实现 MySQL/PostgreSQL 双数据库支持，通过 `DB_PROVIDER` 环境变量切换
- `PipelineRun` 使用 `(repoId, changeName, contentHash)` 唯一约束进行去重
- `isLatest` / `isLatestHistorical` 标记区分可信和全量快照的最新版本
- 所有指标查询强制过滤 `isLatest=true AND fingerprintVerified=true`

### 4.2 采集流水线

采集流水线是 metrics-server 的核心，共 5 个阶段：

```mermaid
flowchart LR
    subgraph Stage1["1. Git Scan"]
        A["clone/fetch 仓库"] --> B["检测 force push"]
        B --> C["构建 commit 列表<br/>过滤 collectSince"]
    end

    subgraph Stage2["2. State Extract"]
        D["git ls-tree<br/>列出 .pipeline-state/*.json"]
        D --> E["git show<br/>读取文件内容"]
    end

    subgraph Stage3["3. State Parse"]
        F["JSON.parse"]
        F --> G["Zod 严格校验<br/>Schema v3"]
    end

    subgraph Stage4["4. Fingerprint Verify"]
        H["RSA-OAEP 解密<br/>fp1.<base64url>"]
        H --> I["SHA-256 比对<br/>timingSafeEqual"]
    end

    subgraph Stage5["5. Upsert"]
        J["contentHash 去重"]
        J --> K["version 新鲜度检查"]
        K --> L["Developer 解析"]
        L --> M["isLatest 标记轮换"]
        M --> N["事务写入 + 缓存失效"]
    end

    Stage1 --> Stage2 --> Stage3 --> Stage4 --> Stage5
```

#### 阶段 1：Git Scan（`git-collector.ts`）

```typescript
// 核心逻辑
async function createGitScanPlan(repo, tempDir) {
  const { git, remoteHead } = await prepareRepository({ ... });
  const checkpoint = repo.lastFetchedCommit;
  const checkpointReachable = checkpoint
    ? await isAncestor(git, checkpoint, remoteHead)
    : true;
  return {
    scanFromCommit: checkpointReachable ? checkpoint : null,  // force push → null
    scanToCommit: remoteHead,
    forcePushDetected: Boolean(checkpoint && !checkpointReachable),
    commits: await relevantCommits(git, { scanFrom, scanTo, since: repo.collectSince }),
  };
}
```

- 首次采集：`scanFromCommit = null`，全量扫描
- 增量采集：从 `lastFetchedCommit` checkpoint 开始
- 检测 force push：checkpoint 无法从 remote HEAD 可达时，触发全量重新扫描

#### 阶段 2-3：State Extract + Parse

- 通过 `git ls-tree` 列出 commit 中 `openspec/.pipeline-state/` 下的所有 `.json` 文件
- 使用 `git show` 读取每个文件内容
- Zod 严格校验 Schema v3，包括 26 个字段的类型、格式、枚举值约束

#### 阶段 4：Fingerprint Verify（`fingerprint-verifier.ts`）

指纹验证是防篡改的核心机制：

```
┌─────────────────────────────────────────────────────────┐
│  生成端（CLI 模板中的公钥）                                 │
│                                                         │
│  canonicalizeFields(state) → SHA-256 → RSA-OAEP encrypt  │
│                                                         │
│  受保护字段: schemaVersion, changeName, createdAt,       │
│            createdBy, createdByEmail, machineInfo,       │
│            featureId, fingerprintNonce                   │
├─────────────────────────────────────────────────────────┤
│  验证端（metrics-server 私钥）                             │
│                                                         │
│  fingerprintId 格式: fp1.<base64url-ciphertext>          │
│                                                         │
│  privateDecrypt(RSA-OAEP-SHA256) → SHA-256 比对          │
│                                                         │
│  旧格式（32位 hex MD5）→ 标记为 legacy-unverified         │
└─────────────────────────────────────────────────────────┘
```

**两种指纹模式：**

| 模式 | 格式 | 验证 | 用途 |
|---|---|---|---|
| **Legacy** | 32 位 hex 字符串 | 不验证，标记为 `fingerprintVerified=false` | 历史数据兼容 |
| **Modern** | `fp1.<base64url>` | RSA-OAEP-SHA256 解密 + SHA-256 比对 | 可信指标数据 |

**两种采集模式：**

| 模式 | 接受指纹 | 用途 |
|---|---|---|
| **trusted** | 仅 Modern | 常规采集，只记录可信数据 |
| **history-import** | 仅 Legacy | 历史数据回填 |

#### 阶段 5：Upsert Engine（`upsert-engine.ts`）

在 Serializable 隔离级别的事务中执行：

```
1. contentHash 去重  →  (repoId, changeName, contentHash) 唯一约束
2. version 新鲜度检查  →  跳过 version 不高于当前 isLatest 的记录
3. Developer 解析     →  upsert Developer by email（仅 verified 指纹）
4. isLatest 标记轮换   →  清除旧记录的 isLatest/isLatestHistorical
5. 事务写入           →  PipelineRun + PhaseHistory + ReviewRounds + Decisions
6. 缓存失效           →  clearMetricsCache()
```

### 4.3 批量处理与断点续传

```typescript
// processInBatches — 每 100 个 commit 为一个批次
async function processInBatches(items, processItem, checkpoint, batchSize = 100) {
  for (let offset = 0; offset < items.length; offset += batchSize) {
    const batch = items.slice(offset, offset + batchSize);
    for (const item of batch) await processItem(item);  // 逐个处理
    const lastItem = batch.at(-1);
    if (lastItem) await checkpoint(lastItem, ...);       // 批次完成后 checkpoint
  }
}
```

**Checkpoint 策略**：每完成一个批次（100 个 commits），将 `repo.lastFetchedCommit` 和 `collectionLog` 进度字段在同一事务中更新。如果采集进程崩溃，下次启动时从最后一个 checkpoint 恢复，不会重复处理已成功的批次。

### 4.4 指标查询引擎

`MetricsService` 提供丰富的效能分析能力：

#### 核心指标（Overview）

| 指标 | 计算方式 | 说明 |
|---|---|---|
| `completionRate` | completedRuns / totalRuns | 完成率 |
| `abandonmentRate` | 已归档但未完成的 runs / totalRuns | 放弃率 |
| `avgCycleTimeMinutes` | 平均 changeDurationSeconds / 60 | 平均周期时间 |
| `avgEffectiveCycleTimeMinutes` | 各 Phase 实际耗时之和的平均值 / 60 | 有效周期（排除暂停） |
| `medianCycleTimeMinutes` | 中位数（PERCENTILE_CONT 或内存排序） | 中位周期时间 |
| `avgReviewRounds` | 平均 reviewCurrentRound | 平均审查轮次 |
| `reviewPassRate` | 首轮通过的 runs / 完成的 runs | 一次审查通过率 |
| `testFirstPassRate` | 1 次通过 / 有测试尝试的 runs | 测试首次通过率 |
| `overdueRate` | 超过 30 天未完成 / 成熟 runs | 逾期率 |
| `phaseBreakdown` | P50/P95 per phase | 各阶段耗时分布 |
| `recentTrend` | 每日完成数 + 平均周期 | 近期趋势 |

#### 指标分类详解

**周期时间（Cycle Time）：**

| 指标 | 含义 | 计算方式 |
|---|---|---|
| **平均周期时间** | 从创建到完成的平均耗时 | `avg(changeDurationSeconds) / 60` 分钟 |
| **中位周期时间** | 50% 的变更在此时间内完成 | PostgreSQL: `PERCENTILE_CONT(0.5)`；MySQL: 内存排序取中位 |
| **有效周期时间** | 排除暂停时间的实际工作效率 | 各 Phase 实际耗时之和（仅已完成 Phase） |
| **P95 周期时间** | 95% 的变更在此时间内完成 | `PERCENTILE_CONT(0.95)`；MySQL 限制最多 100k 行排序 |

**完成质量：**

| 指标 | 含义 | 公式 |
|---|---|---|
| **完成率** | 已完成的变更占比 | `completedRuns / totalRuns` |
| **放弃率** | 已归档但未完成的变更占比 | `abandonedRuns / totalRuns` |
| **逾期率** | 超过 30 天未完成的变更占比 | `overdueMatureRuns / matureRuns`（30 天为截止线） |

**审查效率：**

| 指标 | 含义 | 公式 |
|---|---|---|
| **平均审查轮次** | 平均每个变更经历的审查轮数 | `avg(reviewCurrentRound)` |
| **一次审查通过率** | 首轮审查即通过的比例 | `firstRoundPassed / completedRuns`（reviewStatus=passed 且 reviewCurrentRound=1） |

**测试效率：**

| 指标 | 含义 | 公式 |
|---|---|---|
| **测试首次通过率** | 一次测试即通过的比例 | `testsAttempts=1 AND passed / 有测试尝试的 runs` |
| **平均测试尝试次数** | 平均每个变更的测试执行次数 | `avg(testsAttempts)` |

**Phase 耗时分布：**

| Phase | 名称 | 典型耗时 | 说明 |
|---|---|---|---|
| 0 | 预检 | 数秒 | 环境检查，几乎无耗时 |
| 1 | 提案 | 数分钟 | AI 生成四个制品 |
| 2 | 实施 | 数十分钟 | 代码编写，耗时最长 |
| 3 | 审查 | 数分钟 | 自动审查 + 修复循环 |
| 4 | 单测 | 数分钟 | 测试运行 + 修复重试 |
| 5 | 归档 | 数十秒 | 校验 + Delta Specs 合并 |
| 6 | 交付 | 数秒 | Commit + Push + Merge |

通过 P50/P95 分位数可以识别瓶颈阶段——例如 Phase 2 P95 显著高于 P50 说明部分变更的实施复杂度差异大。

#### 数据驱动改进方向

| 观察现象 | 可能原因 | 改进方向 |
|---|---|---|
| 周期时间上升 | 变更复杂度增加、审查瓶颈 | 控制变更粒度、优化审查流程 |
| 逾期率上升 | 变更被阻塞、优先级不清晰 | 定期清理过期变更、加强优先级管理 |
| 审查轮次增加 | 代码质量下降、规范不清晰 | 加强 Phase 1 提案质量、补充规范 |
| 测试首次通过率低 | 测试用例不完善、AI 生成代码质量 | 完善测试模板、加强 Phase 2 实施质量 |
| Phase 2 耗时占比过高 | 实施任务过多、AI 理解偏差 | 细化 tasks.md、加强 spec 质量 |
| 放弃率异常 | 需求变更频繁、技术可行性不足 | 加强 Phase 1 提案评审 |

#### 缓存策略

| 缓存层 | TTL | 失效机制 |
|---|---|---|
| **Team Cache** | 60s (`METRICS_TEAM_CACHE_TTL_MS`) | 组织同步后调用 `clearTeamCache()` |
| **Metrics Result Cache** | 15s (`METRICS_RESULT_CACHE_TTL_MS`) | Upsert 成功后调用 `clearMetricsCache()` |

缓存基于 Prisma 实例的 WeakMap，确保不同数据库实例之间隔离。

### 4.5 权限体系

三级权限模型：

```
                    ┌──────────────────┐
                    │  Service API Key  │  ← SHA-256 哈希存储
                    │  x-api-key header │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        session-exchange  management     (其他)
              │              │
              ▼              ▼
        ┌──────────┐   ┌──────────┐
        │   JWT    │   │  Admin   │
        │  Bearer  │   │  Routes  │
        └────┬─────┘   └──────────┘
             │
    ┌────────┼────────┐
    ▼        ▼        ▼
  Admin   Member   (无权限)
    │        │
    ▼        ▼
  全量    团队子树
  可见    可见
```

| 认证方式 | 适用场景 | 权限范围 |
|---|---|---|
| **Service API Key** (`x-api-key`) | 服务间调用（如 session exchange） | `session-exchange` 或 `management` purposes |
| **JWT Bearer Token** | 用户登录后的 API 调用 | 用户角色（admin/member）+ 团队范围 |
| **Dev Impersonation** (仅 dev) | 开发环境调试 | 模拟指定开发者 |

**Team Scope**：非管理员用户只能看到自己团队及其子团队的指标数据，通过递归 CTE 查询团队子树实现。

**Token 吊销**：通过 `tokenVersion` 字段实现——修改数据库中的 `tokenVersion` 即可使所有已签发的 JWT 立即失效。

### 4.6 部署与配置

#### 环境变量体系

metrics-server 使用 Zod 对所有环境变量进行严格校验，核心配置项：

```bash
# ─── 运行环境 ───
NODE_ENV=production                    # development | test | production
PORT=3001                              # API 监听端口

# ─── 数据库 ───
DB_PROVIDER=postgresql                 # postgresql | mysql — 通过 Prisma 切换
DATABASE_URL=postgresql://user:pass@localhost:5432/metrics

# ─── 安全 ───
JWT_SECRET=<至少 32 字符的随机字符串>     # 生产环境禁止使用 placeholder
SERVICE_API_KEYS='{"key1":{"sha256":"<hash>","purposes":["session-exchange","management"]}}'
FINGERPRINT_PRIVATE_KEYS='{"fp1":"<base64 编码的 PEM 私钥>"}'

# ─── 采集器 ───
COLLECTOR_CRON_SCHEDULE="0 */4 * * *"  # 采集频率，默认每 4 小时
COLLECTOR_CONCURRENCY=2                 # 并发采集数，1-16
COLLECTOR_LOCK_TIMEOUT=7200000          # 锁超时 (ms)，默认 2 小时
COLLECTOR_TRANSACTION_RETRIES=3         # 事务重试次数
COLLECTOR_RETRY_BASE_DELAY=50           # 重试基础延迟 (ms)

# ─── 缓存 ───
METRICS_TEAM_CACHE_TTL_MS=60000        # 团队子树缓存 TTL，默认 60s
METRICS_RESULT_CACHE_TTL_MS=15000      # 指标结果缓存 TTL，默认 15s，设为 0 禁用

# ─── 数据保留 ───
RETENTION_ENABLED=false                 # 是否启用保留清理
RETENTION_DRY_RUN=true                  # true=仅分类不删除
RETENTION_CONFIRMATION=DELETE_EXPIRED_SNAPSHOTS  # 必须等于此值才真正删除

# ─── CORS ───
CORS_ORIGIN=http://localhost:3000       # 允许的前端域名，逗号分隔

# ─── 组织同步适配器（可选） ───
FEISHU_APP_ID=                         # 飞书应用 ID
FEISHU_APP_SECRET=                     # 飞书应用密钥
LDAP_URL=                              # LDAP 服务地址
LDAP_BIND_DN=                          # LDAP 绑定 DN
WECOM_CORP_ID=                         # 企业微信 Corp ID
```

**生产环境安全校验：**

- `JWT_SECRET` 禁止使用 placeholder 值（如 `change-me`、`test-secret`）
- 禁止使用原始 `API_KEY`（必须使用 `SERVICE_API_KEYS` 哈希）
- `DEV_IMPERSONATE_DEVELOPER_ID` 在生产环境禁用
- `DATABASE_URL` 协议必须与 `DB_PROVIDER` 一致

#### 数据库初始化

```bash
cd metrics-server
npm install
npm run prisma:generate    # 生成 Prisma Client
npm run prisma:migrate     # 执行数据库迁移
npm run prisma:verify-db   # 验证数据库连接
```

**MySQL/PostgreSQL 切换：** 修改 `DB_PROVIDER` 和 `DATABASE_URL` 后重新运行迁移即可。Prisma schema 使用 `env("DB_PROVIDER")` 动态切换 provider，自动为每种数据库生成对应 DDL。

#### 启动方式

```bash
npm run dev                # 开发模式（tsx watch 热重载）
npm run start              # 生产模式
npm run collector -- --all # CLI 手动采集所有仓库
npm run collector -- --repo 1        # 采集指定仓库
npm run collector -- --all --dry-run # 仅扫描不写入
npm run collector -- --daemon --schedule "0 */4 * * *"  # 守护进程模式
```

服务启动后自动启动采集和保留清理两个调度器，并立即执行一次。

#### 指纹密钥管理

```bash
# 生成 RSA-2048 密钥对
openssl genpkey -algorithm RSA -out private.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -pubout -in private.pem -out public.pem

# 配置私钥到 metrics-server
FINGERPRINT_PRIVATE_KEYS='{"fp1":"'$(base64 private.pem | tr -d '\n')'"}'

# 公钥硬编码在 CLI 模板中
# templates/common/skills/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs
```

流水线状态文件生成时使用公钥加密，metrics-server 使用私钥解密验证。生成端对固定字段执行 canonical JSON 序列化后计算 SHA-256，再用 RSA-OAEP-SHA256 加密。完整安全边界：固定公钥只能检测直接篡改，不能阻止公钥持有者为伪造内容重新加密。

---

## 五、组织同步 — 多源组织数据接入

### 5.1 适配器架构

```
┌──────────────────────────────────────────────────────┐
│                 OrganizationAdapter                   │
│                   interface                          │
├──────────────────────────────────────────────────────┤
│  name: string                                        │
│  capabilities: { pull, preview, dryRun }              │
│  pull(): Promise<OrgData>                            │
│  preview(): Promise<OrgSyncDiff>                      │
├──────────┬───────────────┬───────────────────────────┤
│          │               │                           │
│  Feishu  │     LDAP      │         WeCom             │
│  飞书适配 │   LDAP 适配   │       企业微信适配          │
└──────────┴───────────────┴───────────────────────────┘
```

### 5.2 数据格式

```typescript
// 标准组织数据格式
interface OrgData {
  teams: Array<{
    externalId: string;
    name: string;
    slug: string;
    parentExternalId?: string | null;
  }>;
  developers: Array<{
    externalId: string;
    email: string;
    name: string;
    teamExternalId?: string | null;
  }>;
}
```

### 5.3 Preview → Apply 两阶段工作流

```mermaid
flowchart LR
    PULL["Pull 组织数据<br/>从适配器或 JSON"] --> VALIDATE["Zod 校验<br/>去重 · 循环检测 · 外键完整"]
    VALIDATE --> PREVIEW["Preview 预览<br/>计算 Diff"]
    PREVIEW --> REVIEW["人工审核 Diff<br/>确认变更"]
    REVIEW --> APPLY["Apply 应用<br/>事务写入 · 缓存失效"]
```

**校验规则：**
- 团队 externalId 和 slug 不可重复
- 团队层级无循环引用
- 父团队必须存在于当前快照中
- 开发者 externalId 和邮箱不可重复
- 开发者所属团队必须存在于快照中

### 5.4 Diff 与增量同步

同步时计算以下差异维度：

| 维度 | 说明 |
|---|---|
| `teamsCreated` | 新建团队数 |
| `teamsUpdated` | 更新团队数（名称、slug、父团队变更） |
| `teamsMoved` | 团队层级移动数 |
| `teamsDeactivated` | 停用团队数（快照中不存在但数据库中活跃的） |
| `devsCreated` | 新建开发者数 |
| `devsUpdated` | 更新开发者数（邮箱、名称、团队变更） |
| `devsLinked` | 开发者关联数（通过邮箱匹配到已有记录） |
| `devsMoved` | 开发者团队变更数 |
| `devsUnassigned` | 开发者取消团队分配数 |
| `devsDeactivated` | 停用开发者数 |

---

## 六、运维保障

### 6.1 定时调度

```typescript
// 采集调度器 — 默认每 4 小时
COLLECTOR_CRON_SCHEDULE = "0 */4 * * *"

// 数据保留调度器 — 默认每天凌晨 2:30
RETENTION_CRON_SCHEDULE = "30 2 * * *"
```

两个调度器在服务启动时也会立即执行一次。

### 6.2 数据保留策略

PipelineRun 数据按时间窗口分为三级：

| 级别 | 条件 | 操作 |
|---|---|---|
| **Hot** | `updatedAtPipeline >= cutoff`（保留窗口内） | 保留 |
| **Warm** | `updatedAtPipeline < cutoff` 但 `isLatest=true` 或 `isLatestHistorical=true` | 保护，不删除 |
| **Cold** | 超出保留窗口，且不是最新版本 | 可删除 |

保留操作需要确认：
- `RETENTION_ENABLED=true`
- `RETENTION_CONFIRMATION=DELETE_EXPIRED_SNAPSHOTS`
- 否则仅运行 `checked` 模式（分类但不删除）

### 6.3 错误恢复机制

**采集作业生命周期：**

```
queued → running → completed
                 → error (带错误分类)
                 → cancelled (管理员取消)
                 → timeout (心跳超时)
```

**错误分类：**

| 类别 | 说明 | 是否可重试 |
|---|---|---|
| `transaction-conflict` | 事务冲突，可能是并发 upsert | 可重试 |
| `transaction-timeout` | 事务超时 | 可重试 |
| `database` | 其他数据库错误 | 视情况 |
| `git` | Git 操作失败 | 可重试 |
| `system` | 未知系统错误 | 需排查 |

**Stale Job 恢复**：`recoverStaleJobs()` 定期扫描心跳超过 `COLLECTOR_LOCK_TIMEOUT`（默认 2 小时）的 running 作业，标记为 `timeout` 并释放 repo 锁。

**事务重试**：`withTransactionRetry()` 在遇到可重试的数据库错误时自动重试，最多 3 次，基础延迟 50ms。

### 6.4 安全设计

| 安全措施 | 实现 |
|---|---|
| **Service Key 哈希存储** | `SERVICE_API_KEYS` 配置使用 SHA-256 哈希，不存储原始密钥 |
| **JWT tokenVersion** | 修改数据库中的 `tokenVersion` 可使所有已签发 JWT 立即失效 |
| **生产环境保护** | 禁止 placeholder 密钥、禁止原始 API_KEY、禁止开发者模拟 |
| **速率限制** | `express-rate-limit` 300 请求/分钟 |
| **安全头** | `helmet` 中间件 |
| **CORS** | 白名单机制，从 `CORS_ORIGIN` 环境变量配置 |

---

## 附录：技术指标速览

| 指标 | 数值 |
|---|---|
| CLI 命令 | 6 个 (init / sync / upgrade / uninstall / list-tools / doctor) |
| 流水线 Phase | 7 个 (Phase 0-6) |
| AI 工具适配 | 3 个 (Claude Code / Cursor / Codex) |
| 技术栈模板 | 2 套 (Frontend: React+Vite / Backend: Spring Boot) |
| 流水线脚本 | 10 个 (9 功能脚本 + 1 状态机) |
| 数据库模型 | 13 张表 |
| API 端点 | 30+ |
| 采集阶段 | 5 (Git Scan → Extract → Parse → Verify → Upsert) |
| 组织同步适配器 | 3 个 (Feishu / LDAP / WeCom) |
| 安全检测 | 9 类敏感文件自动扫描 |