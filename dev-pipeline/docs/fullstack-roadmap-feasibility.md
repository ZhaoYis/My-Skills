## 阶段 A1 — 交付闭环 MVP（2–4 周）

> 目标：建立"push 之后"的可恢复闭环——PR 创建、CI 消费、与本地 merge 互斥的状态机。

### ✅ 可行性高，可直接动手

| 任务 | 可行性评估 | 关键发现 |
|------|-----------|---------|
| **A1-1: stack profile schema** | ✅ 高 | `openspec/config.yaml` 已有 `schema`/`stacks`/`rules` 节点，shell 脚本已能解析这些字段。最小 schema 本质上是结构化现有 YAML 段 + 增加 `services[]` 字段 |
| **A1-2: runtime state schema** | ✅ 高 | 当前完全没有运行时状态持久化——Phase 之间全靠 LLM 会话记忆。这是净新增，没有迁移负担。用 YAML/JSON 文件写到 `openspec/` 下即可 |
| **A1-4: opsx-pr skill** | ✅ 高 | `gh` CLI 是标准工具，skill 模板框架成熟（12 个 skill 已有模式可复制），新增 skill 只需：`config/features.json` + `types.ts` FeatureId 枚举 + `manifest.ts` 资产声明 + `templates/` 模板文件 |
| **A1-5: opsx-ci-triage** | ✅ 高 | 同上。`gh pr checks` / `gh run view` 的 JSON 输出可以直接消费，失败分类（code/infra/flaky/config）是纯逻辑判断 |

### ⚠️ 需要重点设计，但可行

| 任务 | 可行性评估 | 关键风险与对策 |
|------|-----------|--------------|
| **A1-3: Phase 6/7 状态机** | ⚠️中等 | **这是整个 MVP 最难的部分**。当前 Decision Point 4 只有两个选项（push+merge / push-only）。需要：1) 增加 PR 模式为第三选项 2) 在 Phase 6 步骤 20/21 前增加模式分发逻辑 3) PR 模式下禁止本地 merge。**关键冲突**：现有 `phase-6-merge-push.md` 中 7 个决策点（5a/5b/5/5c/6/6a/6b）全部假设本地 git 操作，引入 PR 模式后需要大量条件分支 |
| **A1-6: 修正 README 流程图** | ✅ 低风险 | 已有 mermaid 图，只需加 Phase 7 节点和 PR/CI 循环路径 |
| **A1-7: 样例仓库验收** | ✅ 高 | 我们刚建的 `test-pipeline/` 可以直接作为验收平台 |

### 🔴 需要先解决的前置依赖

1. **`doctor --stack`** 提案中提到但 CLI 代码中不存在。需要新增 `doctor` 的 `--stack` flag、stack profile 校验逻辑、以及对应的测试
2. **`dev-pipeline-resolve-delivery.sh`** 新脚本——从 `openspec/config.yaml` 读取 `opsx.delivery_mode`，返回结构化 JSON。这个模式已有先例（`dev-pipeline-resolve-verify.sh` 做同样的事情但针对 verify 命令）

---

## 阶段 A2 — 质量闭环增强（2–4 周）

> 目标：补齐环境准备与集成验证能力。

### ✅ 可行性高

| 任务 | 可行性评估 | 关键发现 |
|------|-----------|---------|
| **A2-1: opsx-env-setup** | ✅ 高 | 基本上是 Docker + 健康检查的标准化封装。已有 `stack.infra` 段提供命令来源 |
| **A2-2: design verification 映射** | ✅ 高 | `opsx-design` 模板已有验证断言字段的设计，只是还没落地。本质是模板扩展 |
| **A2-3: opsx-integration-test** | ✅ 高 | 新增 skill，有成熟的模板模式 |
| **A2-4: doctor --stack 增强** | ✅ 高 | 在 A1-1 基础上增强校验逻辑（path/cwd 存在性、command 结构合法性） |

### ⚠️ 风险点

- **integration test 与 verify 的边界**：roadmap 中 `opsx-integration-test` 负责 DB/缓存/API 集成测试，`opsx-verify` 负责 build/startup/smoke/contract。但当前 `opsx-verify` 的 phase-3-functional-check 已经涉及"数据校验"，容易职责重叠。需要在 skill 模板中明确写死边界

---

## 阶段 B — 前端与发布治理（4–6 周）

> 目标：E2E 测试、部署 checklist、安全审查。

### 可行性降级——这个阶段依赖大量外部工具

| 任务 | 可行性评估 | 风险 |
|------|-----------|------|
| **B1: opsx-e2e-test** | ⚠️中等 | 依赖 Playwright/Cypress 框架。全栈项目需要前后端同时运行，`opsx-env-setup` 必须先就位。降级路径（人工 UI checklist）反而比自动执行更容易实现 |
| **B2: opsx-deploy** | ⚠️中等 | Roadmap 明确 P0 不做通用自动部署，B 阶段也只做 checklist 模式。这降低了风险，但 checklist 的"检查→执行→验证"循环如何与 pipeline 门禁集成需要设计 |
| **B3: opsx-api-contract** | ✅ 高 | 本质是 design 阶段的静态分析 + schema diff，不依赖运行时 |
| **B4: opsx-db-migrate** | ⚠️中等 | 依赖特定 ORM 工具（Prisma/Drizzle/Knex），每种工具的输出格式不同。建议先从 Prisma 开始（最常见的 TypeScript ORM） |
| **B5: opsx-security-review** | ✅ 高 | 已有 `security-report.md` 作为模板。轻量检查（secrets/依赖漏洞/高风险模式）可以纯静态实现 |

---

## 阶段 C — 规模化与体验（4–8 周）

> 目标：栈脚手架、可观测性、元 skill。

### ⚠️ 这个阶段风险最高，建议观望

| 任务 | 可行性评估 | 原因 |
|------|-----------|------|
| **C1: init --stack** | ⚠️中低 | 每种技术栈需要维护一套完整的脚手架模板（Next.js/Express/React/...），维护成本指数级增长。不如先让用户提供自己的项目，pipeline 通过 stack profile 适配 |
| **C2: opsx-observe** | 🔴 低 | "发布后可观测性验收"需要对接监控系统（Datadog/Grafana/...），这是平台绑定逻辑，不适合放在通用 pipeline 里 |
| **C3: opsx-perf-smoke** | ⚠️中等 | 简单的 `ab`/`wrk` 基准可以，但要定义"通过"标准（响应时间/P99/错误率）高度项目相关 |
| **C4: opsx-fullstack** | ⚠️中等 | 元 skill 本身不难——只是一个路由表。但路由的准确性依赖所有下游 skill 就位，是一个"聚合"型产品，不是独立功能 |
| **C5: pipeline status** | ✅ 高 | 本质是 runtime state 文件的读取器，依赖 A1-2 就位 |
| **C6: 按栈绑定的 deploy** | 🔴 低 | 与 C1 同样的问题——每种部署目标（Vercel/Railway/AWS/Docker）需要不同的逻辑 |

---

## 综合评估

### 推荐实施顺序（与 roadmap 不同的建议）

```
现在可以做的（P0 第一期，1-2 周）:
├── A1-1: stack profile 最小 schema → 成本极低，可以立刻动手
├── A1-2: runtime state schema → 成本极低，定义好 YAML 结构即可
├── A1-4: opsx-pr skill（创建，不等待 CI）→ 可独立交付
└── A1-7: 用 test-pipeline 框架做验收

第二期（2-3 周）:
├── A1-3: Phase 6/7 状态机 → 这是最大的一块，需要仔细重构
├── A1-5: opsx-ci-triage → 依赖 gh CLI
└── A2-2: design verification 映射 → 扩展 opsx-design 模板

第三期（2-3 周）:
├── A2-1: opsx-env-setup
├── A2-3: opsx-integration-test
└── A2-4: doctor --stack 增强

观望（等前三期稳定后再考虑）:
├── B1/B2: E2E 和 deploy → 依赖 env-setup 和 integration-test 成熟
├── C1/C6: 脚手架 → 维护成本太高，建议先不做
└── C4: opsx-fullstack → 等至少 6 个下游 skill 稳定后再聚合
```

### 最大的工程风险

| 排名 | 风险 | 严重程度 | 说明 |
|------|------|---------|------|
| 1 | **Phase 6/7 状态机重构** | 🔴 高 | 现有 Phase 6 有 7 个决策点，全部假设本地 git。引入 PR 模式会产生大量条件分支，容易遗漏边界情况 |
| 2 | **缺少幂等恢复的测试** | 🔴 高 | runtime state 的"暂停→恢复"是核心卖点，但没有测试框架能模拟跨会话恢复。`test-pipeline` 可以扩展覆盖这个场景 |
| 3 | **skill 膨胀** | 🟡 中 | Roadmap 规划了 10 个新 skill（pr、ci-triage、env-setup、integration-test、e2e-test、deploy、api-contract、db-migrate、security-review、fullstack），用户面对的复杂度显著增加。需要强化 feature flag 机制和路由表 |
| 4 | **没有真实 CI 环境** | 🟡 中 | `opsx-ci-triage` 的测试需要真实的 CI failure 场景（flake、infra 故障等），本地无法模拟 |

### 一句话结论

**Roadmap 的 A 阶段（A1 + A2）在工程上完全可行，核心瓶颈是 Phase 6/7 状态机重构。B 阶段可以部分做（api-contract、security-review、db-migrate），但 E2E 和 deploy checklist 依赖 A2 就位。C 阶段的栈脚手架和自动部署不建议在 2026 年内投入——维护成本远超收益。**
