# /opsx:dev-spec-design 系统分析与设计文档生成器 — 设计方案

## Context

用户需要在 opsx-dev-pipeline 中增加一个新命令 `/opsx:dev-spec-design`，用于根据模板生成系统分析与设计文档（精简版）。这需要同时支持：
- **独立使用**：用户随时调用生成系分文档
- **Pipeline 集成**：在流水线 Phase 1 提案阶段可被引用，感知当前 change 上下文

模板使用 `docs/templates/system-analysis-design-template-lite.md`（精简版，264行），输出到 `openspec/docs/<yyyyMMdd>/<spec-design-name>.md`。

## 设计方案概述

采用 **Skill 技能包 + 斜杠命令** 的组合模式，与现有的 `grill-me`/`grilling` 技能包模式一致：

- **Skill 技能包**：`templates/common/skills/dev-spec-design/` — 包含 SKILL.md、模板引用和 openai.yaml
- **斜杠命令**：`templates/common/commands/opsx/dev-spec-design.md.hbs` — 薄包装，加载技能并处理 pipeline 状态感知
- **Asset 注册**：在 `src/core/assets/manifest.ts` 中注册两个新 asset

## ✅ Step 1: 创建 Skill 技能包

### ✅ 1a. `templates/common/skills/dev-spec-design/SKILL.md.hbs`

技能定义，核心内容包括：

1. **YAML frontmatter**：name、description（`allowed-tools` 由斜杠命令层声明）
2. **Input**：用户的需求描述（功能点、业务场景、约束条件）
3. **工作流程**：
   - **Step 1 需求收集**：询问项目名称、系统/模块、需求描述、功能列表、约束条件
   - **Step 2 Pipeline 上下文感知（可选）**：检查 `openspec list --json`，如有活跃 change 展示关联信息，只读不修改状态
   - **Step 3 文档生成**：读取 `<SKILL_ROOT>/references/system-analysis-design-template-lite.md`，按模板逐章节生成
   - **Step 4 输出**：保存到 `openspec/docs/<yyyyMMdd>/<kebab-case-name>.md`
4. **关键设计原则**：
   - 填写原则：只保留与本次变更相关的内容，无关章节填写"不涉及"
   - 使用 `{{askTool}}` 收集缺失信息，安装时按工具渲染
   - 模板中的 mermaid 图表需根据实际业务逻辑绘制
   - 输出后展示文档路径和关键内容摘要

### ✅ 1b. `templates/common/skills/dev-spec-design/references/system-analysis-design-template-lite.md`

从 `docs/templates/system-analysis-design-template-lite.md` 复制，作为技能的参考模板。技能通过 `<SKILL_ROOT>/references/system-analysis-design-template-lite.md` 引用它。

### ✅ 1c. `templates/common/skills/dev-spec-design/agents/openai.yaml`

```yaml
interface:
  display_name: "Dev Spec Design"
  short_description: "Generate system analysis and design specification documents"
  default_prompt: "Use $dev-spec-design to generate a system analysis and design document."
```

## ✅ Step 2: 创建斜杠命令

### ✅ `templates/common/commands/opsx/dev-spec-design.md.hbs`

薄包装模式，参考 `opsx/explore.md.hbs` 的设计：

```markdown
---
name: "OPSX: Dev-Spec-Design"
description: Generate system analysis and design specification document (lite version)
allowed-tools: Bash(openspec:*), {{askTool}}
category: Workflow
tags: [workflow, design, spec, experimental]
---

Generate a system analysis and design specification document using the lite template.

## Pipeline Integration (v2)

> Read-only pipeline awareness. Never initialize, migrate, or modify pipeline state.

### Pre-flight: Read-only State Awareness

1. Run `openspec list --json` to discover active changes.
2. If the user mentions a change, or exactly one active change is clearly relevant, run:
   ```bash
   node {{skillsDir}}/opsx-dev-pipeline/scripts/dev-pipeline-state.mjs get "<name>"
   ```
3. If state exists, summarize as context. Show the associated change info.
4. If state is missing, continue standalone.

### Execute

Load and follow `{{skillsDir}}/dev-spec-design/SKILL.md` completely.

### Post-flight

Show the generated design doc path and summary. Do not record it in pipeline state or run `transition`, `decision`, or other state-modifying commands.
```

## ✅ Step 3: 注册 Asset

在 `src/core/assets/manifest.ts` 的 `assetManifest` 数组中添加两个新条目：

### ✅ 3a. Skill Bundle（在 `grilling-skill-bundle` 之后）

```typescript
{
  id: 'dev-spec-design-skill-bundle',
  kind: 'bundle',
  scope: 'common',
  feature: 'skills',
  source: 'templates/common/skills/dev-spec-design',
  destination: '{{skillsDir}}/dev-spec-design',
  includeExtensions: ['.md', '.hbs', '.yaml'],
  templateFiles: ['SKILL.md.hbs'],
  excludePatterns: ['.gitkeep'],
  writePolicy: { appendStrategy: 'simple', appendExtensions: ['.md'] },
},
```

### ✅ 3b. Command（在 `opsx-grilling-command` 之后）

```typescript
{
  id: 'opsx-dev-spec-design-command',
  kind: 'template',
  scope: 'common',
  feature: 'commands',
  source: 'templates/common/commands/opsx/dev-spec-design.md.hbs',
  destination: '{{commandsDir}}/opsx/dev-spec-design.md',
  writePolicy: { appendStrategy: 'simple', onConflict: { init: 'overwrite' } },
},
```

## ✅ Step 4: 更新 package.json

在 `package.json` 的 `opsxDevPipeline.managedAssets` 中添加四个条目（用于本项目的 sync/upgrade）：

```json
{
  "id": "dev-spec-design-skill-bundle:SKILL.md.hbs",
  "destination": ".claude/skills/dev-spec-design/SKILL.md"
},
{
  "id": "dev-spec-design-skill-bundle:references/system-analysis-design-template-lite.md",
  "destination": ".claude/skills/dev-spec-design/references/system-analysis-design-template-lite.md"
},
{
  "id": "dev-spec-design-skill-bundle:agents/openai.yaml",
  "destination": ".claude/skills/dev-spec-design/agents/openai.yaml"
},
{
  "id": "opsx-dev-spec-design-command",
  "destination": ".claude/commands/opsx/dev-spec-design.md"
}
```

## 设计决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| 形态 | Skill 技能包 + 斜杠命令 | 用户明确选择 Skill 技能包；命令层提供 pipeline 感知；与现有架构一致 |
| 模板位置 | 放入 skill bundle 的 references/ | 随技能安装到目标项目，技能可本地引用；与 phase 引用文件模式一致 |
| 模板格式 | 纯 `.md` 静态文件 | 模板是中文固定内容，不需要 Handlebars 变量替换 |
| Pipeline 集成 | 只读感知模式 | 参考 explore 命令模式，不修改 pipeline 状态，仅展示上下文 |
| 输出目录 | `openspec/docs/<yyyyMMdd>/<name>.md` | 用户指定；按日期分组避免文件堆积 |
| 特性门控 | 复用现有 `skills` 和 `commands` feature | 不需要新增 feature，保持简单 |

## 待确认问题

1. ✅ **模板文件是复制还是移动？** — 已复制到 skill bundle，原文件保留作为参考。
2. ✅ **是否需要中英文双语支持？** — 当前只提供中文模板，不加 `.zh` 后缀，未来按需扩展。
3. ✅ **Pipeline 关联深度** — 当前仅只读展示 change 上下文，不在 pipeline state 中记录文档路径。

## 涉及文件清单

### 新建文件
- `templates/common/skills/dev-spec-design/SKILL.md.hbs`
- `templates/common/skills/dev-spec-design/references/system-analysis-design-template-lite.md`
- `templates/common/skills/dev-spec-design/agents/openai.yaml`
- `templates/common/commands/opsx/dev-spec-design.md.hbs`

### 修改文件
- `src/core/assets/manifest.ts` — 添加 2 个 asset 定义
- `package.json` — 添加 managedAssets 条目
- `test/unit/build-install-plan.test.ts` — 覆盖 bundle、命令路径和模板渲染
- `test/integration/init-matrix.test.ts` — 覆盖 Claude、Cursor、Codex 初始化产物

## 验证方式

1. ✅ **构建**：`npm run build` 确认 TypeScript 编译通过
2. ✅ **冒烟测试**：`npm run init:smoke` 确认 init 流程正常
3. ✅ **手动测试**：在隔离临时目录中运行 `opsx-dev-pipeline init`，验证：
   - `.claude/skills/dev-spec-design/SKILL.md` 文件存在
   - `.claude/skills/dev-spec-design/references/system-analysis-design-template-lite.md` 文件存在
   - `.claude/commands/opsx/dev-spec-design.md` 文件存在
   - 命令 frontmatter 中的 `{{askTool}}` 被正确替换为 `AskUserQuestion`
4. **功能验证**：在 test-space/snake-game 中执行 `/opsx:dev-spec-design`，验证：
   - 技能正确加载并收集需求
   - 生成的文档写入 `openspec/docs/<yyyyMMdd>/<name>.md`
   - 文档内容符合模板结构
