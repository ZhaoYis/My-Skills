# 安装流水线时添加文档语言选择

## 背景与动机

当前 `opsx-dev-pipeline init` 在安装时会询问用户：项目名称、AI 工具（Claude/Cursor/Codex）、项目栈（Frontend/Backend）。安装后生成的 `openspec/config.yaml` 包含 `context` 和 `rules` 字段，指导 AI 如何理解项目并生成文档。

**问题**：没有全局的语言设置。AI 生成的文档（提案、设计、规格、任务等）语言不统一，有时中文有时英文，取决于 prompt 和上下文。

**目标**：在 `init` 时增加语言选择（中文/英文），写入 `config.yaml` 作为全局配置，后续 AI 在生成所有文档时自动使用指定语言。

---

## 设计方案

### 语言选项

- `zh` — 中文
- `en` — English

### 数据流

```
用户选择语言 → InitAnswers.language → templateContext.language → config.yaml
                                                                  → SKILL.md (语言指令)
```

### 语言如何生效

`config.yaml` 是 AI 工作时的项目上下文文件。在其中新增 `language` 字段和对应的 `context` 描述，AI 读取后自动遵循。同时 SKILL.md 中添加指令，确保流水线各阶段生成的文档也遵循该语言设置。

---

## 实施步骤

### Step 1: 添加类型定义

**文件**: `src/core/adapters/types.ts`

- 新增 `DocLanguage` 类型: `'en' | 'zh'`

```typescript
export type DocLanguage = 'en' | 'zh';
```

**文件**: `src/core/prompts/types.ts`

- `InitOptions` 新增 `language?: DocLanguage`
- `InitAnswers` 新增 `language: DocLanguage`

### Step 2: 添加交互式提示

**文件**: `src/core/init/collectInputs.ts`

- 在 stack 选择之后，新增 language 选择 prompt:

```typescript
{
  type: 'select',
  name: 'language',
  message: 'Select document language / 选择文档语言',
  choices: [
    { title: 'English', value: 'en' },
    { title: '中文 (Chinese)', value: 'zh' },
  ],
}
```

- 在 `--yes` 非交互模式下，默认使用 `en`（或通过 `--lang` 指定）
- 返回值中加入 `language`

### Step 3: 添加 CLI 选项

**文件**: `src/cli/index.ts`

- `init` 命令新增 `--lang <en|zh>` 选项

```typescript
.option('--lang <en|zh>', 'Document language for AI-generated artifacts')
```

**文件**: `src/cli/commands/init.ts`

- 无需修改（已透传所有 options）

### Step 4: 传递 language 到模板上下文

**文件**: `src/core/init/buildInstallPlan.ts`

- `templateContext` 中新增 `language` 字段

```typescript
const templateContext = {
  // ... existing fields
  language: input.language,
};
```

**文件**: `src/core/init/runInit.ts`

- 确保 `answers.language` 传递到 `buildInstallPlan`

### Step 5: 更新 config.yaml 模板

**文件**: `templates/common/config/config.frontend.yaml.hbs`

```yaml
language: {{language}}
schema: frontend
context: |
  Project: {{projectName}}
  Project Type: Frontend Application
  Document Language: {{language}}
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

**文件**: `templates/common/config/config.backend.yaml.hbs`

```yaml
language: {{language}}
schema: backend
context: |
  Project: {{projectName}}
  Project Type: Backend Service
  Document Language: {{language}}
  Tech Stack: Java 17+, Spring Boot 3.x, Maven/Gradle
  ORM: MyBatis-Plus / JPA / JOOQ
  Testing: JUnit 5 + Mockito + Spring Boot Test + Testcontainers
  Conventions: Layered architecture (Controller -> Service -> Repository), DTO pattern
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

### Step 6: 更新 SKILL.md 模板

**文件**: `templates/common/skills/opsx-dev-pipeline/SKILL.md.hbs`

- 在执行约束中新增一条:

```
- 所有生成的文档制品（proposal、design、spec、tasks、review report）必须使用 `openspec/config.yaml` 中 `language` 字段指定的语言。若 `language: zh` 则全部使用中文；若 `language: en` 则全部使用 English。
```

### Step 7: 更新 phase reference 文件（可选增强）

**文件**: `templates/common/skills/opsx-dev-pipeline/references/phase-1-propose.md`

- 在 Step4 制品生成说明中加入语言约束提示

> **注**: Phase reference 目前只有中文版。完整的双语支持（根据 language 选择不同版本的 reference）可以后续迭代。当前方案优先确保 AI **输出** 文档的语言统一。

---

## 涉及的完整文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/core/adapters/types.ts` | 修改 | 新增 `DocLanguage` 类型 |
| `src/core/prompts/types.ts` | 修改 | `InitOptions`/`InitAnswers` 加 `language` |
| `src/core/init/collectInputs.ts` | 修改 | 新增语言选择 prompt |
| `src/cli/index.ts` | 修改 | 新增 `--lang` CLI 选项 |
| `src/core/init/buildInstallPlan.ts` | 修改 | `templateContext` 加 `language` |
| `src/core/init/runInit.ts` | 修改 | 传递 `language` 到 install plan |
| `templates/common/config/config.frontend.yaml.hbs` | 修改 | 新增 `language` 字段 |
| `templates/common/config/config.backend.yaml.hbs` | 修改 | 新增 `language` 字段 |
| `templates/common/skills/opsx-dev-pipeline/SKILL.md.hbs` | 修改 | 新增语言约束指令 |

---

## 验证方案

1. **构建**: `npm run build`
2. **交互式安装测试**: 在 `test-space/` 下创建新目录，运行 `opsx-dev-pipeline init`，选择中文:
   - 验证 `openspec/config.yaml` 包含 `language: zh`
   - 验证 `context` 中包含 `Document Language: zh`
3. **非交互式安装测试**: `opsx-dev-pipeline init --yes --stack frontend --lang zh`
   - 验证生成的 config.yaml 正确
4. **AI 行为验证**: 在安装后的项目中运行 `/opsx-dev-pipeline` 创建一个 change
   - 确认生成的 proposal/design/spec/tasks 使用了指定语言
5. **回归测试**: 确保未指定 `--lang` 的交互式安装正常工作（默认 English）
6. **现有测试**: `npm test` 全部通过

---

## 未来扩展

- Phase reference 文件双语化（根据 `language` 生成不同语言的 reference）
- Schema 模板双语化（proposal/design/spec/tasks 的 section headers 随语言切换）
- 支持更多语言（日语 `ja`、韩语 `ko` 等）
