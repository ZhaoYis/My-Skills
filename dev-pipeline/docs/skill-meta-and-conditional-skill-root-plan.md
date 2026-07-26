# 方案：opsx-dev-pipeline Skill 标准 Meta 信息 + 条件化 SKILL_ROOT

## Context

当前 `opsx-dev-pipeline` 内置 skill (`SKILL.md.hbs`) 存在两个不足：

1. **缺少包元信息**：生成的 SKILL.md 仅有 `name` 和 `description` 两个 YAML 头信息字段，没有版本号、开源协议、仓库地址等标准元信息（版权声明），不利于用户了解技能来源和版本。

2. **SKILL_ROOT 列出所有工具路径**：模板中硬编码了全部三种 AI 工具（Claude Code、Cursor、Codex）的安装路径，而非根据用户初始化时选择的工具只呈现对应路径。用户看到三条路径会困惑"哪个才是我的?"。

用户初始化时已通过交互式提示选择了工具（`toolId`），该信息已存在于模板上下文中，但 SKILL.md.hbs 完全没有使用 Handlebars 变量。需要让模板利用已有上下文动态生成内容。

## 涉及文件

| 文件 | 修改类型 |
|------|----------|
| `package.json` | 新增 `author` 字段 |
| `src/core/runtime/meta.ts` | 新增导出 `PACKAGE_AUTHOR`、`PACKAGE_LICENSE`、`PACKAGE_REPO_URL` |
| `src/core/adapters/types.ts` | `ToolDefinition` 新增可选字段 `skillRootNote` |
| `src/core/adapters/registry.ts` | Zod schema 和 `StaticToolAdapter` 支持 `skillRootNote` |
| `src/core/init/buildInstallPlan.ts` | 抽取 `buildTemplateContext()` 共享函数；模板上下文新增 meta 字段和 `skillRootNote` |
| `src/core/init/executeInstallPlan.ts` | 调用共享函数替代手写上下文 |
| `templates/common/skills/opsx-dev-pipeline/SKILL.md.hbs` | 头信息增加 meta 字段 + SKILL_ROOT 用通用表述 |

## 设计决策（经 Grilling 确认）

| 决策 | 结论 |
|------|------|
| Meta 位置 | YAML 头信息（版权声明） |
| `repository` 字段 | 不加 `{{#if}}`——`package.json` 必定存在 |
| Handlebars 空白控制 | 条件块使用右侧 `~` 标记，移除控制行换行但保留内容行边界 |
| SKILL_ROOT 工具表述 | 通用表述 `{{toolName}}` + `{{skillsDir}}`，不按 toolId 分支 |
| 工具定制表述 | `ToolDefinition` 新增可选 `skillRootNote`，未来新工具可直接在 `tools.json` 配置 |
| Codex 特殊入口说明 | 砍掉（冗余） |
| 后备行 | 保留 |
| 模板上下文重复 | 抽取共享函数 `buildTemplateContext()` |
| test-space 产物 | 暂不更新，后续升级工具替换 |

## 实现步骤

### ✅ Step 1: 在 package.json 添加 author 字段

```json
"author": "ZhaoYis",
```

### ✅ Step 2: 扩展 `src/core/runtime/meta.ts` 导出

```typescript
export const PACKAGE_AUTHOR = (packageJson as Record<string, unknown>).author as string | undefined;
export const PACKAGE_LICENSE = (packageJson as Record<string, unknown>).license as string | undefined;
export const PACKAGE_REPO_URL = (
  (packageJson as Record<string, unknown>).repository as Record<string, unknown> | undefined
)?.url as string | undefined;
```

`| undefined` 保证缺失字段时模板优雅降级。

### ✅ Step 3: `ToolDefinition` 新增 `skillRootNote`

**`src/core/adapters/types.ts`**：
```typescript
export interface ToolDefinition {
  // ...existing fields...
  /** 可选：自定义 SKILL_ROOT 路径说明。支持 `{skillsDir}` 占位符。不提供时使用默认通用表述。 */
  skillRootNote?: string;
}
```

**`src/core/adapters/registry.ts`**：
- Zod schema 新增 `skillRootNote: z.string().optional()`
- `StaticToolAdapter` 新增方法：
  ```typescript
  getSkillRootNote(): string | undefined {
    return this.definition.skillRootNote;
  }
  ```

**`config/tools.json`**：当前所有工具均不添加 `skillRootNote`（全部走默认通用表述）。字段留作未来扩展。

### ✅ Step 4: 抽取共享函数 `buildTemplateContext()`

**`src/core/init/buildInstallPlan.ts`** 中新增导出函数：

```typescript
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
    templateVersion: TEMPLATE_VERSION,
    packageVersion: PACKAGE_VERSION,
    packageLicense: PACKAGE_LICENSE,
    packageRepoUrl: PACKAGE_REPO_URL,
    skillRootNote: params.skillRootNote?.replaceAll('{skillsDir}', params.skillsDir),
  };
}
```

**`executeInstallPlan.ts`** 修改为调用此函数，删除手写对象字面量。

### ✅ Step 5: 修改 SKILL.md.hbs 模板

#### 5a: YAML 头信息增加 meta 字段

```yaml
---
name: opsx-dev-pipeline
description: 执行基于 OpenSpec 和 Git 的门禁式需求开发与交付流程...
version: "{{~packageVersion~}}"
license: "{{~packageLicense~}}"
repository: "{{~packageRepoUrl~}}"
---
```

`~` 去除 Handlebars 默认空白，确保 YAML 紧凑、无多余空行。所有值加引号防止类型误解析。

#### 5b: SKILL_ROOT 条件化

```handlebars
**`<SKILL_ROOT>`**：本技能安装根目录（内含 `scripts/`）。命令在目标 git 仓库根目录执行。
{{#if skillRootNote~}}
{{{skillRootNote}}}
{{else~}}
- 对于 {{toolName}} 安装：`<SKILL_ROOT>` = `{{skillsDir}}/opsx-dev-pipeline`
{{/if~}}
- 若宿主将 Skill 安装到其他位置，`<SKILL_ROOT>` = 当前 `SKILL.md` 所在目录；不要假设当前工作目录就是 Skill 根目录。
- 脚本路径示例：`node {{skillsDir}}/opsx-dev-pipeline/scripts/preflight.mjs`
- 引用前先确认目录存在：`test -d "<SKILL_ROOT>/scripts" || echo "scripts not found"`
- 状态命令示例：`node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs get "<change>"`
```

要点：
- 默认走一行通用表述（`toolName` + `skillsDir`），自动适配所有现有及未来工具
- 如工具定义有 `skillRootNote`，则渲染定制内容（支持 `{skillsDir}` 占位符需在上下文中做替换）
- Codex 特殊入口说明已砍掉
- 后备行始终保留
- 条件块使用右侧 `~` 空白控制，避免产生空行或把 Markdown 列表行拼接在一起

## 验证方案

1. ✅ **编译检查**：`npm run build && npm run typecheck`
2. ✅ **单元测试**：`npm test`
3. ✅ **Dry-run 三工具**：
   ```bash
   npm run dev -- init --tool claude --stack backend --yes --dry-run
   npm run dev -- init --tool cursor --stack backend --yes --dry-run
   npm run dev -- init --tool codex --stack backend --yes --dry-run
   ```
4. ✅ **实际渲染验证**：
   ```bash
   npm run dev -- init --tool claude --stack backend --yes --dir /tmp/test-init
   cat /tmp/test-init/.claude/skills/opsx-dev-pipeline/SKILL.md
   # 检查：头信息有 version/license/repository；SKILL_ROOT 只显示 Claude 路径
   ```

## 兼容性

- 模板上下文结构变化通过共享函数 `buildTemplateContext()` 统一管理，未来修改只改一处
- 不消费新变量的模板不受影响
- 交互模式和 `--yes` 模式均已覆盖
- sync/upgrade 模式也会正确应用条件逻辑
- 新工具无需修改模板，只需在 `tools.json` 配置
