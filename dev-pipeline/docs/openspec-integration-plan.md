# OpenSpec 集成方案：内置核心能力 + 前后端 Schema 区分

> 版本: v1.1 | 日期: 2026-07-25 | 状态: 设计阶段 — 已评审

## 一、背景与目标

### 现状问题

当前 `opsx-dev-pipeline` 是一个 npm CLI 工具，为 AI 工具（Claude Code / Cursor / Codex）安装统一的流水线模板。存在两个核心不足：

1. **OpenSpec Skills/Commands 缺失**：流水线依赖 OpenSpec CLI，但 `opsx-dev-pipeline init` 不会自动安装 OpenSpec 的斜线命令（`/opsx:propose` 等）和 Skills。用户需要手动运行 `openspec init`。
2. **前后端无区分**：所有项目安装完全相同的模板，无法根据技术栈（React 前端 vs Java 后端）定制 schema 和配置。

### 目标

`opsx-dev-pipeline init --tool claude --stack backend` 一键完成：

```
Preflight → OpenSpec 基础初始化 → 前后端 Schema 注入 → 流水线 Skill 安装
```

---

## 二、OpenSpec 架构回顾

### 2.1 OpenSpec 是什么

OpenSpec（[Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec)）是一个规范驱动开发（SDD）框架，核心理念是"先写规范，再写代码"。

### 2.2 核心概念

| 概念 | 说明 |
|------|------|
| **Schema** | 定义工作流的 artifacts 集合，位于 `openspec/schemas/<name>/schema.yaml` |
| **Artifact** | 变更的产出物：proposal.md, design.md, specs/*.md, tasks.md |
| **Profile** | 控制哪些 Skills/Commands 被安装：`core`（5 个）或 `custom`（可扩展到 11 个） |
| **config.yaml** | 项目级配置：指定默认 schema、注入 context、定义 rules |

### 2.3 Schema 依赖图（spec-driven）

```
proposal ──┬──> specs ──┬──> tasks ──> apply（实施开始）
           └──> design ─┘
```

### 2.4 `openspec init` 生成的文件（Claude Code）

```
.claude/
├── skills/                              # Agent Skills RFC
│   ├── openspec-explore/SKILL.md        # /opsx:explore
│   ├── openspec-propose/SKILL.md        # /opsx:propose
│   ├── openspec-apply-change/SKILL.md   # /opsx:apply
│   ├── openspec-sync-specs/SKILL.md     # /opsx:sync
│   └── openspec-archive-change/SKILL.md # /opsx:archive
└── commands/opsx/
    ├── explore.md                       # 斜线命令入口
    ├── propose.md
    ├── apply.md
    ├── sync.md
    └── archive.md

openspec/
├── config.yaml                          # 项目配置
├── specs/                               # 当前规范（空）
└── changes/                             # 变更提案
    └── archive/                         # 已归档变更
```

---

## 三、设计方案

### 3.1 方案选型：方案 C（混合模式）

| | A：包装 CLI | B：复刻模板 | **C：混合 🔥** |
|---|---|---|---|
| 实现方式 | `init` 内部调用 `openspec init` | 自己用 Handlebars 渲染所有文件 | OpenSpec CLI 做基础 + 模板系统叠加定制 |
| 维护成本 | 低 | **高** | 中等 |
| 灵活性 | 低 | 高 | **高** |
| 版本兼容 | 跟随上游 | 容易落后 | 核心跟随上游，叠加层独立 |

### 3.2 整体流程

```
opsx-dev-pipeline init --tool claude --stack backend

 Step 0: Preflight — 检查 openspec CLI 可用性 + 版本        ← 失败则终止
 Step 1: 交互收集 → { projectName, tool, features, stack }
 Step 2: openspec init --tools <tool>                       ← 参数动态匹配所选工具，失败则终止
 Step 3: 构建 InstallPlan（含 schema bundle + config 模板）  ← 统一走 asset manifest
 Step 4: 冲突解决（交互确认覆盖/跳过/追加）                  ← schema/config 走同一流程
 Step 5: 执行 InstallPlan（渲染 .hbs 模板 + 复制文件）
 Step 6: 写入 Manifest（记录所有 managed assets + stack）
```

### 3.3 关键决策

- **前后端分离**：frontend / backend 各一套独立 schema，互不干扰（即使基座阶段内容相同，架构上已预留扩展点）
- **取消 fullstack**：单次 init 只针对 frontend 或 backend
- **基座阶段**：schema 先用 OpenSpec 原始 spec-driven 结构，后续再专门设计流程差异
- **前端默认技术栈**：React 18+ + TypeScript + Vite
- **后端默认技术栈**：Java 17+ + Spring Boot 3.x + Maven/Gradle
- **统一 asset manifest**：schema 和 config 纳入 manifest 管理，走和 skills/commands 相同的安装、冲突解决、sync/upgrade 流程
- **Schema 模板 Handlebars 化**：所有 schema 模板使用 `.hbs` 后缀，支持变量注入（`{{stack}}`、`{{projectName}}` 等）
- **CLI 必填 `--stack`**：`--yes` 非交互模式下 `--stack` 为必填参数；交互模式默认选中 `backend`
- **Preflight 前置检查**：init 前校验 `openspec` CLI 可用性及最低版本，失败立即终止

---

## 四、OpenSpec 模板格式参考

以下是 OpenSpec 内置 `spec-driven` schema 的完整模板格式，将作为我们前后端 schema 模板的基座。

### 4.1 schema.yaml

```yaml
name: spec-driven
version: 1
description: Standard spec-driven workflow

artifacts:
  - id: proposal
    generates: proposal.md
    description: Why the change is needed and what capabilities are affected
    template: proposal.md
    instruction: |
      Create a proposal that captures the intent, scope, and approach at a high level.
      Focus on WHY this change is needed, not HOW to implement it.
    requires: []

  - id: specs
    generates: specs/**/*.md
    description: WHAT the system should do -- requirements and scenarios
    template: spec.md
    instruction: |
      Create delta specs describing what's changing relative to current specs.
      Use Given/When/Then format for scenarios.
    requires:
      - proposal

  - id: design
    generates: design.md
    description: HOW to implement -- architecture and decisions
    template: design.md
    instruction: |
      Create a design document explaining the technical approach.
      Include architecture decisions and data flow.
    requires:
      - proposal

  - id: tasks
    generates: tasks.md
    description: Checkbox task list for implementation
    template: tasks.md
    instruction: |
      Create an implementation checklist with checkboxes.
      Break down the design into actionable steps.
    requires:
      - specs
      - design

apply:
  requires: [tasks]
  tracks: tasks.md
```

### 4.2 proposal.md 模板

```markdown
## Why

<!-- Explain the motivation for this change. What problem does this solve? Why now? -->

## What Changes

<!-- Describe what will change. Be specific about new capabilities, modifications, or removals. -->

## Capabilities

### New Capabilities
<!-- Capabilities being introduced. Each creates specs/<name>/spec.md -->
- `<name>`: <brief description of what this capability covers>

### Modified Capabilities
<!-- Existing capabilities whose REQUIREMENTS are changing (not just implementation).
     Only list here if spec-level behavior changes. -->
- `<existing-name>`: <what requirement is changing>

## Impact

<!-- Affected code, APIs, dependencies, systems -->
```

### 4.3 design.md 模板

```markdown
## Context
<!-- Background, current state, constraints, stakeholders -->

## Goals / Non-Goals
- Goals: [...]
- Non-Goals: [...]

## Decisions
<!-- For each key technical choice: -->
### Decision: <what and why>
- Alternatives considered: <options with rationale>

## Risks / Trade-offs
- [Risk] --> Mitigation

## Migration Plan
<!-- Steps to deploy, rollback strategy (if applicable) -->

## Open Questions
- [...]
```

### 4.4 spec.md 模板

```markdown
## ADDED Requirements

### Requirement: <Requirement Name>
<Description using SHALL or MUST>

The system {MUST/SHALL/SHOULD} {do something specific}.

#### Scenario: <Happy path scenario>
- GIVEN <precondition>
- WHEN <action>
- THEN <expected outcome>
- AND <additional outcome, if any>

#### Scenario: <Edge case scenario>
- GIVEN <precondition>
- WHEN <action>
- THEN <expected outcome>

## MODIFIED Requirements

### Requirement: <Existing Requirement Name>
<New description -- replaces the existing one>
(Previously: <what it was before>)

#### Scenario: <Updated scenario>
- GIVEN <updated precondition>
- WHEN <updated action>
- THEN <updated outcome>

## REMOVED Requirements

### Requirement: <Requirement Being Removed>
**Reason**: <why this requirement is being deprecated/removed>
**Migration**: <how users should handle the removal>

## RENAMED Requirements

- FROM: `### Requirement: <Old Name>`
- TO: `### Requirement: <New Name>`
```

**格式规则：**
- Scenarios 必须使用 `####`（4 个 `#`）
- 每个 `### Requirement:` 至少有一个 `#### Scenario:`
- 使用 SHALL/MUST 表达规范级需求
- MODIFIED 必须包含完整的需求块，不能只写差异

### 4.5 tasks.md 模板

```markdown
# Tasks

## 1. <Task Group Name>
- [ ] 1.1 <Step description>
- [ ] 1.2 <Step description>

## 2. <Task Group Name>
- [ ] 2.1 <Step description>
- [ ] 2.2 <Step description>
```

### 4.6 config.yaml 格式

```yaml
schema: spec-driven          # 默认 schema
context: |                   # 注入到所有 AI prompt
  Tech Stack: ...
  Conventions: ...
rules:                       # 按 artifact 的质量规则
  proposal:
    - "Must include rollback plan"
  specs:
    - "Use Given/When/Then format"
```

Schema 解析优先级：CLI `--schema` > change metadata (`.openspec.yaml`) > project config (`config.yaml`) > 默认 (`spec-driven`)

---

## 五、实现清单

### 5.1 类型层改动

| 文件 | 改动 |
|------|------|
| `src/core/adapters/types.ts` | 新增 `StackId = 'frontend' \| 'backend'` |
| `src/core/prompts/types.ts` | `InitOptions` 新增 `stack?: StackId`；`InitAnswers` 新增 `stack: StackId` |
| `src/core/init/types.ts` | `InstallPlan` 新增 `stack: StackId` |
| `src/core/manifest/types.ts` | `PipelineManifest` 新增 `stack?: StackId` |

### 5.2 CLI 层改动

| 文件 | 改动 |
|------|------|
| `src/cli/index.ts` | `init` 命令新增 `--stack <frontend\|backend>` 选项 |
| `src/cli/commands/init.ts` | 透传 `stack` 参数到 `runInit` |

**行为规则：**
- `--yes` 非交互模式：`--stack` **必填**，未传则报错退出
- 交互模式（无 `--yes`）：`select` 提示选择 frontend/backend，默认选中 `backend`

### 5.3 Preflight 检查（新增）

**文件：`src/core/init/runInit.ts`** — 在 `collectInputs` 之前增加 preflight 步骤：

1. 执行 `openspec --version` 检查 CLI 是否可用
2. 验证版本 ≥ 最低要求（建议 `1.6.0`，因为该版本引入了 `openspec update` 和自定义 schema 能力）
3. 不可用或版本过低 → 打印明确错误信息并终止

### 5.4 交互收集改动

**文件：`src/core/init/collectInputs.ts`**

- 非 `--yes` 模式：新增 `select` 类型交互，选项 `frontend` / `backend`，`initial` 指向 `backend`
- `--yes` 模式：校验 `options.stack` 是否存在，缺失则报错退出

### 5.5 OpenSpec CLI 调用（新增）

**文件：`src/core/init/runInit.ts`** — 在构建 InstallPlan 之前：

1. 调用 `openspec init --tools <answers.tool>`（参数动态取自交互收集结果）
2. 调用失败 → 立即终止，不继续后续步骤
3. 成功 → 继续构建 InstallPlan

### 5.6 Asset Manifest 扩展

**文件：`src/core/assets/manifest.ts`** — 新增 asset definitions：

```typescript
// Schema bundle — frontend
{
  id: 'frontend-schema-bundle',
  kind: 'bundle',
  scope: 'common',
  feature: 'schema',           // 新增 feature
  source: 'templates/common/schemas/frontend',
  destination: 'openspec/schemas/frontend',
  includeExtensions: ['.md', '.yaml', '.hbs'],
  templateFiles: ['schema.yaml.hbs'],   // schema.yaml 也需要渲染
  excludePatterns: ['.gitkeep'],
  bundleGatedFiles: [],        // 后续按需 feature-gate
},
// Schema bundle — backend（结构同上，source/destination 不同）
// Config template（根据 stack 选择渲染哪个）
{
  id: 'stack-config',
  kind: 'template',
  scope: 'common',
  feature: 'schema',
  source: 'templates/common/config/config.{{stack}}.yaml.hbs',
  destination: 'openspec/config.yaml',
},
```

**Feature 扩展：** `FeatureId` 新增 `'schema'`，`config/features.json` 新增对应条目（`default: true`）。

### 5.7 核心流程改动

| 文件 | 改动 |
|------|------|
| `src/core/init/runInit.ts` | 增加 preflight → openspec init 调用 → buildInstallPlan → resolveInstallConflicts → executeInstallPlan→ writeManifest |
| `src/core/init/buildInstallPlan.ts` | `BuildInstallPlanInput` 新增 `stack`；`templateContext` 新增 `{{stack}}` 变量；schema bundle 走现有 `expandBundle` 逻辑 |
| `src/core/init/executeInstallPlan.ts` | manifest 写入时记录 `stack` 字段；config.yaml 写入前检测已有文件并走冲突解决 |

### 5.8 config.yaml 写入策略

写入 `openspec/config.yaml` 时的冲突处理：

1. 文件不存在 → 正常写入
2. 文件存在且由 pipeline 管理（manifest 中有记录） → 走现有冲突解决流程（覆盖/追加/跳过）
3. 文件存在但非 pipeline 管理（用户手动创建或 `openspec init` 生成） → 提示用户选择：覆盖 / 跳过 / 追加 context

### 5.9 新增模板文件

```
templates/common/
├── schemas/
│   ├── frontend/
│   │   ├── schema.yaml.hbs    ← .hbs 后缀，支持变量渲染
│   │   └── templates/
│   │       ├── proposal.md.hbs
│   │       ├── design.md.hbs
│   │       ├── spec.md.hbs
│   │       └── tasks.md.hbs
│   └── backend/
│       ├── schema.yaml.hbs
│       └── templates/
│           ├── proposal.md.hbs
│           ├── design.md.hbs
│           ├── spec.md.hbs
│           └── tasks.md.hbs
└── config/
    ├── config.frontend.yaml.hbs
    └── config.backend.yaml.hbs
```

> **注意：** 所有 schema 模板使用 `.hbs` 后缀，走 Handlebars 渲染流程，支持 `{{stack}}`、`{{projectName}}` 等上下文变量。与 `SKILL.md.hbs` 处理方式一致（渲染后去掉 `.hbs` 后缀）。

### 5.10 测试

| 文件 | 改动 |
|------|------|
| `test/integration/init-matrix.test.ts` | 新增 stack 维度测试用例 |
| `test-pipeline/scenarios/` | 后续新增 frontend-only / backend-only 场景 |

---

## 六、前后端 Schema 基座内容

### 6.1 schema.yaml.hbs

基座阶段 frontend 和 backend 的 `schema.yaml.hbs` **完全一致**，沿用 OpenSpec `spec-driven` 的 artifacts 结构。使用 `.hbs` 后缀预留变量注入能力。后续迭代再根据流程差异调整 `instruction` 和 `requires` 链。

### 6.2 config.frontend.yaml.hbs

```yaml
schema: frontend
context: |
  Project Type: Frontend Application
  Tech Stack: React 18+, TypeScript, Vite
  Testing: Vitest + React Testing Library + Playwright (E2E)
  Conventions: Functional components, hooks-first, CSS Modules or Tailwind
  Code Quality: Biome for linting/formatting

rules:
  proposal:
    - "Must include UI/UX impact analysis"
    - "Must specify browser/device compatibility requirements"
  specs:
    - "Use Given/When/Then format for user interaction scenarios"
  design:
    - "Must include component tree diagram or description"
    - "Must specify route design and state management strategy"
```

### 6.3 config.backend.yaml.hbs

```yaml
schema: backend
context: |
  Project Type: Backend Service
  Tech Stack: Java 17+, Spring Boot 3.x, Maven/Gradle
  ORM: MyBatis-Plus / JPA / JOOQ
  Testing: JUnit 5 + Mockito + Spring Boot Test + Testcontainers
  Conventions: Layered architecture (Controller → Service → Repository), DTO pattern
  Code Quality: Checkstyle / SpotBugs

rules:
  proposal:
    - "Must include API contract changes (endpoints, request/response DTOs)"
    - "Must specify database migration strategy (Flyway/Liquibase)"
  specs:
    - "Use Given/When/Then format for API behavior scenarios"
  design:
    - "Must include ERD or data model changes"
    - "Must specify middleware/interceptor chain changes"
```

---

## 七、实现顺序

| # | 步骤 | 涉及文件 | 风险 |
|---|------|---------|------|
| ✅ 1 | 类型层：新增 `StackId` + `'schema'` FeatureId，扩展所有相关接口 | `adapters/types.ts`, `prompts/types.ts`, `init/types.ts`, `manifest/types.ts`, `config/features.json` | 低 |
| ✅ 2 | 创建 schema 模板文件（frontend + backend，全部 `.hbs` 后缀） | `templates/common/schemas/{frontend,backend}/*.hbs` | 低 |
| ✅ 3 | 创建 config 模板文件 | `templates/common/config/config.{frontend,backend}.yaml.hbs` | 低 |
| ✅ 4 | 在 asset manifest 中注册 schema + config assets | `src/core/assets/manifest.ts` | 低 |
| ✅ 5 | CLI 层：`--stack` 选项 + 必填校验 | `src/cli/index.ts`, `src/cli/commands/init.ts` | 低 |
| ✅ 6 | 交互收集：stack 选择 + `--yes` 校验 | `src/core/init/collectInputs.ts` | 低 |
| ✅ 7 | Preflight + openspec init 调用 | `src/core/init/runInit.ts` | 中 |
| ✅ 8 | 核心流程：stack 注入到 buildInstallPlan + executeInstallPlan | `src/core/init/runInit.ts`, `buildInstallPlan.ts`, `executeInstallPlan.ts` | 中 |
| ✅ 9 | 编译验证 + 冒烟测试 + 集成测试 | `npm run build && npm run test` | 低 |

---

## 八、验证方案

### 编译验证

```bash
npm run build        # TypeScript 零错误编译
npm run typecheck    # 全量类型检查
```

### 冒烟测试

```bash
# 前端模式 — dry-run 预览
npx tsx src/bin/opsx-dev-pipeline.ts init --tool claude --stack frontend --yes --dry-run

# 后端模式 — dry-run 预览
npx tsx src/bin/opsx-dev-pipeline.ts init --tool claude --stack backend --yes --dry-run

# 校验 --yes 模式下缺少 --stack 时报错
npx tsx src/bin/opsx-dev-pipeline.ts init --tool claude --yes
```

### 集成测试

```bash
npm test             # 确保现有测试不受影响
```

### E2E 验证

在临时目录实际执行 init，检查生成的文件结构：

```bash
mkdir /tmp/test-backend && cd /tmp/test-backend
npx tsx /path/to/dev-pipeline/src/bin/opsx-dev-pipeline.ts init --tool claude --stack backend --yes

# 验证预期生成的文件
tree .claude/skills/openspec-*/      # OpenSpec 5 个 Skills
tree .claude/commands/opsx/          # OpenSpec 5 个 Commands
tree .claude/skills/opsx-dev-pipeline/ # 流水线 Skill
tree openspec/schemas/backend/       # 后端 Schema + 模板（.hbs 已渲染去后缀）
cat openspec/config.yaml             # 指定 schema: backend + Java context
```

### Preflight 验证

```bash
# 模拟 openspec 未安装的场景
PATH=/tmp/fake:$PATH npx tsx src/bin/opsx-dev-pipeline.ts init --tool claude --stack backend --yes
# 预期：打印 "openspec CLI not found" 并退出码非零
```

---

## 九、后续迭代方向

1. **Schema 流程差异化**：根据 React 前端和 Java 后端的实际开发流程，定制各自的 artifact 依赖链和 AI 提示词
2. **技术栈细分**：前端支持 Vue/Angular 变体，后端支持 Python/Go/Node.js 变体
3. **Config 深度定制**：在 config.yaml 的 context/rules 中注入更多项目级别的约束和最佳实践
4. **CI/CD 集成**：在 schema 中增加 deploy、migration 等 artifact
5. **Preflight 增强**：增加 `git` CLI 可用性、`gh` CLI（GitHub issue tracker）等检查
