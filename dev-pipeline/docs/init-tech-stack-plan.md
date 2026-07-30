# init 技术栈选择方案

## 背景

当前 dev-pipeline 在 `init` 时支持 3 种项目类型（`backend`/`frontend`/`fullstack`），但每种类型只有一套内置模板。例如 `backend` 固定使用 Java Spring Boot 配置，`frontend` 固定使用 React Vite 配置。

目标：
1. 在 init 时增加更细粒度的技术栈选择（如 backend 下可选 Java Spring Boot、Node.js Express、Python FastAPI）
2. 每个技术栈有自己独立的 config.yaml 模板
3. 率先支持当前内置的 3 种技术栈，并为未来扩展预留基础设施

---

## 实现方案

### ✅ 1. 新增类型定义和 Tech Stack 注册表

#### 1.1 新建 `src/core/tech-stack/types.ts`

```typescript
import type { StackId } from '../adapters/types.js';

// 首批 3 个，后续可按需扩展
export type TechStackId = 'java-spring-boot' | 'react-vite' | 'java-react';

export interface TechStackDefinition {
  id: TechStackId;
  displayName: string;       // 用户可见名称，如 "Java Spring Boot"
  description: string;       // 描述信息
  parentStack: StackId;      // 所属的顶层 stack 类型
}
```

#### 1.2 新建 `src/core/tech-stack/registry.ts`

```typescript
import type { StackId } from '../adapters/types.js';
import type { TechStackDefinition, TechStackId } from './types.js';

export const TECH_STACK_REGISTRY: TechStackDefinition[] = [
  {
    id: 'java-spring-boot',
    displayName: 'Java Spring Boot',
    description: 'Java 17+, Spring Boot 3.x, Maven/Gradle, MyBatis-Plus/JPA/JOOQ',
    parentStack: 'backend',
  },
  {
    id: 'react-vite',
    displayName: 'React + Vite',
    description: 'React 18+, TypeScript, Vite, Vitest + React Testing Library',
    parentStack: 'frontend',
  },
  {
    id: 'java-react',
    displayName: 'Java Spring Boot + React',
    description: 'Monorepo: React 18+ frontend + Java Spring Boot backend',
    parentStack: 'fullstack',
  },
];

export function getTechStacksByParentStack(parentStack: StackId): TechStackDefinition[] {
  return TECH_STACK_REGISTRY.filter((ts) => ts.parentStack === parentStack);
}

export function getTechStackById(id: string): TechStackDefinition | undefined {
  return TECH_STACK_REGISTRY.find((ts) => ts.id === id);
}

export function resolveTechStackId(value: string): TechStackId {
  const def = getTechStackById(value);
  if (!def) {
    throw new Error(
      `Invalid tech stack: ${value}. Valid: ${TECH_STACK_REGISTRY.map((ts) => ts.id).join(', ')}.`,
    );
  }
  return def.id;
}
```

---

### ✅ 2. 类型系统扩展

#### 2.1 `src/core/adapters/types.ts`

无需修改 `StackId` 类型，`TechStackId` 定义在独立的 `tech-stack/types.ts` 中。

#### 2.2 `src/core/prompts/types.ts`

```diff
+import type { TechStackId } from '../tech-stack/types.js';

 export interface InitOptions {
   dir?: string;
   dryRun?: boolean;
   force?: boolean;
   tool?: ToolId;
   stack?: StackId;
+  techStack?: string;
   language?: DocLanguage;
   yes?: boolean;
   feature?: string | string[];
 }

 export interface InitAnswers {
   projectName: string;
   tool: ToolId;
   stack: StackId;
+  techStack?: TechStackId;
   language: DocLanguage;
   features: FeatureId[];
 }
```

#### 2.3 `src/core/init/types.ts`

```diff
+import type { TechStackId } from '../tech-stack/types.js';

 export interface InstallPlan {
   projectName: string;
   tool: ToolId;
   stack?: StackId;
+  techStack?: TechStackId;
   language: DocLanguage;
   features: FeatureId[];
   adapter: ToolAdapter;
   files: InstallFile[];
   targetDir: string;
   dryRun: boolean;
   force: boolean;
   mode: InstallMode;
 }
```

#### 2.4 `src/core/init/buildInstallPlan.ts`

```diff
+import type { TechStackId } from '../tech-stack/types.js';
+import { getTechStackById } from '../tech-stack/registry.js';

 export interface BuildInstallPlanInput {
   rootDir: string;
   targetDir: string;
   projectName: string;
   tool: ToolId;
   stack?: StackId;
+  techStack?: TechStackId;
   language?: DocLanguage;
   features: FeatureId[];
   dryRun: boolean;
   force: boolean;
   mode: 'init' | 'sync' | 'upgrade';
   languageConfigUpdate?: boolean;
   managedAssets?: ManagedAssetRecord[];
   registry: Parameters<typeof getToolAdapter>[0];
 }
```

`buildTemplateContext` 新增参数：

```diff
 export function buildTemplateContext(params: {
   projectName: string;
   toolId: ToolId;
   toolName: string;
   stack: StackId;
   language: DocLanguage;
   features: FeatureId[];
   skillsDir: string;
   commandsDir: string;
   skillRootNote?: string;
+  techStack?: TechStackId;
+  techStackName?: string;
 }): Record<string, unknown> {
   return {
     projectName: params.projectName,
     toolId: params.toolId,
     toolName: params.toolName,
     stack: params.stack,
     language: params.language,
     packageName: PACKAGE_NAME,
     skillsDir: params.skillsDir,
     commandsDir: params.commandsDir,
     features: params.features,
+    techStack: params.techStack,
+    techStackName: params.techStackName,
     templateVersion: TEMPLATE_VERSION,
     packageVersion: PACKAGE_VERSION,
     // ...
   };
 }
```

#### 2.5 `src/core/manifest/types.ts`

```diff
+import type { TechStackId } from '../tech-stack/types.js';

 export interface PipelineManifest {
   schemaVersion: number;
   projectName: string;
   tool: ToolId;
   stack?: StackId;
+  techStack?: string;
   language?: DocLanguage;
   features: FeatureId[];
   templateVersion: string;
   packageName: string;
   managedAssets: ManagedAssetRecord[];
 }
```

#### 2.6 `src/core/manifest/io.ts`

```diff
 const manifestSchema = z.object({
   schemaVersion: z.number().default(1),
   projectName: z.string(),
   tool: z.enum(['claude', 'cursor', 'codex']),
   stack: z.enum(['frontend', 'backend', 'fullstack']).optional(),
+  techStack: z.string().optional(),
   language: z.enum(['en', 'zh']).optional(),
   features: z.array(z.enum(['base', 'skills', 'commands', 'docs', 'schema'])),
   templateVersion: z.string().default(TEMPLATE_VERSION),
   packageName: z.string().default(PACKAGE_NAME),
   managedAssets: z.array(...).default([]),
 });
```

---

### ✅ 3. CLI 接口

#### 3.1 `src/cli/index.ts`

```diff
 cli
   .command('init', 'Initialize opsx-dev-pipeline templates in the current directory')
   .option('--tool <tool>', 'Target AI tool id')
   .option('--stack <frontend|backend|fullstack>', 'Target project stack')
+  .option('--tech-stack <tech-stack>', 'Target tech stack (e.g. java-spring-boot, react-vite)')
   .option('--lang <en|zh>', 'Document language for AI-generated artifacts (default: zh)')
   // ...
```

#### 3.2 `src/cli/commands/init.ts`

```diff
 export async function runInitCommand(options: Record<string, unknown>): Promise<void> {
   if (options.yes && !options.stack) {
     throw new Error(
       'Missing required --stack in non-interactive mode. Use --stack frontend, --stack backend, or --stack fullstack.',
     );
   }
+  // --tech-stack is optional even in --yes mode
   await runInit(options as InitOptions);
 }
```

---

### ✅ 4. 交互式提示

#### 4.1 `src/core/init/collectInputs.ts`

在 stack 选择之后，增加 tech stack 选择提示。核心逻辑：

```typescript
import { getTechStacksByParentStack, resolveTechStackId } from '../tech-stack/registry.js';
import type { TechStackId } from '../tech-stack/types.js';

// 在 stack 选择 prompt 之后，插入 tech stack prompt:
const availableTechStacks = getTechStacksByParentStack(stack);
if (availableTechStacks.length > 0) {
  // 交互式: 显示选择列表
  // --yes: 如果提供了 --tech-stack，校验并使用；否则跳过
}
```

交互式 prompt 格式：
```typescript
{
  type: 'select',
  name: 'techStack',
  message: 'Select your tech stack',
  choices: availableTechStacks.map((ts) => ({
    title: ts.displayName,
    description: ts.description,
    value: ts.id,
  })),
}
```

校验逻辑：
- 如果 `--tech-stack` 提供了值，调用 `resolveTechStackId()` 校验
- 校验失败时抛出错误，列出所有有效值
- 如果 `--tech-stack` 未提供，techStack 为 `undefined`（使用通用模板）

---

### ✅ 5. 模板解析

#### 5.1 `src/core/init/buildInstallPlan.ts` - 核心改动

在 `buildInstallPlan` 函数中，解析 `stack-config` 资产时增加 tech stack 模板回退逻辑：

```typescript
// 在 expandedFiles 的 map 中，针对 stack-config 资产：
if (asset.id === 'stack-config' && input.techStack) {
  const techStackSource = path.join(
    input.rootDir,
    renderString(
      `templates/common/config/config.{{stack}}.{{techStack}}.yaml.hbs`,
      templateContext,
    ),
  );
  // 如果 tech stack 特定模板存在，使用它；否则回退到通用模板
  if (await fs.pathExists(techStackSource)) {
    renderedSource = techStackSource;
  }
  // 否则使用原有的 config.{{stack}}.yaml.hbs（已在 renderedSource 中）
}
```

**templateContext 新增字段**:
- `techStack`: tech stack ID (如 `'java-spring-boot'`)
- `techStackName`: tech stack 显示名称 (如 `'Java Spring Boot'`)

#### 5.2 `src/core/init/runInit.ts`

```diff
 const plan = await buildInstallPlan({
   rootDir,
   targetDir,
   projectName: answers.projectName,
   tool: answers.tool,
   stack: answers.stack,
+  techStack: answers.techStack,
   language: answers.language,
   features: answers.features,
   dryRun: Boolean(options.dryRun),
   force: Boolean(options.force),
   mode: 'init',
   registry,
 });
```

---

### ✅ 6. 模板文件

#### 6.1 新建 3 个 tech stack 特定模板

| 文件 | 内容 |
|------|------|
| `templates/common/config/config.backend.java-spring-boot.yaml.hbs` | Java Spring Boot 配置，与现有 `config.backend.yaml.hbs` 内容相同 |
| `templates/common/config/config.frontend.react-vite.yaml.hbs` | React Vite 配置，与现有 `config.frontend.yaml.hbs` 内容相同 |
| `templates/common/config/config.fullstack.java-react.yaml.hbs` | Java + React 配置，与现有 `config.fullstack.yaml.hbs` 内容相同 |

**注意**: 现有的 `config.backend.yaml.hbs`、`config.frontend.yaml.hbs`、`config.fullstack.yaml.hbs` 保留作为通用回退模板。当用户不指定 `--tech-stack` 时使用这些通用模板。

模板文件中的 `context:` 块可以引用 `{{techStackName}}` 变量来动态输出技术栈名称。

---

### ✅ 7. Manifest 持久化

#### 7.1 `src/core/init/executeInstallPlan.ts`

```diff
 await writeManifest(plan.targetDir, {
   schemaVersion: 1,
   projectName: plan.projectName,
   tool: plan.tool,
   stack: plan.stack,
+  techStack: plan.techStack,
   language: plan.language,
   features: plan.features,
   templateVersion: TEMPLATE_VERSION,
   packageName: PACKAGE_NAME,
   managedAssets: context.managedAssets,
 });
```

---

### ✅ 8. 同步和升级兼容性

#### 8.1 `src/core/sync/` 和 `src/core/upgrade/`

- 从 manifest 读取 `techStack` 并传递给 `buildInstallPlan`
- 如果 manifest 中无 `techStack`（旧项目），`techStack` 为 `undefined`，使用通用模板
- 无需修改现有代码，因为 `techStack` 已是 optional 字段

---

## 修改文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/core/tech-stack/types.ts` | **新建** | TechStackId 类型和 TechStackDefinition 接口 |
| `src/core/tech-stack/registry.ts` | **新建** | 技术栈注册表，3 个初始定义 |
| `src/core/adapters/types.ts` | 不变 | StackId 保持不变 |
| `src/core/prompts/types.ts` | 修改 | InitOptions/InitAnswers 新增 techStack 字段 |
| `src/core/init/types.ts` | 修改 | InstallPlan 新增 techStack 字段 |
| `src/core/init/collectInputs.ts` | 修改 | 新增 tech stack 交互式选择提示 + 校验 |
| `src/core/init/buildInstallPlan.ts` | 修改 | templateContext 扩展 + 模板回退逻辑 |
| `src/core/init/runInit.ts` | 修改 | 传递 answers.techStack 到 buildInstallPlan |
| `src/core/init/executeInstallPlan.ts` | 修改 | 传递 plan.techStack 到 writeManifest |
| `src/core/manifest/types.ts` | 修改 | PipelineManifest 新增 techStack 字段 |
| `src/core/manifest/io.ts` | 修改 | Zod schema 新增 techStack 字段 |
| `src/cli/index.ts` | 修改 | init 命令新增 --tech-stack 选项 |
| `src/cli/commands/init.ts` | 修改 | 透传 options.techStack |
| `templates/common/config/config.backend.java-spring-boot.yaml.hbs` | **新建** | Backend Java Spring Boot 模板 |
| `templates/common/config/config.frontend.react-vite.yaml.hbs` | **新建** | Frontend React Vite 模板 |
| `templates/common/config/config.fullstack.java-react.yaml.hbs` | **新建** | Fullstack Java React 模板 |

---

## 数据流

```
CLI (--stack backend --tech-stack java-spring-boot)
  → runInitCommand (init.ts)
    → runInit (runInit.ts)
      → collectInputs
        → 选择 stack: backend
        → 根据 stack 过滤 tech stack 选项列表
        → 选择 tech stack: java-spring-boot
      → buildInstallPlan
        → 计算 stack-config 的 source 路径
        → 尝试: config.backend.java-spring-boot.yaml.hbs ✓ (存在)
        → templateContext 包含 techStack='java-spring-boot', techStackName='Java Spring Boot'
      → resolveInstallConflicts
      → executeInstallPlan
        → 渲染模板 → 写入 openspec/config.yaml
        → 写入 manifest (含 techStack: "java-spring-boot")


CLI (--stack backend --yes)  // 无 --tech-stack
  → ...
      → buildInstallPlan
        → 计算 stack-config 的 source 路径
        → techStack 为 undefined，跳过 tech stack 特定模板查找
        → 使用: config.backend.yaml.hbs（通用模板）
        → templateContext 中 techStack 和 techStackName 为 undefined
```

---

## 向后兼容性

1. `techStack` 在所有接口中都是 optional 的 (`techStack?: ...`)
2. 不指定 `--tech-stack` 的行为与当前完全一致（使用通用模板）
3. 在 `--yes` 模式下 `--tech-stack` 不是必需的
4. 旧项目的 manifest 中无 `techStack` 字段，Zod 解析时作为 optional 字段不会报错
5. 同步/升级时，如果 manifest 中无 `techStack`，使用通用模板

---

## 验证方案

1. **单元测试**: 验证 `collectInputs` 中 tech stack 的校验和过滤逻辑
2. **集成测试**:
   - 测试 `init --stack backend --tech-stack java-spring-boot --yes --dry-run` 使用正确的模板
   - 测试 `init --stack backend --yes`（无 tech stack）使用通用模板
   - 测试 `init --stack backend --tech-stack invalid --yes` 抛出错误
   - 测试 manifest 中正确保存 techStack 字段
3. **手动验证**:
   - 运行 `init` 交互式流程，确认 tech stack 选项显示正确
   - 确认生成的 config.yaml 内容与所选 tech stack 匹配
   - 确认 `sync`/`upgrade` 在旧项目上正常工作
