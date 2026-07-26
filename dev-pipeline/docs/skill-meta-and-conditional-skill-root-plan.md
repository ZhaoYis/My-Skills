# 方案：opsx-dev-pipeline Skill 标准 Meta 信息 + 条件化 SKILL_ROOT

## Context

当前 `opsx-dev-pipeline` 内置 skill (`SKILL.md.hbs`) 存在两个不足：

1. **缺少包元信息**：生成的 SKILL.md 仅有 `name` 和 `description` 两个 YAML 头信息字段，没有版本号、开源协议、仓库地址、作者等标准元信息，不利于用户了解技能来源和版本。

2. **SKILL_ROOT 列出所有工具路径**：模板中硬编码了全部三种 AI 工具（Claude Code、Cursor、Codex）的安装路径，而非根据用户初始化时选择的工具只呈现对应路径。用户看到三条路径会困惑"哪个才是我的?"。

用户初始化时已通过交互式提示选择了工具（`toolId`），该信息已存在于模板上下文中，但 SKILL.md.hbs 完全没有使用 Handlebars 变量。需要让模板利用已有上下文动态生成内容。

## 涉及文件

| 文件 | 修改类型 |
|------|----------|
| `package.json` | 新增 `author` 字段 |
| `src/core/runtime/meta.ts` | 新增导出 `PACKAGE_AUTHOR`、`PACKAGE_LICENSE`、`PACKAGE_REPO_URL` |
| `src/core/init/renderTemplates.ts` | 新增 `isTool` Handlebars helper |
| `src/core/init/buildInstallPlan.ts` | 模板上下文新增 meta 字段 |
| `src/core/init/executeInstallPlan.ts` | 模板上下文新增 meta 字段 |
| `templates/common/skills/opsx-dev-pipeline/SKILL.md.hbs` | 头信息增加 meta 字段 + SKILL_ROOT 条件化 |
| `test/unit/build-install-plan.test.ts` | 新增条件渲染测试 |

## 实现步骤

### Step 1: 在 package.json 添加 author 字段

```json
"author": "ZhaoYis",
```

位置在 `"version": "0.2.1"` 之后、`"description"` 之后均可。

### Step 2: 扩展 `src/core/runtime/meta.ts` 导出

利用已有的 `packageJson` require 对象，新增三个导出：

```typescript
export const PACKAGE_AUTHOR = (packageJson as Record<string, unknown>).author as string | undefined;
export const PACKAGE_LICENSE = (packageJson as Record<string, unknown>).license as string | undefined;
export const PACKAGE_REPO_URL = (
  (packageJson as Record<string, unknown>).repository as Record<string, unknown> | undefined
)?.url as string | undefined;
```

模式与现有 `PACKAGE_VERSION` 完全一致。`| undefined` 确保缺失字段时模板优雅降级。

### Step 3: 新增 `isTool` Handlebars Helper

文件：`src/core/init/renderTemplates.ts`

在 `ensureHandlebarsHelpers()` 中注册，与 `isLanguage` 模式完全一致：

```typescript
Handlebars.registerHelper(
  'isTool',
  function isTool(this: { toolId?: ToolId }, toolId: ToolId) {
    return this.toolId === toolId;
  },
);
```

需在文件头部 import 中新增 `ToolId` 类型。

### Step 4: 扩展两处模板上下文

**`buildInstallPlan.ts`** (第 192–203 行的 `templateContext`) 和 **`executeInstallPlan.ts`** (第 141–153 行的 `context`) 各新增三个字段：

```typescript
packageVersion: PACKAGE_VERSION,
packageLicense: PACKAGE_LICENSE,
packageRepoUrl: PACKAGE_REPO_URL,
```

两处的 import 语句同步更新，从 `../runtime/meta.js` 导入新增常量。

### Step 5: 修改 SKILL.md.hbs 模板

#### 5a: YAML 头信息增加 meta 字段

```yaml
---
name: opsx-dev-pipeline
description: 执行基于 OpenSpec 和 Git 的门禁式需求开发与交付流程...
version: "{{packageVersion}}"
license: "{{packageLicense}}"
{{#if packageRepoUrl}}repository: "{{packageRepoUrl}}"
{{/if}}
---
```

> **注意**：YAML 值加引号防止特殊字符解析问题。`repository` 用 `{{#if}}` 包裹，因为 URL 可能包含冒号需要引号且字段可选。

#### 5b: SKILL_ROOT 条件化

将第 26–33 行替换为：

```handlebars
**`<SKILL_ROOT>`**：本技能安装根目录（内含 `scripts/`）。命令在目标 git 仓库根目录执行。
{{#if (isTool "claude")}}- 对于 Claude Code 安装：`<SKILL_ROOT>` = `{{skillsDir}}/opsx-dev-pipeline`
{{/if}}{{#if (isTool "cursor")}}- 对于 Cursor 安装：`<SKILL_ROOT>` = `{{skillsDir}}/opsx-dev-pipeline`
{{/if}}{{#if (isTool "codex")}}- 对于 Codex 模板安装：`<SKILL_ROOT>` = `{{skillsDir}}/opsx-dev-pipeline`；通过 `{{skillsDir}}/opsx-dev-pipeline.md` 入口加载本文件。
{{/if}}- 若宿主将 Skill 安装到其他位置，`<SKILL_ROOT>` = 当前 `SKILL.md` 所在目录；不要假设当前工作目录就是 Skill 根目录。
- 脚本路径示例：`node {{skillsDir}}/opsx-dev-pipeline/scripts/preflight.mjs`
- 引用前先确认目录存在：`test -d "<SKILL_ROOT>/scripts" || echo "scripts not found"`
- 状态命令示例：`node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs get "<change>"`
```

要点：
- 每个工具的路径行用 `{{#if (isTool "...")}}` 包裹，只有选中的工具会渲染
- 硬编码路径（`.claude/skills`、`.cursor/rules`、`.codex/prompts`）替换为 `{{skillsDir}}`
- Codex 保留特殊的"入口加载"说明
- 通用后备行（"若宿主将 Skill 安装到其他位置"）始终保留
- `{{#if}}...{{/if}}` 块之间无换行，确保输出紧凑无多余空行

### Step 6: 更新测试

在 `test/unit/build-install-plan.test.ts` 中新增参数化测试，对 Claude/Cursor/Codex 三个工具分别验证：
- 渲染后的 SKILL.md 只包含选中工具的路径
- 不包含其他工具的路径
- 包含 meta 信息（版本、协议）
- 包含通用后备行

## 验证方案

1. **编译检查**：`npm run build && npm run typecheck`
2. **单元测试**：`npm test`
3. **Dry-run 三工具**：
   ```bash
   npm run dev -- init --tool claude --stack backend --yes --dry-run
   npm run dev -- init --tool cursor --stack backend --yes --dry-run
   npm run dev -- init --tool codex --stack backend --yes --dry-run
   ```
4. **实际渲染验证**：
   ```bash
   npm run dev -- init --tool claude --stack backend --yes --dir /tmp/test-init
   cat /tmp/test-init/.claude/skills/opsx-dev-pipeline/SKILL.md
   # 检查：头信息有 version/license/repository；SKILL_ROOT 只显示 Claude 路径
   ```
5. **交互模式验证**：运行 `npm run dev -- init`，选择不同工具，确认生成结果正确

## 兼容性

- 模板上下文纯增量（新增字段），不修改现有字段
- `isTool` helper 注册是幂等的（`helpersRegistered` 守卫）
- 不消费新变量的模板不受影响
- 交互模式和 `--yes` 模式均已覆盖（`toolId` 始终在上下文中）
- sync/upgrade 模式也会正确应用条件逻辑
