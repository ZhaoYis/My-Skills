# Plan: 全栈模式 (fullstack) 支持

## Context

当前 `StackId` 类型只有 `'frontend'` 和 `'backend'` 两个值。用户希望在初始化流水线时增加 `'fullstack'` 全栈模式，用于同时包含前后端的 monorepo 项目。

设计决策：
- **独立 fullstack schema**：新建 `templates/common/schemas/fullstack/` 目录，不复用 frontend/backend 的 schema bundle
- **多 service 结构**：config.yaml 中包含 `stack:` 段，定义 `frontend` 和 `backend` 两个 service
- **交互式选项**：prompts 中增加 Fullstack 选项，与 Frontend/Backend 并列

## 改动范围

### ✅ 1. 类型定义 — `src/core/adapters/types.ts:11`

`StackId` 类型增加 `'fullstack'`：

```ts
export type StackId = 'frontend' | 'backend' | 'fullstack';
```

### ✅ 2. 输入校验 — `src/core/init/collectInputs.ts`

- **校验逻辑 (line 52-57)**：将 `'fullstack'` 加入合法值校验
- **prompts 选项 (line 98-107)**：增加 `{ title: 'Fullstack', value: 'fullstack' }` 选项

### ✅ 3. CLI 层 — `src/cli/index.ts:17` 和 `src/cli/commands/init.ts:5-8`

- `index.ts`: `--stack <frontend|backend>` → `--stack <frontend|backend|fullstack>`
- `init.ts`: 错误提示更新为包含 fullstack

### ✅ 4. 默认值 — `src/core/init/runInit.ts:106`

注释更新，默认值保持 `'backend'` 不变（向后兼容）。

### ✅ 5. Zod schema — `src/core/manifest/io.ts:18`

```ts
stack: z.enum(['frontend', 'backend', 'fullstack']).optional(),
```

### ✅ 6. Asset manifest — `src/core/assets/manifest.ts`

新增 `fullstack-schema-bundle` 资源定义：

```ts
{
  id: 'fullstack-schema-bundle',
  kind: 'bundle',
  scope: 'common',
  feature: 'schema',
  stacks: ['fullstack'],
  source: 'templates/common/schemas/fullstack',
  destination: 'openspec/schemas/fullstack',
  includeExtensions: ['.md', '.yaml', '.hbs'],
  templateFiles: [
    'schema.yaml.hbs',
    'proposal.md.hbs',
    'design.md.hbs',
    'spec.md.hbs',
    'tasks.md.hbs',
  ],
  excludePatterns: ['.gitkeep'],
  writePolicy: { appendStrategy: 'simple', appendExtensions: ['.md'] },
  bundleGatedFiles: [],
},
```

`stack-config` 资源无需改动 — 它的 source 已经使用 `config.{{stack}}.yaml.hbs`，当 `stack='fullstack'` 时自动解析为 `config.fullstack.yaml.hbs`。

### ✅ 7. 新建模板文件

#### `templates/common/config/config.fullstack.yaml.hbs`

多 service 结构的全栈配置，包含 `stack:` 段定义 frontend + backend 两个 service：

```yaml
language: {{language}}
schema: fullstack
context: |
  Project: {{projectName}}
  Project Type: Fullstack Application
  Frontend: React 18+, TypeScript, Vite, Vitest + React Testing Library, Playwright (E2E)
  Backend: Java 17+, Spring Boot 3.x, Maven/Gradle, JUnit 5 + Mockito
  Conventions: Monorepo (frontend/ + backend/), API contract-first

stack:
  id: fullstack
  languages: [typescript, java]
  services:
    - name: frontend
      path: frontend
    - name: backend
      path: backend

rules:
  language:
{{#if (isLanguage "zh")}}
    - "所有文档、规格、提案、设计和任务必须使用简体中文编写"
    - "所有代码注释必须使用简体中文编写"
    - "所有 commit message 必须使用简体中文编写"
    - "所有 PR 描述和代码审查评论必须使用简体中文编写"
{{else}}
    - "All documents, specs, proposals, designs, and tasks MUST be written in English"
    - "All code comments MUST be written in English"
    - "All commit messages MUST be written in English"
    - "All PR descriptions and review comments MUST be written in English"
{{/if}}
  proposal:
    - "Must include API contract changes (endpoints, request/response DTOs)"
    - "Must include UI/UX impact analysis for frontend changes"
    - "Must specify database migration strategy (Flyway/Liquibase) for backend changes"
  specs:
    - "Use Given/When/Then format for API behavior scenarios"
    - "Use Given/When/Then format for user interaction scenarios"
  design:
    - "Must include component tree or ERD depending on change scope"
    - "Must specify route design and state management for frontend changes"
    - "Must specify middleware/interceptor chain for backend changes"
```

#### `templates/common/schemas/fullstack/` 目录

复制 frontend/backend schema 的模板结构，创建：
- `schema.yaml.hbs` — `name: {{stack}}`（渲染为 `name: fullstack`），artifact instructions 可复用现有内容
- `templates/proposal.md.hbs` — 分别描述后端、前端改动及影响，明确 API 契约和后端优先交付顺序
- `templates/design.md.hbs` — 分别编制后端与前端设计，明确后端 API 交付后再进入前端实现
- `templates/spec.md.hbs` — 各变更段先编制后端 API requirement，再编制依赖定稿契约的前端 requirement
- `templates/tasks.md.hbs` — 后端实现与验收在前，前端任务依赖后端完成门禁，禁止并行执行

> 注：fullstack 的四类 artifact 模板均使用后端接口驱动前端开发的专用结构，同时保留 OpenSpec 要求的标题和场景格式。

### ✅ 8. 测试更新

#### `test/unit/run-init.test.ts`
- Line 7: 错误信息断言更新为包含 fullstack

#### `test/unit/build-install-plan.test.ts`
- 新增 fullstack 的 stack-config 源文件路径测试
- 新增 fullstack schema bundle 过滤测试

#### `test/integration/init-matrix.test.ts`
- Line 254-271: `it.each` 增加 `'fullstack'` 测试用例
- 验证 `openspec/schemas/fullstack/schema.yaml` 存在
- 验证 `openspec/config.yaml` 包含 `schema: fullstack`
- 验证 manifest 中 `stack` 为 `'fullstack'`

## 需要改动的文件清单

| 操作 | 文件 |
|------|------|
| 修改 | `src/core/adapters/types.ts` |
| 修改 | `src/core/init/collectInputs.ts` |
| 修改 | `src/cli/index.ts` |
| 修改 | `src/cli/commands/init.ts` |
| 修改 | `src/core/init/runInit.ts` |
| 修改 | `src/core/manifest/io.ts` |
| 修改 | `src/core/assets/manifest.ts` |
| 新建 | `templates/common/config/config.fullstack.yaml.hbs` |
| 新建 | `templates/common/schemas/fullstack/schema.yaml.hbs` |
| 新建 | `templates/common/schemas/fullstack/templates/proposal.md.hbs` |
| 新建 | `templates/common/schemas/fullstack/templates/design.md.hbs` |
| 新建 | `templates/common/schemas/fullstack/templates/spec.md.hbs` |
| 新建 | `templates/common/schemas/fullstack/templates/tasks.md.hbs` |
| 修改 | `test/unit/run-init.test.ts` |
| 修改 | `test/unit/build-install-plan.test.ts` |
| 修改 | `test/integration/init-matrix.test.ts` |

## 验证方式

1. **单元测试**：`npx vitest run test/unit/run-init.test.ts test/unit/build-install-plan.test.ts`
2. **集成测试**：`npx vitest run test/integration/init-matrix.test.ts`
3. **手动验证**：`npx tsx src/bin/opsx-dev-pipeline.ts init --tool claude --stack fullstack --yes --dry-run` 检查输出文件列表
4. **全量测试**：`npx vitest run` 确保无回归
