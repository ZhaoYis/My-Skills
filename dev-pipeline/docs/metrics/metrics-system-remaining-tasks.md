# AI 开发能效指标系统 - 待完成任务清单

> 本清单基于 `metrics-server/`、`metrics-website/` 当前代码与 `metrics-system-design.md` 的逐项对照生成。
> 清单只记录尚未完整交付的工作；任务完成并通过验收后，将任务前的 `[ ]` 改为 `[x]`。

## 1. 状态说明

| 标记 | 含义 |
|------|------|
| `[ ]` | 尚未完成或仅有部分骨架 |
| `[x]` | 功能、测试和文档均已完成 |

优先级定义：

- **P0**：影响数据可信度、安全边界或系统基本可用性，必须优先修复。
- **P1**：设计文档承诺的主要业务流程尚不完整。
- **P2**：性能、可维护性、可观测性及长期运营能力。

---

## 2. P0 - 数据正确性与安全边界

### [ ] M001 - 实现真正可部署的 PostgreSQL / MySQL 双数据库迁移

**现状差距**

当前 `schema.template.prisma` 可以替换 provider，但仓库中只有 PostgreSQL migration；其中包含 `SERIAL`、`BIGSERIAL`、双引号标识符等 PostgreSQL DDL。切换 `DB_PROVIDER=mysql` 后可以校验 schema，但不能安全执行现有 migration。

**详细功能**

- 为 PostgreSQL 和 MySQL 分别维护可部署的 migration 产物。
- `prisma:prepare`、`prisma:generate`、`prisma:migrate` 必须选择同一种 provider 和 migration 目录。
- 启动时校验 `DB_PROVIDER` 与 `DATABASE_URL` 协议一致，不一致时立即失败。
- 给出 PostgreSQL 与 MySQL 的初始化、升级、回滚和切换说明。
- 禁止对 MySQL 执行 PostgreSQL migration，反之亦然。

**验收标准**

- 空 PostgreSQL 和空 MySQL 均可从零部署 14 张表。
- 两种数据库均能运行一次真实的 snapshot upsert、指标查询和组织同步测试。
- CI 中分别执行 schema validate、migration deploy 和集成测试。

**关联模块**：`metrics-server/prisma/`、`metrics-server/scripts/prepare-prisma-schema.mjs`、`metrics-server/package.json`

### [ ] M002 - 修复 legacy 指纹覆盖可信最新快照的问题

**现状差距**

32 位 legacy MD5 指纹会以 `fingerprintVerified=false` 入库，但仍会把同一 change 的旧记录全部设为 `isLatest=false`。一个 legacy 快照因此可以让原本可信的 change 从默认指标中消失。

**详细功能**

- 将“最新历史快照”和“最新可信快照”分开表达，或保证未验真快照不能替换可信 `isLatest`。
- 默认采集模式拒绝新增 legacy 快照进入主指标版本链。
- 增加显式的历史导入模式，只允许导入 legacy 记录并标记来源，不参与可信最新状态切换。
- `fp1` 格式错误、未知 key、解密失败和摘要不一致统一计入 `fingerprintsRejected`。
- 采集日志保存结构化拒绝原因和对应 commit/path，不能只写进进程日志。

**验收标准**

- 可信 v3 快照之后出现 legacy、损坏密文或未知版本时，原可信快照仍是指标基准行。
- 历史导入的 legacy 数据可审计，但所有默认指标均不统计。
- 增加 legacy 覆盖、密文损坏、未知 key 和错误私钥集成测试。

**关联模块**：`fingerprint-verifier.ts`、`upsert-engine.ts`、`collection-service.ts`、Prisma schema

### [ ] M003 - 修复个人身份与 API Key 模式的语义冲突

**现状差距**

API Key 被映射为 `developerId=0` 的管理员；前端无 OIDC session 时优先使用 API Key，因此 `/metrics/me` 永远查询不存在的开发者并显示全零。

**详细功能**

- 明确 API Key 只用于服务间调用和管理接口，不得伪装成个人身份。
- `/metrics/me` 在 API Key 请求下返回明确的 403 或“个人身份缺失”错误。
- 本地开发需要个人看板时，提供显式的开发者模拟配置或受控 impersonation 接口，仅允许 development 环境使用。
- 前端本地模式必须显示当前模拟身份，不能把管理员空数据当作个人数据。
- OIDC JWT 仍以真实 `developerId`、`teamId` 和角色作为个人查询条件。

**验收标准**

- API Key 调用管理接口正常，调用 `/metrics/me` 不再静默返回空指标。
- OIDC 用户只能看到自己的个人指标。
- 开发模拟身份无法在 production 启用。

**关联模块**：`api/middleware/auth.ts`、`api/routes/metrics.ts`、`metrics-website/lib/api.ts`、NextAuth 配置

### [ ] M004 - 修正核心指标计算口径

**现状差距**

门禁跳过率按“跳过门禁条目总数 / change 数”计算，同一 change 跳过多个门禁时可能超过 100%；趋势把 active/paused 且无周期时间的记录按 0 分钟计入；月度完成数使用最后更新时间近似完成时间。

**详细功能**

- 门禁跳过率改为“存在至少一个 bypass 的可信最新 change 数 / 可信最新 change 总数”。
- 额外保留各 gate 的跳过次数分布，但不得与跳过率混用。
- 趋势周期时间只统计 `status=completed` 且 `changeDurationSeconds != null` 的记录。
- 增加明确的 `completedAtPipeline`，记录 change 首次进入 completed 的时间。
- 月度完成数按 `completedAtPipeline` 统计，不再使用 `updatedAtPipeline`。
- 统一 overview 与独立 reviews/completions 端点的完成状态过滤规则。
- 7/30/90 天筛选应作用于约定的全部区间指标，而不是仅影响趋势数组。

**验收标准**

- 门禁跳过率始终位于 0 到 1 之间。
- active/paused change 不会拉低平均周期时间。
- 同一 completed change 后续被重新采集不会重复增加当月完成数。
- 每个指标均有正常、空集合、多个 gate、进行中状态和跨月测试。

**关联模块**：`metrics-service.ts`、`metrics` routes、Prisma schema、Dashboard

### [ ] M005 - 前端区分“真实零数据”和“API 请求失败”

**现状差距**

个人、团队和管理页面捕获全部 API 异常后直接渲染全零或空表。认证失败、权限不足、后端宕机和数据库错误都会被误报为“暂无数据”。

**详细功能**

- API client 定义认证、权限、网络、服务端和业务错误类型。
- 页面提供 loading、empty、error、forbidden 四种独立状态。
- 401 引导重新登录；403 显示无权限；5xx/网络错误提供重试命令。
- 只有 API 成功且数据确实为空时才展示零指标或空表。
- 管理操作显示提交中、成功和失败反馈，防止重复提交。

**验收标准**

- 断开 metrics-server 时页面显示服务不可用，而不是 0%。
- 普通成员访问管理页显示 403 状态，不能看到伪造的空管理页。
- Playwright 覆盖 200 空数据、401、403、500 和网络失败。

**关联模块**：`metrics-website/lib/api.ts`、个人页、团队页、管理页、全局错误边界

### [ ] M006 - 组织同步实现真正的全量覆盖和原子性

**现状差距**

当前同步只 upsert 请求中出现的团队和开发者，不删除、停用或解除请求中缺失的组织数据；接口字段使用 `parentExternalId/teamExternalId`，与设计示例中的 `parentId/teamId` 也不一致。同步完成后没有清除团队子树缓存。

**详细功能**

- 定义并固定组织同步 DTO，统一外部 ID 与内部 ID 的语义。
- 整次组织同步在事务中执行，失败时不能留下半套层级。
- 全量模式处理已移除团队、移动团队、离职开发者和未分配成员。
- 明确采用软删除、停用或解绑策略，避免破坏历史 pipeline 归属。
- 校验父团队存在、禁止循环层级、禁止一个 externalId 映射多个对象。
- 同步成功后清除团队可见性缓存。
- 同步日志记录新增、更新、移动、解绑、停用和失败数量。

**验收标准**

- 连续同步两份不同组织快照后，数据库组织结构与第二份完全一致。
- 任一步失败时组织数据整体回滚，SyncLog 正确记录失败。
- 已离职开发者的历史指标保留，但不再出现在当前团队成员列表。

**关联模块**：`sync-service.ts`、`api/routes/sync.ts`、`team-cache.ts`、Prisma schema

### [ ] M007 - 建立可靠的采集 checkpoint 与断点续传

**现状差距**

`lastFetchedCommit` 只更新为最后一个“包含 state 路径变化”的 commit；当仓库没有相关 commit 时 checkpoint 不更新，首次范围会在每次任务中重复扫描。采集也没有按设计实现每 100 commits 批次、事务冲突重试和可审计的部分失败策略。

**详细功能**

- 每轮 fetch 后记录本轮扫描的远端 HEAD，而不是仅记录最后一个相关 commit。
- 区分 `scanFromCommit`、`scanToCommit` 和最后成功处理的相关 commit。
- 没有 state 变化时也推进 checkpoint。
- 每 100 个相关 commit 形成批次，记录批次开始、完成和失败位置。
- 对 Prisma `P2034` 等可重试事务冲突执行有限次数指数退避。
- 明确单文件解析失败、指纹失败和系统失败是否推进 checkpoint，并写入结构化日志。
- 优化 clone/fetch 策略；若使用 partial/shallow clone，必须保证增量范围所需历史可用。

**验收标准**

- 连续两次采集无相关变更的仓库，第二次不会重新扫描历史。
- 中途终止后能从最后成功 checkpoint 恢复，不丢失也不重复入库。
- 100+ commits、事务冲突、无相关 commit 和 force-push 场景均有集成测试。

**关联模块**：`git-helpers.ts`、`git-collector.ts`、`collection-service.ts`、Repo/CollectionLog 模型

---

## 3. P1 - 完整业务工作流

### [ ] M008 - 完成仓库管理页面

**详细功能**

- 仓库分页、搜索、启停和状态筛选。
- 新增/编辑仓库表单：名称、Git URL、分支、起始时间、保留天数。
- Git URL 和分支连通性测试，展示认证或分支不存在错误。
- 单仓库手动采集、重置 checkpoint、查看详情和最近采集日志。
- 删除操作改为安全策略：默认停用或软删除，不级联清空历史指标。

**验收标准**

- 管理员可以在 UI 完成所有 `/repos` API 操作。
- 危险操作有确认步骤，并明确说明历史数据影响。
- 普通成员不能进入或调用仓库管理功能。

**关联模块**：管理页面、repos routes、Repo schema

### [ ] M009 - 完成团队与开发者管理页面

**详细功能**

- 团队树浏览、新增、改名、移动和删除/停用。
- 防止团队移动形成循环，删除有成员/子团队时给出明确处理选项。
- 开发者分页、邮箱搜索、未分配筛选、团队分配和角色修改。
- 显示采集身份与 OIDC externalId 的关联状态，支持待认领开发者处理。
- 所有组织写操作及时刷新团队可见性缓存。

**验收标准**

- 管理员能通过 UI 完成团队 CRUD 和开发者分配。
- 修改团队或角色后，新会话权限立即正确；旧 JWT 的刷新策略有明确实现。

**关联模块**：teams/developers routes、管理页面、NextAuth session

### [ ] M010 - 完成团队面板和成员明细

**详细功能**

- 使用可见团队树选择团队，移除手工输入 `?teamId=1` 的依赖。
- 展示团队总览、趋势、阶段耗时和分页成员明细。
- 成员表包含完成数、完成率、周期时间、审查轮次等设计字段。
- 支持成员排序、筛选和进入成员详情。
- 无团队、空团队和无权访问团队提供独立状态。

**验收标准**

- 用户只能选择自己团队子树中的团队，管理员可以选择全部团队。
- 成员分页、排序与团队汇总结果一致。

**关联模块**：团队页面、team metrics routes、team-scope middleware

### [ ] M011 - 完成采集运行管理与日志详情

**详细功能**

- 展示所有仓库的 idle/running/error 状态、开始时间、超时状态和错误信息。
- 支持单仓库触发、全部触发和 dry-run 预览。
- 采集任务需要可查询的 job/run ID，不能只依赖进程内 fire-and-forget Promise。
- 展示 commits、files、inserted、skipped、fingerprint rejected 及拒绝原因明细。
- 防止重复触发，提供任务超时、取消或重试策略。

**验收标准**

- API 返回 202 后，前端能持续查询同一任务直到 completed/error。
- 服务重启后仍可从数据库恢复任务状态和错误信息。

**关联模块**：collection routes/service/log、scheduler、管理页面

### [ ] M012 - 完成组织同步管理页面与外部适配层

**详细功能**

- 提供组织同步状态、最近结果和错误详情页面。
- 支持手动上传规范化组织 JSON 并在提交前预览差异。
- 为飞书、LDAP、企业微信定义独立 adapter，将外部响应转换为统一 OrgData。
- 外部凭证仅从部署密钥读取，不能通过浏览器或日志泄露。
- 支持 dry-run，展示预计新增、移动、解绑和停用数量。

**验收标准**

- 至少一个真实外部源完成端到端同步验证。
- 管理员可以从 UI 查看同步历史并重试失败任务。

**关联模块**：sync routes/service、外部 adapter、管理页面

### [ ] M013 - 完善 OIDC、角色与前端路由权限

**详细功能**

- 启动时校验 OIDC issuer/client 配置，生产环境禁止使用测试占位值。
- 管理页面在服务端校验 `session.isAdmin`，普通用户直接进入 403 页面。
- JWT 增加 issuer、audience、token version，并定义角色/团队变更后的失效策略。
- API Key 采用独立哈希存储或密钥系统注入，支持轮换和用途隔离。
- 登录、退出、token 过期和 session exchange 失败均有明确用户流程。

**验收标准**

- 普通成员无法渲染管理页面，也无法调用管理 API。
- 角色被撤销后，不需要等待 24 小时即可失效。
- 错误 issuer、audience、过期和篡改 JWT 均被拒绝。

**关联模块**：NextAuth、auth middleware/service、proxy、环境变量

### [ ] M014 - 完善指标查询性能与大团队聚合

**现状差距**

团队成员列表对每位成员调用一次完整 overview，会产生大量 N+1 查询；中位数和 P95 无论数据库类型都在应用层加载全部数据。

**详细功能**

- 团队成员指标使用一次或少量 groupBy/raw SQL 批量聚合。
- PostgreSQL 使用 `PERCENTILE_CONT`；MySQL 使用受控的应用层或窗口查询实现。
- 所有大列表只选择必要字段，增加时间范围和仓库过滤。
- 为常用可信最新查询评估并增加组合索引。
- 对团队树、成员 ID 和指标查询设置明确缓存与失效策略。

**验收标准**

- 1000 名成员团队的成员页不产生按成员线性增长的 SQL 次数。
- 百万级 pipeline_runs 基准数据下，核心总览查询达到约定响应时间。

**关联模块**：`metrics-service.ts`、Prisma indexes、team cache

### [ ] M015 - 补齐数据保留与安全删除策略

**详细功能**

- Repo 删除默认改为软删除/停用，禁止无提示级联删除 pipeline 历史。
- 实现 `retention-cleanup` 占位任务和启用条件检查。
- 明确定义热、温、冷数据查询和归档接口。
- 清理历史 snapshot 时保留可信最新记录和必要审计信息。
- 归档/删除任务写入独立操作日志并支持 dry-run。

**验收标准**

- 删除仓库配置不会默认删除历史指标。
- retention job 在未达到启用条件时只记录检查，不执行删除。

**关联模块**：Repo schema/routes、scheduler、归档服务

---

## 4. P2 - 工程完整性与长期维护

### [ ] M016 - 整理并落实 Repository 层边界

**现状差距**

当前只有 8 个很薄的 Repository 类，另外 5 张表没有对应实现，而且 routes/services 基本都直接调用 Prisma，现有 Repository 实际未被使用。

**详细功能**

- 决定统一使用 Repository 层，或从设计文档和代码中移除该层，禁止两套模式并存。
- 若保留 Repository：补齐 14 张表、事务接口、分页和常用查询，并让 service 只依赖 Repository。
- Repository 不得只包装一行 Prisma 调用；应承载稳定的数据访问契约和可测试边界。

**验收标准**

- 数据访问路径风格统一，不存在未使用的骨架类。
- service 单元测试可以替换数据访问实现而不连接真实数据库。

**关联模块**：`metrics-server/src/models/`、所有 services/routes

### [ ] M017 - 建立 API 契约与输入输出验证

**详细功能**

- 为全部 31 个端点维护 OpenAPI 或等价契约。
- 响应体在运行时校验，尤其处理 BigInt、日期、分页和错误结构。
- ID、分页、days 等 path/query 参数统一使用 Zod 校验，拒绝 NaN、负数和越界值。
- 固定组织同步 DTO、指标字段命名和空值语义。
- 从契约生成或共享前端 TypeScript 类型，移除手写重复接口。

**验收标准**

- 每个端点都有成功、输入错误、401、403、404 和冲突响应测试。
- 前后端类型由同一契约来源生成或校验。

**关联模块**：API routes/response、website types/api client

### [ ] M018 - 补齐端到端自动化测试

**详细功能**

- 使用本地临时 Git 仓库执行 clone/fetch、相关 commit 过滤、state 提取和 checkpoint 全流程。
- 覆盖正常 fp1、受保护字段篡改、错误私钥、未知 key、legacy 历史导入和重复 snapshot。
- 对 Express 31 个端点增加自动化 HTTP 测试，不依赖人工 curl。
- 对 PostgreSQL 和 MySQL 分别执行数据层集成测试。
- 将 Playwright 桌面/移动测试脚本提交到仓库，覆盖个人、团队、管理、登录和错误状态。

**验收标准**

- CI 可一条命令执行 server unit、DB integration、API integration、website build 和 Playwright。
- 测试不依赖开发者机器上的 ignored 私钥文件，使用测试专用临时 key pair。

**关联模块**：`metrics-server/test/`、`metrics-website/test/`、CI 配置

### [ ] M019 - 完善可观测性和生产配置

**详细功能**

- 日志增加 request ID、collection job ID、repo ID、duration 和错误分类。
- 健康检查拆分 liveness/readiness；readiness 必须检查数据库和关键密钥配置。
- 暴露采集成功率、拒绝数、API 延迟和定时任务状态等监控指标。
- 生产启动禁止 placeholder JWT、API Key、OIDC 和 fingerprint 私钥。
- 编写密钥生成、轮换、吊销和事故恢复流程。

**验收标准**

- 缺少或使用占位生产密钥时服务拒绝启动。
- 数据库不可用时 readiness 返回失败，但 liveness 仍可用于进程探测。

**关联模块**：env、logger、server、scheduler、部署文档

### [ ] M020 - 修正文档完成状态并建立验收追踪

**详细功能**

- 在本清单任务完成前，撤销 `metrics-system-design.md` 中不准确的 Phase 全量 `✅`。
- 为每个 Phase 定义“代码、测试、文档、数据库验证、UI 工作流”五类完成条件。
- 每次勾选任务时附上测试命令、结果和关键文件链接。
- 在 README 中明确当前支持的数据库、认证方式和未实现限制。

**验收标准**

- 设计文档状态与实际代码能力一致。
- 任何 Phase 标记完成时，都能从文档定位到自动化验收证据。

**关联模块**：`docs/metrics/metrics-system-design.md`、两个子项目 README、本清单

---

## 5. 实际实施顺序

| 迭代 | 任务 | 交付目标 |
|------|------|----------|
| **Iteration 1** | M001-M007 | 先修复数据库、指纹、身份、指标和采集 checkpoint，保证数据可信与基本可用 |
| **Iteration 2** | M008-M013 | 补齐管理、团队、采集、组织同步和权限的完整用户工作流 |
| **Iteration 3** | M014-M019 | 处理规模化性能、保留策略、工程边界、测试和生产可观测性 |
| **收尾** | M020 | 根据自动化验收证据更新设计文档完成状态 |

## 6. 验收完成判断

M001-M020 已按上述顺序实施。Phase 状态使用代码、测试、文档、数据库和 UI 五类门禁，
不再根据文件存在情况推断；逐任务记录见
[M001-M020 验收证据](metrics-system-acceptance-evidence.md)。

| Phase | 当前判断 | 主要证据范围 |
|-------|----------|--------------|
| Phase 0 指纹模板 | 已验证 | fp1、篡改/错误密钥/legacy/重复 snapshot 自动化矩阵 |
| Phase 1 数据库基础 | 已验证 | 14 表双 provider migration、PostgreSQL 实库与 PostgreSQL/MySQL CI 矩阵 |
| Phase 2 数据模型 | 已验证 | Schema/Zod、可信/历史/job/retention 字段及可注入数据端口 |
| Phase 3 采集器引擎 | 已验证 | 本地 Git、checkpoint、批次、重试、锁、持久 job 与拒绝审计测试 |
| Phase 4 API Server | 已验证 | 54 端点契约、HTTP 权限/错误矩阵、request ID 和健康检查 |
| Phase 5 指标服务 | 已验证 | 指标口径、时间/仓库过滤、批量聚合、查询次数及数据库集成测试 |
| Phase 6 定时调度 | 已验证 | 采集/retention 调度、恢复、状态指标及失败测试 |
| Phase 7 Dashboard | 已验证 | production build 与桌面/移动 Playwright 用户工作流 |
| Phase 8 组织同步 | 已验证 | canonical reconcile、回滚、adapter 契约、HTTP 与管理 UI 测试 |
