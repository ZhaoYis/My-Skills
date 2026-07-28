# AI 开发能效指标统计系统 — 架构设计方案

> 基于 `pipeline-state-fields.md` 中记录的 `.pipeline-state/*.json` 数据（Schema v3，26 个字段），构建完整的指标统计系统，用于量化团队中每位开发者使用 AI 开发流水线的能效。

---

## 1. 整体架构

```
┌─────────────────────────┐     ┌─────────────────────────┐     ┌────────────────────────┐
│   metrics-website        │     │   metrics-server         │     │   MySQL / PostgreSQL   │
│   (Next.js :3000)        │────▶│   (Express :3001)        │────▶│   (可配置切换)           │
│                          │     │                          │     │                        │
│   - 个人仪表盘            │     │   - REST API              │     │   - teams              │
│   - 团队面板              │     │   - 认证中间件             │     │   - developers         │
│   - 管理页面              │     │   - 团队可见性             │     │   - repos              │
│   - Recharts 图表         │     │   - 指标聚合服务           │     │   - pipeline_runs      │
└─────────────────────────┘     │                          │     │   - phase_history      │
                                │   - Collector CLI         │     │   - review_rounds      │
                                │   - node-cron 定时器       │     │   - decisions          │
                                └──────────┬───────────────┘     │   - collection_log     │
                                           │                     └────────────────────────┘
                                           │ git clone/fetch
                                           ▼
                                ┌──────────────────┐
                                │  Git Repositories │
                                │  (配置的仓库URL)   │
                                └──────────────────┘
```

### 数据流

```
定时任务 → git fetch 各仓库 → 遍历 commits →
  提取 openspec/.pipeline-state/*.json →
  解析校验 → 私钥验证 fingerprintId → content_hash 去重 →
  upsert 数据库（MySQL 或 PostgreSQL）→ API 聚合查询 → Dashboard 展示
```

### 数据库抽象层

使用 **Prisma ORM** 实现数据库无关的数据访问层。Prisma schema 的 `datasource` 原生支持通过环境变量切换数据库：

```prisma
// prisma/schema.prisma
datasource db {
  provider = env("DB_PROVIDER")  // "mysql" | "postgresql"
  url      = env("DATABASE_URL")
}
```

切换方式：一套 schema、一套 Prisma Client、一条 URL 即可切换：

```
                    ┌──────────────────────┐
                    │   Prisma ORM          │
                    │   (schema.prisma)      │
                    │                        │
                    │   datasource provider  │
                    │   = env("DB_PROVIDER") │
                    │                        │
                    │   统一的 schema        │
                    │   统一的 Prisma Client │
                    │   统一的 Prisma Migrate │
                    └───────┬──────┬─────────┘
                            │      │
              DB_PROVIDER=mysql   DB_PROVIDER=postgresql
              DATABASE_URL=mysql: DATABASE_URL=postgresql:
                            │      │
                            ▼      ▼
                     ┌──────────┐  ┌──────────────┐
                     │  MySQL    │  │  PostgreSQL   │
                     └──────────┘  └──────────────┘
```

---

## 2. 子项目结构

```
dev-pipeline/
  metrics-server/              # Express API + 采集器（共享 DB 层）
    package.json
    tsconfig.json
    biome.json
    prisma/
      schema.prisma            # Prisma schema（provider 通过 env 切换）
      migrations/              # Prisma Migrate 自动生成
    src/
      server.ts                # Express API 入口
      collector.ts             # 采集器 CLI 入口
      config/
        database.ts            # Prisma Client 初始化
        env.ts                 # 环境变量（dotenv + zod 校验）
      models/                  # Repository 层（基于 Prisma Client）
        team.ts
        developer.ts
        repo.ts
        pipeline-run.ts
        phase-entry.ts
        review-round.ts
        decision.ts
        collection-log.ts
      collectors/
        git-collector.ts       # clone/fetch + commit 遍历
        state-extractor.ts     # git show 提取 JSON
        state-parser.ts        # Zod 校验 pipeline state
        fingerprint-verifier.ts # 私钥解密并校验 fingerprintId
        upsert-engine.ts       # content_hash 去重 + 事务 upsert
      api/
        router.ts
        middleware/
          auth.ts              # JWT/API Key 认证
          team-scope.ts        # 团队层级可见性
        routes/
          metrics.ts           # GET /api/metrics/*
          repos.ts             # CRUD /api/repos
          teams.ts             # CRUD /api/teams
          developers.ts        # CRUD /api/developers
          collection.ts        # POST /api/collection/trigger
          sync.ts              # POST /api/sync/org
      services/
        metrics-service.ts     # 聚合查询（Prisma Client + 原生 SQL）
        team-service.ts
        repo-service.ts
        collection-service.ts
      scheduler/
        cron.ts                # node-cron 定时器
      utils/
        hash.ts                # MD5 内容哈希
        git-helpers.ts         # simple-git 封装
        logger.ts              # 结构化日志（pino）

  metrics-website/             # Next.js Dashboard（同上）
    ...

  templates/common/skills/opsx-dev-pipeline/scripts/
    dev-pipeline-state.mjs     # 使用模板内固定公钥生成 fingerprintId
```

---

## 3. 数据模型（Prisma — 单一 Schema，双数据库）

### 3.1 设计原则

- Prisma schema 的 `datasource` 块使用 `env("DB_PROVIDER")` 动态切换 `provider`
- 通过 `env("DATABASE_URL")` 传入完整连接字符串
- Prisma Migrate 为每种数据库自动生成对应的 DDL（MySQL: `@db.Text`, PostgreSQL: `@db.Text` 等）
- 枚举用 `String` + 应用层 Zod 校验（避免 MySQL ENUM 和 Pg 无原生 ENUM 的差异）
- `@updatedAt` 只对 Prisma Client 层生效；数据库层 MySQL 用 `ON UPDATE CURRENT_TIMESTAMP`，Pg 用触发器 Prisma 自动创建
- JSON 字段在 MySQL 映射为 `Json`，Pg 映射为 `JsonB`，Prisma 统一处理

### 3.2 完整 Prisma Schema（14 张表）

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = env("DB_PROVIDER")   // "mysql" | "postgresql"
  url      = env("DATABASE_URL")
}

// ─── 组织架构 ───

model Team {
  id         Int       @id @default(autoincrement())
  name       String    @db.VarChar(128)
  slug       String    @unique @db.VarChar(128)
  parentId   Int?
  externalId String?   @unique @db.VarChar(255)
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  parent    Team?        @relation("TeamHierarchy", fields: [parentId], references: [id], onDelete: SetNull)
  children  Team[]       @relation("TeamHierarchy")
  developers Developer[]

  @@index([parentId])
  @@index([externalId])
}

// ─── 开发者 ───

model Developer {
  id            Int       @id @default(autoincrement())
  email         String    @unique @db.VarChar(255)
  displayName   String?   @db.VarChar(255)
  role          String?   @db.VarChar(16)   // admin | member (null=未分配)，预留 RBAC 扩展
  teamId        Int?
  externalId    String?   @unique @db.VarChar(255)
  firstSeenAt   DateTime
  lastSeenAt    DateTime
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  team          Team?          @relation(fields: [teamId], references: [id], onDelete: SetNull)
  pipelineRuns  PipelineRun[]

  @@index([email])
  @@index([teamId])
}

// ─── 配置仓库 ───

model Repo {
  id                 Int       @id @default(autoincrement())
  name               String    @db.VarChar(255)
  gitUrl             String    @db.VarChar(512)
  gitBranch          String    @default("main") @db.VarChar(255)
  collectSince       DateTime
  lastFetchedCommit  String?   @db.Char(40)
  lastFetchedAt      DateTime?
  collectionStatus   String    @default("idle") @db.VarChar(16)   // idle | running | error
  collectionStartedAt DateTime?                                              // 采集开始时间，用于超时检测
  collectionError    String?   @db.Text
  isActive           Boolean   @default(true)
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  pipelineRuns   PipelineRun[]
  collectionLogs CollectionLog[]

  @@index([collectionStatus, isActive])
}

// ─── Pipeline 主表 ───

model PipelineRun {
  id                BigInt    @id @default(autoincrement())
  repoId            Int
  developerId       Int?
  changeName        String    @db.VarChar(128)
  schemaVersion     Int       @default(3)
  stateVersion      Int
  sourceBranch      String    @db.VarChar(255)
  targetBranch      String?   @db.VarChar(255)
  currentPhase      Int
  currentStep       Int
  status            String    @db.VarChar(16)                     // active | paused | completed
  executionMode     String    @db.VarChar(16)                     // pipeline | standalone | hybrid
  isLatest          Boolean   @default(true)
  fingerprintId         String    @db.VarChar(512)                 // fp1.<RSA-OAEP ciphertext>
  fingerprintNonce      String    @db.Char(8)
  fingerprintVerified   Boolean   @default(false)
  fingerprintKeyVersion String?   @db.VarChar(16)
  createdByEmail         String    @db.VarChar(255)                 // 指纹验真字段，来自 state 文件
  createdBy              String    @db.VarChar(128)                 // 指纹验真字段，来自 state 文件
  createdAtSource        DateTime                                   // state 文件原始 createdAt，与 createdAtPipeline 区分

  // Machine info（扁平化，不拆表）
  machinePlatform      String?  @db.VarChar(64)
  machineHostname      String?  @db.VarChar(255)
  machineOsRelease     String?  @db.VarChar(64)
  machineNodeVersion   String?  @db.VarChar(32)
  machineArch          String?  @db.VarChar(16)

  featureId    String?  @db.VarChar(255)
  featureUrl   String?  @db.VarChar(1024)
  archivePath  String?  @db.VarChar(512)
  pauseReason  String?  @db.VarChar(255)

  // Delivery
  deliveryCommitSha       String?  @db.Char(40)
  deliveryMergeCommitSha  String?  @db.Char(40)
  deliverySourcePushed    Boolean  @default(false)
  deliveryTargetPushed    Boolean  @default(false)
  deliveryTag             String?  @db.VarChar(255)

  // Review
  reviewStatus       String  @default("pending") @db.VarChar(16) // pending | passed | issues-found
  reviewCurrentRound Int     @default(0)

  // Tests
  testsCommand   String?  @db.VarChar(1024)
  testsAttempts  Int      @default(0)
  testsStatus    String   @default("pending") @db.VarChar(16)    // pending | passed | failed | skipped | debt-recorded
  testsDetail    String?  @db.Text

  // Verify
  verifyCommand   String?  @db.VarChar(1024)
  verifyAttempts  Int      @default(0)
  verifyStatus    String   @default("pending") @db.VarChar(16)   // pending | passed | failed | skipped
  verifyDetail    String?  @db.Text

  // Timestamps
  createdAtPipeline      DateTime
  updatedAtPipeline      DateTime
  changeDurationSeconds  Int?

  // Dedup & trace
  contentHash      String   @db.Char(32)
  rawStateJson     Json?                                          // 原始 state JSON 全文，便于追溯和重新验真
  commitSha        String   @db.Char(40)
  commitTimestamp  DateTime
  extractedAt      DateTime  @default(now())

  // Relations
  repo        Repo              @relation(fields: [repoId], references: [id], onDelete: Cascade)
  developer   Developer?        @relation(fields: [developerId], references: [id], onDelete: SetNull)
  phaseHistory PhaseHistoryEntry[]
  reviewRounds ReviewRound[]
  decisions    PipelineDecision[]
  gatesBypassed PipelineGateBypassed[]

  @@unique([repoId, changeName, contentHash])
  @@index([repoId])
  @@index([developerId])
  @@index([isLatest])
  @@index([fingerprintId])
  @@index([fingerprintVerified])
  @@index([status])
  @@index([commitSha])
  @@index([createdAtPipeline])
  @@index([repoId, changeName])
}

// ─── 阶段历史 ───

model PhaseHistoryEntry {
  id              BigInt    @id @default(autoincrement())
  runId           BigInt
  phase           Int                                                  // 0-6
  step            Int
  executedBy      String    @db.VarChar(128)
  status          String    @db.VarChar(16)                            // in-progress | completed | abandoned
  startedAt       DateTime
  completedAt     DateTime?
  durationSeconds Int?

  run              PipelineRun            @relation(fields: [runId], references: [id], onDelete: Cascade)
  decisions        PhaseEntryDecision[]
  gatesBypassed    PhaseEntryGate[]

  @@index([runId])
  @@index([phase])
}

// ─── 审查轮次 ───

model ReviewRound {
  id           BigInt    @id @default(autoincrement())
  runId        BigInt
  roundNumber  Int
  reportPath   String?   @db.VarChar(512)
  status       String    @db.VarChar(16)                              // passed | issues-found
  recordedAt   DateTime

  run       PipelineRun            @relation(fields: [runId], references: [id], onDelete: Cascade)
  decisions ReviewRoundDecision[]

  @@unique([runId, roundNumber])
}

// ─── Decisions / Gates 辅助表 ───

model PipelineDecision {
  id             BigInt       @id @default(autoincrement())
  runId          BigInt
  decisionKey    String       @db.VarChar(64)
  decisionValue  Json
  run            PipelineRun  @relation(fields: [runId], references: [id], onDelete: Cascade)

  @@unique([runId, decisionKey])
}

model PipelineGateBypassed {
  id        BigInt       @id @default(autoincrement())
  runId     BigInt
  gateName  String       @db.VarChar(128)
  run       PipelineRun  @relation(fields: [runId], references: [id], onDelete: Cascade)

  @@index([runId])
}

model PhaseEntryDecision {
  id             BigInt             @id @default(autoincrement())
  phaseEntryId   BigInt
  decisionKey    String             @db.VarChar(64)
  decisionValue  Json
  phaseEntry     PhaseHistoryEntry  @relation(fields: [phaseEntryId], references: [id], onDelete: Cascade)

  @@unique([phaseEntryId, decisionKey])
}

model PhaseEntryGate {
  id           BigInt             @id @default(autoincrement())
  phaseEntryId BigInt
  gateName     String             @db.VarChar(128)
  phaseEntry   PhaseHistoryEntry  @relation(fields: [phaseEntryId], references: [id], onDelete: Cascade)

  @@index([phaseEntryId])
}

model ReviewRoundDecision {
  id             BigInt       @id @default(autoincrement())
  reviewRoundId  BigInt
  decisionKey    String       @db.VarChar(64)
  decisionValue  Json
  reviewRound    ReviewRound  @relation(fields: [reviewRoundId], references: [id], onDelete: Cascade)

  @@unique([reviewRoundId, decisionKey])
}

// ─── 采集日志 ───

model CollectionLog {
  id              BigInt    @id @default(autoincrement())
  repoId          Int
  startedAt       DateTime
  finishedAt      DateTime?
  status          String    @default("running") @db.VarChar(16)       // running | completed | error
  commitsScanned  Int       @default(0)
  filesFound      Int       @default(0)
  runsUpserted    Int       @default(0)
  runsSkipped     Int       @default(0)
  fingerprintsRejected Int  @default(0)
  errorMessage    String?   @db.Text

  repo            Repo      @relation(fields: [repoId], references: [id], onDelete: Cascade)

  @@index([repoId])
}

// ─── 组织同步日志 ───

model SyncLog {
  id           BigInt    @id @default(autoincrement())
  source       String    @db.VarChar(32)     // feishu | ldap | wecom
  status       String    @default("running") @db.VarChar(16)  // running | completed | error
  startedAt    DateTime
  finishedAt   DateTime?
  teamsCreated Int       @default(0)
  teamsUpdated Int       @default(0)
  devsLinked   Int       @default(0)
  errorMessage String?   @db.Text

  @@index([status])
}
```

### 3.3 跨数据库兼容 — Prisma 自动处理

Prisma Migrate 根据 `provider` 自动生成正确的 DDL：

| 特性 | MySQL 输出 | PostgreSQL 输出 | Schema 写法 |
|------|-----------|----------------|-------------|
| 自增主键 | `INT AUTO_INCREMENT` | `SERIAL` / `IDENTITY` | `@default(autoincrement())` |
| 布尔 | `TINYINT(1)` | `BOOLEAN` | `Boolean` |
| JSON | `JSON` | `JSONB` | `Json` |
| 字符主键 | `CHAR(n)` | `CHAR(n)` | `@db.Char(n)` |
| 变长字符串 | `VARCHAR(n)` | `VARCHAR(n)` | `@db.VarChar(n)` |
| 长文本 | `TEXT` | `TEXT` | `@db.Text` |
| 唯一约束 | `UNIQUE INDEX` | `UNIQUE INDEX` | `@unique` / `@@unique([...])` |
| 级联删除 | `ON DELETE CASCADE` | `ON DELETE CASCADE` | `onDelete: Cascade` |
| 更新时间戳 | `ON UPDATE CURRENT_TIMESTAMP` | Prisma 创建的触发器 | `@updatedAt` |
| 默认时间戳 | `DEFAULT CURRENT_TIMESTAMP` | `DEFAULT NOW()` | `@default(now())` |
| 枚举 | `ENUM(...)` | `VARCHAR + CHECK` | 统一用 `String + @db.VarChar` + Zod 校验 |

> **注意**：唯一需要手动处理的是 `@updatedAt` 在 PostgreSQL 下依赖 Prisma Migrate 自动创建的触发器——这对应用层是透明的。

### 3.4 切换流程

```bash
# 切换到 PostgreSQL
export DB_PROVIDER=postgresql
export DATABASE_URL=postgresql://user:pass@localhost:5432/opsx_metrics
npx prisma migrate deploy

# 切换到 MySQL
export DB_PROVIDER=mysql
export DATABASE_URL=mysql://user:pass@localhost:3306/opsx_metrics
npx prisma migrate deploy
```

Prisma Client 在 `npx prisma generate` 时根据当前 `DATASOURCE` 生成目标数据库的查询引擎，`prisma migrate` 同样自动适配 DDL 方言。

---

## 4. 数据采集器

### 4.1 采集算法

```
For each active repo:
  1. 首次: git clone --branch <branch> --single-branch <url>
     后续: git fetch origin <branch>

  2. 确定 commit 范围并直接过滤到相关 commit:
     - 无 last_fetched_commit →
         git log --reverse --after=<collect_since> --diff-filter=ACMR
           --name-only -- openspec/.pipeline-state/ --format="%H %aI"
     - 有 last_fetched_commit →
         git log --reverse <last_sha>..HEAD --diff-filter=ACMR
           --name-only -- openspec/.pipeline-state/ --format="%H %aI"

     关键优化: --diff-filter=AM + 路径过滤，一步跳过 97% 无关 commit

  3. For each 过滤后的 commit in order:
     a. git ls-tree --name-only <sha> -- openspec/.pipeline-state/
     b. 对每个 *.json:
        i.   git show <sha>:openspec/.pipeline-state/<file>
        ii.  解析 JSON，Zod 校验（仅处理 schemaVersion=3）
        iii. 解密 fingerprintId，并与受保护字段的 SHA-256 摘要进行常量时间比较
        iv.  fingerprint 校验失败 → 拒绝入库并记录 collection_log
        v.   计算 MD5(content)
        vi.  检查 content_hash 是否存在 → 跳过（去重）
        vii. 将原始 JSON 存入 rawStateJson 字段
        viii.事务内 upsert pipeline_run + 全部子表（含 stateVersion 比较）
     c. 记录 file count

  4. 更新 last_fetched_commit, last_fetched_at
  5. 写入 collection_log
```

**复杂度**：从 O(全部 commits) = ~3,600 → O(相关 commits) = ~50-100，减少 97% 的 git 调用。

### 4.2 `fingerprintId` 非对称加密与校验

项目模板在 `dev-pipeline-state.mjs` 中固定提供 RSA-2048 公钥常量 `FINGERPRINT_PUBLIC_KEY_PEM`。私钥只部署到 `metrics-server`，不得写入项目模板、源码仓库、日志或状态文件。

生成端使用 Node.js 内置 `node:crypto`：

```text
protectedFields = canonicalJson({
  schemaVersion,
  changeName,
  createdAt,
  createdBy,
  createdByEmail,
  machineInfo,
  featureId,
  fingerprintNonce
})

digest = SHA-256(UTF-8(protectedFields))
ciphertext = RSA-OAEP-SHA256.publicEncrypt(FINGERPRINT_PUBLIC_KEY_PEM, digest)
fingerprintId = "fp1." + base64url(ciphertext)
```

- `canonicalJson` 必须固定字段顺序、字符串编码和空值表示，生成端与采集端共用同一规范。
- `featureId` 取 `featureInfo?.featureId ?? ""` 并纳入摘要；`featureUrl` 及其他可变字段不参与计算。
- 通过 `set featureInfo` 或 `set featureInfo.featureId` 受控修改需求 ID 时，状态脚本必须在同一次原子保存中使用原 nonce 重新生成 `fingerprintId`；直接修改 JSON 不会触发重算，采集时校验失败。
- `fp1` 是密钥/算法版本。RSA-2048 密文经 Base64URL 编码后为 342 字符，完整字段不超过 346 字符，数据库预留 `VARCHAR(512)`。
- RSA-OAEP 自带随机填充，相同摘要也会产生不同密文；`fingerprintNonce` 保留用于兼容现有 Schema 和显式区分不同 change。

采集端校验流程：

```text
1. 解析 fingerprintId 的 fp1 前缀并选择对应私钥
2. 使用 RSA-OAEP-SHA256 解密，得到 32 字节 digest
3. 从状态文件重建 canonicalJson，重新计算 SHA-256
4. 使用 timingSafeEqual 比较两个摘要
5. 通过后设置 fingerprintVerified=true；失败则拒绝该快照入库并记录原因
```

私钥通过 `FINGERPRINT_PRIVATE_KEYS` 注入为版本化 key ring，便于后续轮换；当前模板固定使用 `fp1` 公钥。启动时必须校验私钥可解析且包含 `fp1`，缺失时采集器 fail-fast，不能降级为跳过验真。

> 安全边界：公钥加密可以检测密文或受保护字段被直接修改，但任何持有模板公钥的人仍能为伪造内容重新生成合法密文。因此它不等同于数字签名。若威胁模型包含恶意项目贡献者，应改为由受信服务持有私钥签名，或引入服务端签发的身份凭证。

`canonicalJson` 规范基于 `dev-pipeline-state.mjs:119-130` 的 `canonicalizeFingerprintFields` 实现，关键规则：

1. **字段顺序**：`schemaVersion`, `changeName`, `createdAt`, `createdBy`, `createdByEmail`, `machineInfo`, `featureId`, `fingerprintNonce`
2. **空值处理**：`createdByEmail` 和 `featureId` 空值时序列化为 `""`；`machineInfo` 各字段不可为空
3. **时间格式**：`createdAt` 为 `YYYY-MM-DD HH:mm:ss`（本地时间）
4. **序列化**：`JSON.stringify` 无缩进，无 Unicode 转义（`JSON.stringify` 默认行为）
5. `fingerprintNonce` 的作用是区分内容相同的 change（非密码学必需，RSA-OAEP 已有随机填充）

采集端 `fingerprint-verifier.ts` 必须严格复现上述规则，验收时使用 `test-space/` 下的真实 state 文件作为测试向量。

兼容与迁移规则：

- 现有 32 位 MD5 `fingerprintId` 统一标记为 `legacy-unverified`，绝不能转换为 `fingerprintVerified=true`。
- 模板升级时提供一次性迁移命令，使用当前 `featureInfo.featureId` 和固定公钥为状态文件重新签发 `fp1` 指纹；迁移仅需公钥，不接触私钥。
- 无法重写的历史 commit 可作为不可信历史快照单独导入，但默认指标查询必须仅保留 `fingerprintVerified=true`。
- `fp1` 解密失败、摘要不匹配或 key version 未知均视为篡改/配置错误，直接拒绝当前快照，不能回退到 legacy 逻辑。

最低验收用例：

| 场景 | 预期 |
|------|------|
| 正常生成并使用匹配私钥校验 | 通过，`fingerprintVerified=true` |
| 直接修改 `createdByEmail`、`changeName`、`machineInfo` 或 `featureId` | 摘要不匹配，拒绝入库 |
| 通过受控 `set` 修改 `featureId` | 原子生成新的 `fingerprintId`，新快照校验通过 |
| 仅修改 `featureUrl` 等未受保护字段 | 无需重算，原指纹仍通过 |
| 修改密文字节或 Base64URL 格式 | 解密/格式校验失败，拒绝入库 |
| 使用错误私钥、缺少 `fp1` 或未知版本前缀 | 启动失败或拒绝入库，不降级 |
| 读取旧 32 位 MD5 指纹 | 标记 `legacy-unverified`，不进入可信指标 |

### 4.3 开发者识别

```
1. fingerprintId 校验通过后，读取受保护的 createdByEmail 和 createdBy
2. 对 email 做 trim + lowercase 规范化，并按 email 查找 developer（UNIQUE）
3. 不存在 → INSERT: email, display_name=createdBy, first_seen_at=now
4. 存在 → UPDATE: last_seen_at, display_name
5. 解析到的 developer_id 写入 pipeline_runs
```

RSA-OAEP 密文具有随机性，`fingerprintId` 不能作为稳定的开发者唯一键。邮箱为空时不自动合并开发者记录，先把 `developerId` 留空并进入待认领队列，避免仅凭显示名称误合并。

### 4.4 去重策略与版本管理

唯一约束 `uk_content_version (repo_id, change_name, content_hash)`：
- **同一 change 多次提交且内容变化**：不同 content_hash → INSERT 新行（版本追踪）
- **同一 change 多次提交但内容未变**：相同 content_hash → 跳过
- **文件被删除**（archive 后）：不删除已有数据，保留历史

### 4.5 `is_latest` 标记——指标基准行

由于一个 change 在流水线执行中会产生多个版本快照（每个 Phase 都可能修改 state），直接统计会重复计数。增加 `is_latest` 列解决：

```
PipelineRun 结构新增:
  isLatest  Boolean  @default(true)     // 该 change 的最新版本

@@unique([repoId, changeName, contentHash])
```

**Upsert 事务**：
```typescript
// 1. 将同一 change 的旧版本 is_latest 置为 false
await prisma.pipelineRun.updateMany({
  where: { repoId, changeName, isLatest: true },
  data: { isLatest: false },
});
// 2. 插入新版本，标记为最新
await prisma.pipelineRun.create({ data: { ...values, isLatest: true } });
```

**指标查询统一加 `is_latest` 与指纹验真过滤**：
```sql
-- ✅ 正确：只统计每个 change 的最终状态
SELECT AVG(change_duration_seconds)
FROM pipeline_runs
WHERE developer_id = ?
  AND is_latest = 1
  AND fingerprint_verified = 1
  AND status = 'completed';

-- ✅ 趋势分析：用历史快照观察演进
SELECT state_version, review_current_round, change_duration_seconds
FROM pipeline_runs
WHERE repo_id = ? AND change_name = ? AND fingerprint_verified = 1
ORDER BY state_version;
```

### 4.9 边界情况处理

| 场景 | 处理方式 |
|------|---------|
| 首次克隆 | 完整 clone；后续 fetch 使用浅克隆加速 |
| 仓库不可访问 | `collection_status = 'error'`，记录错误信息，不崩溃 |
| JSON 解析失败 | warn 日志 + skip + 继续下一个 |
| Schema 版本非 3 | skip + 记录 schema_version 值 |
| 大批量 commits | 每 100 个 commit 一批事务 |
| 采集中断 | 基于 last_fetched_commit 增量恢复 |
| 并发采集 | `collection_status` + `collectionStartedAt` 做超时可抢占锁；运行前检查 status 和超时（默认 2h）；事务内用 `stateVersion` 比较防旧版本覆盖 |

### 4.7 采集锁超时恢复

采集器崩溃可能导致 `collection_status` 卡在 `running`。通过 `collectionStartedAt` 时间戳检测僵尸锁：

```typescript
const LOCK_TIMEOUT_MS = parseInt(process.env.COLLECTOR_LOCK_TIMEOUT || '7200000'); // 默认 2h

async function tryAcquireLock(repoId: number): Promise<boolean> {
  const result = await prisma.repo.updateMany({
    where: {
      id: repoId,
      OR: [
        { collectionStatus: 'idle' },                                         // 空闲可直接抢占
        { collectionStatus: 'running', collectionStartedAt: { lt: new Date(Date.now() - LOCK_TIMEOUT_MS) } }, // 超时僵尸锁
      ],
    },
    data: { collectionStatus: 'running', collectionStartedAt: new Date(), collectionError: null },
  });
  return result.count > 0;
}
```

### 4.8 `isLatest` upsert 版本竞态保护

两个采集器并发处理同一 change 时，后到的旧版本可能覆盖新版本的 `isLatest`。通过 `stateVersion` 比较防止：

```typescript
// 事务内
const currentLatest = await prisma.pipelineRun.findFirst({
  where: { repoId, changeName, isLatest: true },
  select: { stateVersion: true },
});
if (currentLatest && values.stateVersion <= currentLatest.stateVersion) {
  return { action: 'skipped', reason: 'stale_version' };  // 旧版本，跳过
}
await prisma.pipelineRun.updateMany({
  where: { repoId, changeName, isLatest: true },
  data: { isLatest: false },
});
await prisma.pipelineRun.create({ data: { ...values, isLatest: true } });
```

### 4.6 CLI 用法

```bash
# 采集全部仓库
npx tsx src/collector.ts --all

# 采集指定仓库
npx tsx src/collector.ts --repo 3

# 守护进程模式（含定时调度）
npx tsx src/collector.ts --daemon --schedule "0 */4 * * *"

# 预览模式（不写入数据库）
npx tsx src/collector.ts --all --dry-run
```

---

## 5. API 端点

### 5.0 API 响应格式约定

所有 API 响应统一使用以下 JSON 结构：

**不分页响应**：
```json
{
    "success": true,
    "code": 200,
    "message": "请求成功",
    "data": { ... }
}
```

**分页响应**（适用列表类端点）：
```json
{
    "success": true,
    "code": 200,
    "message": "请求成功",
    "data": {
        "pageNum": 1,
        "pageSize": 20,
        "totalCount": 156,
        "totalPage": 8,
        "records": [ ... ]
    }
}
```

分页参数通过 query string 传入：`?pageNum=1&pageSize=20`（默认 `pageSize=20`，最大 `1000`）。错误响应 `success=false`，`code` 为 HTTP 状态码，`message` 描述错误原因，`data` 为 null。

---

### 5.1 认证与权限（OIDC 域账号集成）

**整体流程**：metrics-website 集成域账号 OIDC → 登录成功后拿到用户身份 → 调用 metrics-server 的 `/api/auth/session` 换取 API JWT → 后续请求携带该 JWT。

```
用户浏览器                  metrics-website              SSO (域账号)             metrics-server
    │                           │                          │                        │
    │  访问 /dashboard          │                          │                        │
    │──────────────────────────▶│                          │                        │
    │                           │  重定向到 SSO 登录页      │                        │
    │◀──────────────────────────│─────────────────────────▶│                        │
    │  输入域账号密码            │                          │                        │
    │──────────────────────────▶│                          │                        │
    │                           │  OIDC callback (code)     │                        │
    │                           │─────────────────────────▶│                        │
    │                           │  id_token / access_token  │                        │
    │                           │◀─────────────────────────│                        │
    │                           │  解析 → { email, name, sub }                      │
    │                           │                                                    │
    │                           │  POST /api/v1/auth/session                            │
    │                           │  { email, name, sub }                              │
    │                           │───────────────────────────────────────────────────▶│
    │                           │                          │  查/建 developer 行      │
    │                           │  { token, developer }    │  签发 API JWT           │
    │                           │◀───────────────────────────────────────────────────│
    │  登录成功，带 API JWT 请求 │                          │                        │
    │──────────────────────────▶│───────────────────────────────────────────────────▶│
```

**两层 Token**：

| Token | 发行方 | 受众 | 有效期 | 用途 |
|-------|--------|------|--------|------|
| SSO Token（OIDC id_token） | 域账号系统 | metrics-website | 由 SSO 控制 | 验证用户身份真实性 |
| API Token（自签 JWT） | metrics-server | metrics-server API | 24h | 后续所有 API 调用的认证 |

**Auth 中间件**：验证 API JWT 签名 + 过期 → 提取 `{ developerId, email, teamId, isAdmin }` → 注入 `req.user`。

**团队可见性中间件**：`/api/v1/metrics/me` 过滤 `developer_id = req.user.developerId`；`/api/v1/metrics/team/:id` 验证 id 在用户团队子树中（或 isAdmin）；isAdmin 不过滤。

**`POST /api/v1/sync/org` — 组织数据同步**：

从外部系统（飞书/LDAP/企业微信等）同步团队层级和开发者信息。以 `externalId` 为 merge key 全量覆盖团队结构；开发者通过 OIDC `sub`（对应 Developer 表的 `externalId`）匹配，自动关联 `email` 一致的采集记录。异步执行，结果写入 `SyncLog` 表。

```typescript
// services/sync-service.ts
async function syncOrg(source: string, data: OrgData) {
  const syncLog = await prisma.syncLog.create({
    data: { source, status: 'running', startedAt: new Date() },
  });
  try {
    let teamsCreated = 0, teamsUpdated = 0, devsLinked = 0;
    // 1. 以 externalId 为 key upsert 团队层级（全量覆盖）
    for (const team of data.teams) {
      const result = await prisma.team.upsert({
        where: { externalId: team.externalId },
        create: { name: team.name, slug: team.slug, parentId: team.parentId, externalId: team.externalId },
        update: { name: team.name, parentId: team.parentId },
      });
      result.createdAt === result.updatedAt ? teamsCreated++ : teamsUpdated++;
    }
    // 2. 以 externalId (OIDC sub) 匹配开发者，自动关联 email
    for (const dev of data.developers) {
      const existing = await prisma.developer.findFirst({
        where: { OR: [{ externalId: dev.sub }, { email: dev.email }] },
      });
      if (existing) {
        await prisma.developer.update({
          where: { id: existing.id },
          data: { teamId: dev.teamId, externalId: dev.sub, lastSeenAt: new Date() },
        });
        devsLinked++;
      } else {
        await prisma.developer.create({
          data: { email: dev.email, displayName: dev.name, externalId: dev.sub, teamId: dev.teamId, firstSeenAt: new Date(), lastSeenAt: new Date() },
        });
      }
    }
    await prisma.syncLog.update({ where: { id: syncLog.id }, data: { status: 'completed', finishedAt: new Date(), teamsCreated, teamsUpdated, devsLinked } });
  } catch (e) {
    await prisma.syncLog.update({ where: { id: syncLog.id }, data: { status: 'error', errorMessage: e.message, finishedAt: new Date() } });
  }
}

// GET /api/v1/sync/status 返回结果
// { success: true, data: { lastSync: { source, status, teamsCreated, teamsUpdated, devsLinked, startedAt, finishedAt } } }
```

**`POST /api/v1/auth/session` — Developer 自动注册**：

```typescript
async function createSession(email: string, name: string, sub: string) {
  let dev = await prisma.developer.findUnique({ where: { email } });
  if (!dev) {
    dev = await prisma.developer.create({
      data: { email, displayName: name, externalId: sub,
              firstSeenAt: new Date(), lastSeenAt: new Date() },
    });
  } else {
    await prisma.developer.update({
      where: { id: dev.id },
      data: { lastSeenAt: new Date(), externalId: sub },
    });
  }
  const token = jwt.sign(
    { developerId: dev.id, email: dev.email, teamId: dev.teamId,
      isAdmin: dev.role === 'admin' },
    env.JWT_SECRET, { expiresIn: '24h' },
  );
  return { token, developer: dev };
}
```

**Developer 表补充字段**：`role String? @db.VarChar(16)`（admin | member）。SSO 用户的 `externalId` 对应 OIDC 的 sub claim。

**metrics-website 侧**：使用 NextAuth.js 或自实现 OIDC client，配置域账号系统的 `.well-known/openid-configuration` 地址，登录成功后调用 `/api/auth/session` 换取 API JWT，存入 session cookie。

#### 团队可见性缓存

递归 CTE 每次请求都查 DB 会拖慢指标接口。两级缓存：

**请求级**：每个 HTTP 请求只查一次递归树，结果挂到 `req.teamScope`：

```typescript
// middleware/team-scope.ts
async function teamScope(req, res, next) {
  if (req.user.isAdmin) {
    req.teamScope = { mode: 'all' };
    return next();
  }
  const subtreeIds = await getTeamSubtreeIds(req.user.teamId);
  const memberIds = await getTeamDeveloperIds(subtreeIds);
  req.teamScope = { mode: 'filtered', memberIds };
  next();
}
```

**应用级**：`getTeamSubtreeIds` 内部加 60 秒 TTL 内存缓存，`/api/v1/teams` 写操作时清除：

```typescript
// services/team-cache.ts
const subtreeCache = new Map<number, { ids: number[]; expiresAt: number }>();

async function getTeamSubtreeIds(teamId: number): Promise<number[]> {
  const cached = subtreeCache.get(teamId);
  if (cached && cached.expiresAt > Date.now()) return cached.ids;
  const rows = await prisma.$queryRaw<{ id: number }[]>`
    WITH RECURSIVE team_tree AS (...) SELECT id FROM team_tree`;
  const ids = rows.map(r => r.id);
  subtreeCache.set(teamId, { ids, expiresAt: Date.now() + 60_000 });
  return ids;
}
```

**个人视图例外**：`/api/v1/metrics/me` 不触发递归查询——`WHERE developer_id = req.user.developerId`，这是最高频路径。

### 5.2 端点一览

```
METHOD  PATH                                AUTH    说明
──────  ────                                ────    ────
GET     /api/v1/health                      none    健康检查

# 指标查询
GET     /api/v1/metrics/me                  user    个人指标总览
GET     /api/v1/metrics/me/cycle-time       user    个人周期时间
GET     /api/v1/metrics/me/phases           user    个人各阶段耗时分布
GET     /api/v1/metrics/me/reviews          user    个人审查统计
GET     /api/v1/metrics/me/completions      user    个人完成率
GET     /api/v1/metrics/me/pauses           user    个人暂停频率
GET     /api/v1/metrics/me/bypasses         user    个人门禁跳过率
GET     /api/v1/metrics/team/:teamId        team    团队指标汇总
GET     /api/v1/metrics/team/:teamId/members team   团队成员明细列表（分页）
GET     /api/v1/metrics/team/:teamId/trend  team    团队趋势
GET     /api/v1/metrics/team/:teamId/phases team    团队阶段分布

# 管理
GET     /api/v1/repos                       admin   仓库列表（分页）
GET     /api/v1/repos/:id                   admin   仓库详情
POST    /api/v1/repos                       admin   添加仓库
PUT     /api/v1/repos/:id                   admin   更新仓库
DELETE  /api/v1/repos/:id                   admin   删除仓库
POST    /api/v1/repos/:id/reset-collection  admin   重置采集进度

GET     /api/v1/teams                       admin   团队列表（树形）
POST    /api/v1/teams                       admin   创建团队
PUT     /api/v1/teams/:id                   admin   更新团队
DELETE  /api/v1/teams/:id                   admin   删除团队

GET     /api/v1/developers                  admin   开发者列表（分页）
PUT     /api/v1/developers/:id              admin   更新开发者（分配团队）

GET     /api/v1/collection/status           admin   采集状态
GET     /api/v1/collection/logs             admin   采集日志（分页）
POST    /api/v1/collection/trigger          admin   手动触发采集
POST    /api/v1/collection/trigger-all      admin   触发全部仓库

POST    /api/v1/sync/org                    admin   同步组织数据
GET     /api/v1/sync/status                 admin   上次同步状态
```

### 5.3 关键响应示例

**GET /api/v1/metrics/me**
```json
{
  "success": true,
  "code": 200,
  "message": "请求成功",
  "data": {
    "totalRuns": 120,
    "completedRuns": 98,
    "completionRate": 0.817,
    "abandonmentRate": 0.092,
    "avgCycleTimeMinutes": 45.3,
    "medianCycleTimeMinutes": 32.1,
    "avgReviewRounds": 1.3,
    "reviewPassRate": 0.72,
    "avgTestAttempts": 1.1,
    "avgVerifyAttempts": 1.0,
    "avgRollbacksPerChange": 0.3,
    "pauseCount": 5,
    "bypassFrequency": { "review-skipped": 3, "tests-skipped": 8 },
    "phaseBreakdown": [
      { "phase": 0, "avgSec": 120, "p50Sec": 90, "p95Sec": 300 },
      { "phase": 1, "avgSec": 1800, "p50Sec": 1200, "p95Sec": 7200 }
    ],
    "recentTrend": [
      { "date": "2026-07-21", "runs": 5, "avgCycleMin": 40.2 }
    ]
  }
}
```

**GET /api/v1/metrics/team/:teamId/members**（分页）
```json
{
  "success": true,
  "code": 200,
  "message": "请求成功",
  "data": {
    "pageNum": 1,
    "pageSize": 20,
    "totalCount": 12,
    "totalPage": 1,
    "records": [
      {
        "id": 1,
        "displayName": "张三",
        "email": "zhang@example.com",
        "totalRuns": 45,
        "completedRuns": 40,
        "completionRate": 0.889,
        "avgCycleTimeMinutes": 38.2,
        "avgReviewRounds": 1.2
      }
    ]
  }
}
```

---

## 6. 核心指标定义

### 6.1 指标表

| 指标 | 计算方式 | 含义 |
|------|---------|------|
| **月度完成数** | `COUNT(status='completed' AND completedAt IN month)` | 月度吞吐量（绝对值） |
| **超期未完成率** | `COUNT(created > 30天前 AND status != 'completed') / COUNT(created > 30天前)` | 积压风险（越低越好） |
| **平均周期时间** | `AVG(change_duration_seconds) / 60` 分钟 | 交付速度（含暂停） |
| **有效周期时间** | `AVG(SUM(phaseHistory.completed - phaseHistory.started)) / 60` 分钟 | 除暂停外的实际工作时间 |
| **中位周期时间** | `PERCENTILE_CONT(0.5)` (Pg) / 应用层计算 (MySQL) | 去极端值的交付速度 |
| **平均审查轮次** | `AVG(review_current_round)` | 代码质量/返工程度 |
| **审查一次通过率** | `COUNT(review_current_round=1 AND review_status='passed') / COUNT(status='completed')` | 首次代码质量 |
| **测试一次通过率** | `COUNT(tests_attempts<=1 AND tests_status='passed') / COUNT(tests_attempts>0)` | 测试质量 |
| **各阶段耗时分布** | `AVG` + `P50` + `P95`（`durationSeconds`）GROUP BY phase，Pg 用 `PERCENTILE_CONT`，MySQL 应用层计算 | 瓶颈分析（去极端值） |
| **门禁跳过率** | `COUNT(gatesBypassed NOT EMPTY) / COUNT(*)` | 流程合规度 |
| **暂停率** | `COUNT(DISTINCT phe.run_id WHERE phe.status='abandoned') / COUNT(DISTINCT pr.id)`（通过 phaseHistory 统计 abandon 事件） | 流程中断频率 |
| **Phase 回退次数** | 相邻 phase entry 中 phase 向小跳转 | 决策变更频率 |
| **完成率** | `COUNT(status='completed', is_latest=1, fingerprint_verified=1) / COUNT(is_latest=1, fingerprint_verified=1)` | 整体完成比例 |
| **废弃率** | `COUNT(archivePath IS NOT NULL AND status != 'completed', is_latest=1, fingerprint_verified=1) / COUNT(is_latest=1, fingerprint_verified=1)` | 中途放弃的比例 |

### 6.2 关键指标计算说明

**完成率 → 拆分为两个指标**

原始的 `completed / total` 会混入进行中的 change，不适合直接作为完成率。改为：

- **月度完成数**：按月统计 `status='completed'` 的 change 数量——这是绝对吞吐量
- **超期未完成率**：只统计创建超过 30 天的 change，计算其中未完成的占比

```sql
-- 超期未完成率
SELECT
  COUNT(CASE WHEN status != 'completed' THEN 1 END) * 1.0 / COUNT(*) AS overdue_rate
FROM pipeline_runs
WHERE is_latest = 1
  AND createdAtPipeline < DATE_SUB(NOW(), INTERVAL 30 DAY);
```

**周期时间 → 保留简单版 + 有效版**

简单版直接用已存的 `change_duration_seconds`，适合快速概览。有效版从 `phaseHistory` 汇总各阶段实际耗时，排除暂停：

```typescript
// 有效周期时间（排除暂停间隙）
async function effectiveCycleMs(pr: PrismaClient, runId: bigint): Promise<number> {
  const phases = await pr.phaseHistoryEntry.findMany({
    where: { runId, status: 'completed', completedAt: { not: null } },
    select: { startedAt: true, completedAt: true },
    orderBy: { startedAt: 'asc' },
  });
  // 各阶段 completedAt - startedAt 的和（自动排除阶段之间的暂停间隙）
  return phases.reduce((sum, p) =>
    sum + (p.completedAt!.getTime() - p.startedAt.getTime()), 0);
}
```

> **时区注意事项**：`startedAt`/`completedAt` 来自 state 文件的 `formatLocalTime`（本地时间，格式 `YYYY-MM-DD HH:mm:ss`）。由于产生和执行均在同一台开发者机器上，差值计算不受时区影响。采集端 `state-parser.ts` 解析时统一按 UTC 存入数据库（仅差值有意义，绝对值无意义），避免跨 DST 边界问题。
```

> 注意：有效周期时间排除了阶段之间的暂停间隙，但不排除 Phase 回退的时间——回退是实际发生的重做，应该算入成本。

**Phase 回退次数查询**（MySQL 8+ / PostgreSQL 均支持 `LAG` 窗口函数）：

```sql
WITH phase_sequence AS (
  SELECT
    phe.run_id,
    phe.phase,
    LAG(phe.phase) OVER (PARTITION BY phe.run_id ORDER BY phe.started_at) AS prev_phase
  FROM phase_history_entries phe
  JOIN pipeline_runs pr ON pr.id = phe.run_id
  WHERE pr.is_latest = 1
    AND pr.fingerprint_verified = 1
    AND pr.developer_id = ?
)
SELECT COUNT(*) AS rollback_count
FROM phase_sequence
WHERE phase < prev_phase;
```

### 聚合查询示例（Prisma Client）

**团队递归查询**（MySQL/PostgreSQL 均支持 `WITH RECURSIVE`，通过 `$queryRaw`）：

```typescript
// services/metrics-service.ts
async function getTeamDeveloperIds(teamId: number): Promise<number[]> {
  const result = await prisma.$queryRaw<{ id: number }[]>`
    WITH RECURSIVE team_tree AS (
      SELECT id FROM teams WHERE id = ${teamId}
      UNION ALL
      SELECT t.id FROM teams t
      JOIN team_tree tt ON t.parent_id = tt.id
    )
    SELECT d.id FROM developers d
    JOIN team_tree tt ON d.team_id = tt.id
  `;
  return result.map((r) => r.id);
}
```

**阶段耗时分布**（Prisma Client 聚合 API）：

```typescript
async function getPhaseBreakdown(devIds: number[]) {
  return await prisma.phaseHistoryEntry.groupBy({
    by: ['phase'],
    where: {
      status: 'completed',
      completedAt: { not: null },
      run: {
        developerId: { in: devIds },
        isLatest: true,
        fingerprintVerified: true,
      },
    },
    _count: { id: true },
    _avg: { durationSeconds: true },
    orderBy: { phase: 'asc' },
  });
}
```

**中位数**（跨数据库差异封装）：

```typescript
// services/dialect-adapter.ts
// 通过运行时检查 prisma 连接的 provider 来选择 SQL 方言
async function medianCycleTime(devId: number): Promise<number> {
  const provider = (prisma as any)._activeProvider; // 或从 env 读取

  if (provider === 'postgresql') {
    const result = await prisma.$queryRaw<[{ median: number }]>`
      SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY change_duration_seconds) AS median
      FROM pipeline_runs
      WHERE developer_id = ${devId}
        AND is_latest = 1
        AND fingerprint_verified = 1
        AND status = 'completed'
    `;
    return result[0].median;
  }

  // MySQL: 应用层计算
  const durations = await prisma.pipelineRun.findMany({
    select: { changeDurationSeconds: true },
    where: {
      developerId: devId,
      isLatest: true,
      fingerprintVerified: true,
      status: 'completed',
    },
    orderBy: { changeDurationSeconds: 'asc' },
  });
  const d = durations.map((r) => r.changeDurationSeconds!).filter(Boolean);
  return d[Math.floor(d.length / 2)];
}
```

---

## 7. npm 关键依赖

### metrics-server

| 包 | 用途 |
|---|------|
| `express@5` | HTTP 服务 |
| `@prisma/client@^6` | Prisma ORM 类型安全客户端 |
| `prisma@^6` | Prisma CLI + Migrate（devDependency） |
| `zod@4` | Schema 校验（与现有项目一致） |
| `simple-git@3` | Git 操作封装 |
| `node-cron@4` | Cron 定时调度 |
| `pino@9` | 结构化日志 |
| `dotenv@16` | 环境变量 |
| `jsonwebtoken@9` | JWT 认证 |
| `cors@2`, `helmet@8`, `express-rate-limit@7` | 安全中间件 |
| `typescript`, `tsx`, `@types/node`, `@types/express`, `vitest`, `@biomejs/biome` | 开发工具 |

> **注意**：指纹加解密直接使用 Node.js 内置 `node:crypto`，无需新增密码学依赖。不再需要分别安装 `mysql2` 或 `pg` 驱动——Prisma 内置所有驱动，通过 `prisma generate` 时根据 `provider` 自动选择并打包。

### metrics-website

| 包 | 用途 |
|---|------|
| `next@16`, `react@19`, `react-dom@19` | 前端框架 |
| `recharts@2` | 图表库 |
| `lucide-react` | 图标 |
| `date-fns@4` | 日期处理 |

---

## 8. 实施状态与验收门禁

Phase 状态不再由文件存在或人工判断直接标记。每个 Phase 只有满足全部适用门禁后才能
标记为“已验证”；不适用项必须在证据表说明原因。逐项命令、结果和关键文件见
[M001-M020 验收证据](metrics-system-acceptance-evidence.md)。

| 门禁 | 完成条件 |
|------|---------|
| 代码 | 约定功能已实现，lint、typecheck 和 API contract check 通过 |
| 测试 | 相关 unit、Git、HTTP 和回归测试通过，失败/权限/边界场景有自动化覆盖 |
| 文档 | README、部署、数据库、安全和运维说明与当前实现一致 |
| DB | 适用任务完成 provider schema/migration 校验及真实数据库 integration/API 验证 |
| UI | 适用任务完成 production build 及桌面/移动 Playwright 工作流；无 UI 的底层任务明确为不适用 |

| 阶段 | 当前状态 | 交付范围 |
|------|----------|----------|
| **Phase 0: 指纹模板** | 已验证 | fp1 RSA-OAEP、可信链、临时密钥矩阵、轮换与事故文档 |
| **Phase 1: 数据库基础** | 已验证 | 14 表 Prisma 模型、PostgreSQL/MySQL 独立 migration、provider 防交叉与 CI 矩阵 |
| **Phase 2: 数据模型** | 已验证 | pipeline state v3、可信/历史/job/retention 字段、可注入数据端口；未使用 Repository 骨架已删除 |
| **Phase 3: 采集器引擎** | 已验证 | Git checkpoint、100 commit 批次、冲突重试、持久 job、拒绝审计与恢复 |
| **Phase 4: API Server** | 已验证 | 54 个契约端点、身份/团队权限、统一响应、request ID、健康检查和监控 |
| **Phase 5: 指标服务** | 已验证 | 可信过滤、统一时间/仓库范围、批量团队聚合、provider-aware 百分位与缓存 |
| **Phase 6: 定时调度** | 已验证 | 采集/retention scheduler、锁与超时恢复、运行状态和监控指标 |
| **Phase 7: Dashboard** | 已验证 | 个人、团队、仓库、组织、采集、同步、认证与错误状态桌面/移动工作流 |
| **Phase 8: 组织同步** | 已验证 | canonical DTO、原子全量 reconcile、dry-run、三类 adapter 与管理 UI |

### 数据保留策略（预设计，Phase 1 不实现）

| 层级 | 数据范围 | 保留期 | 说明 |
|------|---------|--------|------|
| 热数据 | `isLatest=true` 的记录 | 永久 | 指标查询主数据，数据量可控 |
| 温数据 | 全部 `pipeline_runs` + 子表 | 12 个月 | 趋势分析，超过 12 个月归档 |
| 冷数据 | 12 个月前的历史快照 | 对象存储 | 压缩归档，审计需要时恢复 |

- Repo 表预留 `retentionDays Int @default(365)` 配置项
- Cron 调度中预留 `retention-cleanup` 占位任务
- 触发条件：`pipeline_runs` 总行数超过 100 万时启用清理

---

## 9. 环境变量

```env
# Server
PORT=3001
NODE_ENV=development

# Database（通过 DATABASE_URL + DB_PROVIDER 切换）
DB_PROVIDER=mysql                    # mysql | postgresql
DATABASE_URL=mysql://root:password@localhost:3306/opsx_metrics

# 切换到 PostgreSQL 只需改两行：
# DB_PROVIDER=postgresql
# DATABASE_URL=postgresql://postgres:password@localhost:5432/opsx_metrics

# Auth
JWT_SECRET=your-secret-key
API_KEY=optional-static-key

# Fingerprint verification
# JSON key ring；每个值为 PKCS#8 PEM 私钥的 Base64 编码，实际值由密钥系统注入
FINGERPRINT_PRIVATE_KEYS='{"fp1":"<base64-pkcs8-private-key>"}'

# Collection
COLLECTOR_TEMP_DIR=/tmp/opsx-metrics-collector
COLLECTOR_CRON_SCHEDULE="0 */4 * * *"
COLLECTOR_CONCURRENCY=2

# CORS
CORS_ORIGIN=http://localhost:3000
```

### Prisma Client 初始化逻辑

```typescript
// config/database.ts
import { PrismaClient } from '@prisma/client';

// PrismaClient 从环境变量 DB_PROVIDER + DATABASE_URL 读取配置
// 无需手动选择驱动——由 Prisma 内置引擎处理
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'warn', 'error']
    : ['warn', 'error'],
});

export { prisma };
```

数据库连接仍只需要 **2 个**环境变量（`DB_PROVIDER` + `DATABASE_URL`）。`FINGERPRINT_PRIVATE_KEYS` 是独立的安全配置，必须由部署密钥系统注入，不计入数据库连接配置。

---

## 10. 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 数据库抽象层 | **Prisma ORM** | `datasource provider` 原生支持 `env("DB_PROVIDER")` 动态切换 MySQL/PostgreSQL；单一 schema 文件覆盖两种数据库；`prisma migrate` 自动生成对应 DDL；Prisma Client 类型安全；无需手写条件分支 |
| 枚举字段 | **VARCHAR + 应用层 Zod 校验** | Prisma 统一用 `String + @db.VarChar`，避免 MySQL `ENUM` 和 Pg 无原生 ENUM 的差异 |
| `@updatedAt` | **Prisma 原生 `@updatedAt`** | MySQL 生成 `ON UPDATE CURRENT_TIMESTAMP`，Pg 由 Prisma Migrate 自动创建触发器——对应用层零侵入 |
| 环境变量 | **2 个**：`DB_PROVIDER` + `DATABASE_URL` | Prisma 标准连接方式；切换数据库只需改两个值，无需更改代码 |
| API + 采集器合并在一个 package | `metrics-server/` 一个子项目 | 共享 DB schema、Zod 模型、repository 层 |
| content_hash 去重 | MD5 全量 JSON | `_version` 只在单次会话内单调，跨 commit 不可靠 |
| machineInfo 扁平化 | 直接放 `pipeline_runs` 表 | 一对一关系，5 个字段不值得拆表 |
| `fingerprintId` | 固定 RSA-2048 模板公钥 + RSA-OAEP-SHA256 + `fp1` 版本前缀 | 私钥只在采集服务；检测密文和受保护字段的直接篡改，并支持密钥轮换 |
| 指纹校验策略 | 校验失败拒绝入库，禁止降级 | 防止未验真的状态污染统计结果；失败原因进入采集日志 |
| 开发者识别 | 指纹验真后的规范化邮箱 | RSA-OAEP 密文随机，不能作为稳定开发者键；邮箱为空时进入待认领流程 |
| 团队层级 | 递归 CTE | MySQL 8+ 和 PostgreSQL 均支持 `WITH RECURSIVE` |
| 增量采集 | `last_fetched_commit` 追踪 | 支持断点续传 |
| 子项目模式 | 独立 `package.json`，无 workspaces | 与现有 `website/`、`test-pipeline/` 模式一致 |

---

## 11. 参考文件

- `docs/metrics/pipeline-state-fields.md` — 完整字段字典（Zod schema 定义依据）
- `website/package.json` — Next.js/React 版本参考
- `website/tsconfig.json` — Next.js TS 配置模板
- `package.json` — Biome 配置、vitest 配置、子项目模式
- `biome.json` — 共享格式化/lint 配置
