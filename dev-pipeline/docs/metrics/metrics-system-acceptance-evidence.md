# AI 开发能效指标系统 - M001-M020 验收证据

> 验收日期：2026-07-28。测试数据库凭证仅通过进程环境变量注入，本文和仓库均不记录连接串或密钥。

## 1. 验收命令与总结果

| ID | 命令 | 结果 |
|----|------|------|
| A1 | `DB_PROVIDER=postgresql TEST_DATABASE_URL=<redacted> PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=1 npm run metrics:acceptance` | 通过。server contract/lint/typecheck 通过；unit/Git `93 passed / 23 DB tests skipped`；11 个 migration 无待应用项；14 张应用表；PostgreSQL integration/API `23/23`；website unit `16/16`；production build 通过；Playwright desktop/mobile `42/42`。 |
| A2 | `npm run test:e2e -- test/e2e/team-metrics.spec.ts` | 修复成员链接后 desktop/mobile `4/4` 通过。 |
| A3 | `DB_PROVIDER=postgresql TEST_DATABASE_URL=<redacted> npm exec vitest -- run --no-file-parallelism --testTimeout 60000 --retry 1 test/metrics-performance.integration.test.ts` | PostgreSQL 索引存在性与有界 Index Scan `1/1` 通过。 |
| A4 | `openspec validate --all --json --no-interactive` | 通过：`1 passed / 0 failed / 0 issues`。 |
| A5 | GitHub Actions `metrics-server-databases.yml` 的 PostgreSQL/MySQL jobs | 两个 job 均执行同一 `npm run metrics:acceptance`。本地实库使用 PostgreSQL；MySQL 实库执行按已确认方案保留为 CI 门禁，不在本文伪报本地结果。 |

server lint 当前有 38 条测试代码 non-null assertion warning，但命令退出码为 0，无 lint error。单元测试命令主动移除 `TEST_DATABASE_URL`，因此 23 个数据库用例在 unit 阶段跳过，并在同一次 A1 的 DB 阶段全部执行通过。

## 2. 五类门禁

| 门禁 | 结果与证据 |
|------|------------|
| 代码 | A1 的 contract、lint、typecheck 全部通过；API contract 由 [registry.ts](../../metrics-server/src/api/contracts/registry.ts) 生成并校验。 |
| 测试 | server unit/Git `93/93`、PostgreSQL DB/API `23/23`、website unit `16/16`、Playwright `42/42`。 |
| 文档 | [server README](../../metrics-server/README.md)、[website README](../../metrics-website/README.md)、[数据库运维](../../metrics-server/docs/database-operations.md)、[生产运维](../../metrics-server/docs/production-operations.md) 与实现同步。 |
| DB | PostgreSQL schema validate、client generate、11 migrations、14 表形状与 23 个集成/API 用例通过；MySQL 由 A5 的同命令 CI job 强制执行。 |
| UI | Next.js production build 通过；桌面/移动 Chromium `42/42`，覆盖个人、团队、仓库、组织、采集、登录、错误及响应式布局。 |

## 3. M001-M020 逐项证据

| 任务 | 状态 | 测试命令与结果 | 关键文件证据 |
|------|------|----------------|--------------|
| M001 双数据库迁移 | 通过 | A1：PostgreSQL 11 migrations、14 表、DB/API `23/23`；A5：PostgreSQL/MySQL 使用同一验收命令。 | [schema 模板](../../metrics-server/prisma/schema.template.prisma)、[provider 目录](../../metrics-server/prisma/providers)、[prepare 脚本](../../metrics-server/scripts/prepare-prisma-schema.mjs)、[CI matrix](../../.github/workflows/metrics-server-databases.yml)、[数据库运维](../../metrics-server/docs/database-operations.md)。UI 不适用。 |
| M002 可信快照与 legacy | 通过 | A1：`state-parser`、`fingerprint-verifier`、`upsert` 及 DB 集成通过。 | [fingerprint verifier](../../metrics-server/src/collectors/fingerprint-verifier.ts)、[upsert engine](../../metrics-server/src/collectors/upsert-engine.ts)、[指纹测试](../../metrics-server/test/fingerprint-verifier.test.ts)、[upsert 集成](../../metrics-server/test/upsert.integration.test.ts)。UI 不适用。 |
| M003 身份与 API Key | 通过 | A1：`auth` unit/HTTP/session 及 identity Playwright 通过。 | [auth middleware](../../metrics-server/src/api/middleware/auth.ts)、[auth service](../../metrics-server/src/services/auth-service.ts)、[API client](../../metrics-website/lib/api.ts)、[auth HTTP](../../metrics-server/test/auth-http.test.ts)、[identity E2E](../../metrics-website/test/e2e/identity.spec.ts)。 |
| M004 指标口径 | 通过 | A1：metrics DB integration、query port unit 与 Dashboard E2E 通过。 | [metrics service](../../metrics-server/src/services/metrics-service.ts)、[query port](../../metrics-server/src/services/metrics-query-port.ts)、[metrics integration](../../metrics-server/test/metrics.integration.test.ts)、[Dashboard](../../metrics-website/components/dashboard.tsx)。 |
| M005 请求状态 | 通过 | A1：website API unit `7/7`；request-state desktop/mobile E2E 全部通过。 | [API error client](../../metrics-website/lib/api.ts)、[request state](../../metrics-website/components/request-state.tsx)、[API unit](../../metrics-website/test/unit/api.test.ts)、[request-state E2E](../../metrics-website/test/e2e/request-states.spec.ts)。DB 不适用。 |
| M006 原子组织同步 | 通过 | A1：sync unit、HTTP、rollback 与 PostgreSQL integration 通过。 | [sync service](../../metrics-server/src/services/sync-service.ts)、[sync integration](../../metrics-server/test/sync.integration.test.ts)、[sync management HTTP](../../metrics-server/test/sync-management-http.integration.test.ts)。UI 证据由 M012 覆盖。 |
| M007 Checkpoint | 通过 | A1：真实临时 Git、101 commits、无相关 commit、force-push、lock 与 DB checkpoint 测试通过。 | [Git collector](../../metrics-server/src/collectors/git-collector.ts)、[collection service](../../metrics-server/src/services/collection-service.ts)、[Git checkpoint test](../../metrics-server/test/git-checkpoint.test.ts)、[checkpoint integration](../../metrics-server/test/checkpoint.integration.test.ts)。UI 不适用。 |
| M008 仓库管理 | 通过 | A1：repo service/HTTP 与 desktop/mobile repository lifecycle E2E 通过。 | [repo routes](../../metrics-server/src/api/routes/repos.ts)、[repo service](../../metrics-server/src/services/repo-service.ts)、[repo manager](../../metrics-website/components/repo-manager.tsx)、[repo HTTP](../../metrics-server/test/repos-http.integration.test.ts)、[repo E2E](../../metrics-website/test/e2e/repository-management.spec.ts)。 |
| M009 团队与开发者管理 | 通过 | A1：organization service/HTTP 与管理员 desktop/mobile E2E 通过。 | [organization service](../../metrics-server/src/services/organization-admin-service.ts)、[team routes](../../metrics-server/src/api/routes/teams.ts)、[developer routes](../../metrics-server/src/api/routes/developers.ts)、[manager UI](../../metrics-website/components/organization-manager.tsx)、[HTTP test](../../metrics-server/test/organization-http.integration.test.ts)。 |
| M010 团队面板 | 通过 | A1：team metrics DB/API `2/2`、team Playwright desktop/mobile `4/4`；A2 复验 `4/4`。 | [metrics routes](../../metrics-server/src/api/routes/metrics.ts)、[team page](../../metrics-website/app/team/page.tsx)、[team workspace](../../metrics-website/components/team-workspace.tsx)、[team HTTP](../../metrics-server/test/team-metrics-http.integration.test.ts)、[team E2E](../../metrics-website/test/e2e/team-metrics.spec.ts)。 |
| M011 采集运行管理 | 通过 | A1：collection job HTTP `3/3`、锁测试及 desktop/mobile collection E2E 通过。 | [collection service](../../metrics-server/src/services/collection-service.ts)、[worker](../../metrics-server/src/services/collection-worker.ts)、[collection routes](../../metrics-server/src/api/routes/collection.ts)、[runs UI](../../metrics-website/components/collection-runs.tsx)、[job HTTP](../../metrics-server/test/collection-jobs-http.integration.test.ts)。 |
| M012 组织 adapter 与同步 UI | 通过 | A1：三类 adapter fixture、凭证门禁、sync HTTP 与 desktop/mobile organization E2E 通过。 | [adapter registry](../../metrics-server/src/adapters/organization/registry.ts)、[fixtures](../../metrics-server/test/fixtures/organization)、[adapter tests](../../metrics-server/test/organization-adapters.test.ts)、[sync manager](../../metrics-website/components/organization-sync-manager.tsx)、[organization E2E](../../metrics-website/test/e2e/organization-management.spec.ts)。 |
| M013 OIDC 与授权 | 通过 | A1：env/auth/session、issuer/audience/expiry/token-version 与 admin route 单元/HTTP/E2E 通过。 | [env validation](../../metrics-server/src/config/env.ts)、[auth middleware](../../metrics-server/src/api/middleware/auth.ts)、[NextAuth](../../metrics-website/auth.ts)、[auth config tests](../../metrics-website/test/unit/auth-config.test.ts)、[session integration](../../metrics-server/test/auth-session.integration.test.ts)。 |
| M014 指标性能 | 通过 | A1：1000 member 查询次数、provider-aware percentile 与 DB plan 通过；A3 单独复验 Index Scan `1/1`。 | [query port](../../metrics-server/src/services/metrics-query-port.ts)、[cache](../../metrics-server/src/services/metrics-cache.ts)、[performance test](../../metrics-server/test/metrics-performance.integration.test.ts)、[query-count test](../../metrics-server/test/metrics-query-count.test.ts)、[性能说明](../../metrics-server/docs/metrics-query-performance.md)。UI 由 M010 覆盖。 |
| M015 Retention | 通过 | A1：retention unit/scheduler/PostgreSQL integration 全部通过。 | [retention service](../../metrics-server/src/services/retention-service.ts)、[scheduler](../../metrics-server/src/scheduler/cron.ts)、[integration](../../metrics-server/test/retention.integration.test.ts)、[retention 运维](../../metrics-server/docs/retention-operations.md)。UI 不适用。 |
| M016 数据访问边界 | 通过 | A1：data-access boundaries、mock port 与 service unit 通过。 | [metrics port](../../metrics-server/src/services/metrics-query-port.ts)、[administration service](../../metrics-server/src/services/administration-service.ts)、[boundary test](../../metrics-server/test/data-access-boundaries.test.ts)、[边界说明](../../metrics-server/docs/data-access-boundaries.md)。DB/UI 不适用。 |
| M017 API 契约 | 通过 | A1：contract check、contract unit/HTTP、前后端 typecheck 通过。 | [contract registry](../../metrics-server/src/api/contracts/registry.ts)、[OpenAPI](../../metrics-server/docs/openapi.json)、[generated frontend types](../../metrics-website/lib/generated/api-contract.ts)、[contract HTTP](../../metrics-server/test/api-contract-http.test.ts)。 |
| M018 端到端自动化 | 通过 | A1 单命令完成 `93` unit/Git、`23` DB/API、`16` website unit、build、`42` Playwright。 | [acceptance runner](../../scripts/metrics-acceptance.mjs)、[Git fixture helper](../../metrics-server/test/helpers/git-repository.ts)、[Playwright config](../../metrics-website/playwright.config.ts)、[CI matrix](../../.github/workflows/metrics-server-databases.yml)。 |
| M019 可观测性与生产配置 | 通过 | A1：observability、env production rejection、health/contract tests 通过。 | [request context](../../metrics-server/src/api/middleware/request-context.ts)、[metrics registry](../../metrics-server/src/observability/metrics.ts)、[readiness](../../metrics-server/src/observability/readiness.ts)、[observability test](../../metrics-server/test/observability.test.ts)、[生产运维](../../metrics-server/docs/production-operations.md)。 |
| M020 文档与验收追踪 | 通过 | A1-A3 全绿；A4 全量 OpenSpec validate 结果见第 4 节。 | [设计状态](metrics-system-design.md)、[主清单](metrics-system-remaining-tasks.md)、[server README](../../metrics-server/README.md)、[website README](../../metrics-website/README.md)、本文。 |

## 4. OpenSpec 校验

`openspec validate --all --json --no-interactive` 返回 change
`complete-metrics-system-remaining-tasks` 为 `valid: true`，汇总为 `1 passed / 0 failed`，
且 `issues` 为空。设计文档 Phase 0-8 的“已验证”状态与第 2、3 节证据一致。
