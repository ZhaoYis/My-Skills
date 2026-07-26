# 统一用户询问工具命名方案

## 问题分析

`opsx-dev-pipeline` 支持多个 AI 工具（Claude Code、Cursor、Codex），但用户询问工具的命名在各文件中不一致：

| 环境 | 工具名 | 说明 |
|------|--------|------|
| Claude Code | `AskUserQuestion` | Claude Code 内置的询问工具 |
| Cursor | `AskQuestion` | Cursor 内置的询问工具 |
| Codex | 无专用工具 | 依赖降级策略（编号选项列表） |

### 当前问题

```
模板/引用文件                      硬编码名称        正确环境      错误环境
─────────────────────────────────────────────────────────────────────────
commands/opsx/*.md.hbs          AskUserQuestion    Claude Code    Cursor, Codex
skills/.../SKILL.md.hbs         AskQuestion        Cursor         Claude Code, Codex
skills/.../references/*.md      AskQuestion        Cursor         Claude Code, Codex
```

**核心矛盾**：Reference 文件（`phase-*.md`）硬编码了 `AskQuestion`（Cursor 的工具名），在 Claude Code 环境中该工具不存在，导致每次都降级到编号列表——`AskUserQuestion` 实际不生效。Command 模板则反向硬编码了 `AskUserQuestion`，部署到 Cursor 时工具名也不正确。

## 设计方案

```
                 buildTemplateContext()
                        │
            toolId ─────┤
                        │
                 ┌──────▼──────┐
                 │  askTool =  │
                 │  claude  → AskUserQuestion
                 │  cursor  → AskQuestion
                 │  codex   → AskUserQuestion
                 └──────┬──────┘
                        │
                        ▼
              所有 .hbs 模板使用 {{askTool}}
                        │
                        ▼
              渲染输出自动匹配目标环境
```

通过 Handlebars 变量 `{{askTool}}`，在模板**安装时**根据目标工具注入正确的工具名。模板编写时使用统一的 `{{askTool}}`，渲染后自动变为当前环境的正确工具名。

## 实施步骤

### Step 1: 新增模板上下文变量

**文件**: `src/core/init/buildInstallPlan.ts`

新增映射常量，在 `buildTemplateContext()` 返回对象中添加 `askTool` 字段：

```typescript
// 新增映射（放在文件顶部，import 之后）
const ASK_TOOL_MAP: Record<ToolId, string> = {
  claude: 'AskUserQuestion',
  cursor: 'AskQuestion',
  codex: 'AskUserQuestion',
};

// buildTemplateContext() 返回值中新增一行：
return {
  // ... 现有字段 ...
  askTool: ASK_TOOL_MAP[params.toolId],
};
```

### Step 2: 修改 Command 模板（5 个文件）

每个文件有 **2 处** `AskUserQuestion` → `{{askTool}}`：

| 文件 | 修改位置 |
|------|----------|
| `templates/common/commands/opsx/propose.md.hbs` | frontmatter `allowed-tools` 行 + body `MUST call AskUserQuestion` |
| `templates/common/commands/opsx/apply.md.hbs` | 同上 |
| `templates/common/commands/opsx/archive.md.hbs` | 同上 |
| `templates/common/commands/opsx/sync.md.hbs` | 同上 |
| `templates/common/commands/opsx/verify.md.hbs` | 同上 |

示例（`propose.md.hbs`）：
```diff
- allowed-tools: Bash(openspec:*), Bash(node:*), Bash(git:*), AskUserQuestion
+ allowed-tools: Bash(openspec:*), Bash(node:*), Bash(git:*), {{askTool}}

- **MUST call AskUserQuestion and wait for an explicit choice**
+ **MUST call {{askTool}} and wait for an explicit choice**
```

> `templates/common/commands/opsx/explore.md.hbs` **不需要修改**——它不使用任何询问工具。

### Step 3: 修改 SKILL.md.hbs（1 处）

**文件**: `templates/common/skills/opsx-dev-pipeline/SKILL.md.hbs`

```diff
- 决策点首选 **AskQuestion** tool；不可用时改用编号选项列表并等待用户回复，不得自动代选。
+ 决策点首选 **{{askTool}}** tool；不可用时改用编号选项列表并等待用户回复，不得自动代选。
```

### Step 4: 转换 Reference 文件为模板（7 个文件）

将静态 `.md` 重命名为 `.md.hbs`，使它们能被 Handlebars 渲染。

| 当前文件 | 新文件名 | `AskQuestion` 出现次数 |
|----------|----------|----------------------|
| `references/phase-0-entrance.md` | `references/phase-0-entrance.md.hbs` | 6 |
| `references/phase-1-propose.md` | `references/phase-1-propose.md.hbs` | 3 |
| `references/phase-2-apply.md` | `references/phase-2-apply.md.hbs` | 3 |
| `references/phase-3-review.md` | `references/phase-3-review.md.hbs` | 3 |
| `references/phase-4-unit-tests.md` | `references/phase-4-unit-tests.md.hbs` | 3 |
| `references/phase-5-archive.md` | `references/phase-5-archive.md.hbs` | 4 |
| `references/phase-6-merge-push.md` | `references/phase-6-merge-push.md.hbs` | 0 |

对每个文件，将所有 `AskQuestion` → `{{askTool}}`。示例（`phase-0-entrance.md.hbs`）：
```diff
- 必须使用 **AskQuestion** 询问用户是否关联外部需求
+ 必须使用 **{{askTool}}** 询问用户是否关联外部需求
- 使用 **AskQuestion** 确认续接方式
+ 使用 **{{askTool}}** 确认续接方式
```

**无需修改 `assetManifest` 的 `templateFiles`**：bundle 展开逻辑（`expandBundle`）自动将 `.hbs` 后缀的文件标记为 `kind: 'template'`。重命名后文件会以 `phase-0-entrance.md.hbs` 的形式存在于 bundle 中，`selectBundleEntries` 会剥离 `.hbs` 后缀，生成目标文件 `phase-0-entrance.md`。

可选的文档性更新——在 `src/core/assets/manifest.ts` 的 `templateFiles` 中列出所有 `.hbs` 引用文件：

```typescript
templateFiles: [
  'SKILL.md.hbs',
  'phase-0-entrance.md.hbs',
  'phase-1-propose.md.hbs',
  'phase-2-apply.md.hbs',
  'phase-3-review.md.hbs',
  'phase-4-unit-tests.md.hbs',
  'phase-5-archive.md.hbs',
  'phase-6-merge-push.md.hbs',
],
```

### Step 5: 更新测试

**文件**: `test/unit/build-install-plan.test.ts`（~line 300-305）

渲染模板时增加 `askTool` 上下文：
```diff
  const rendered = await renderTemplate(
    path.join(PACKAGE_ROOT, 'templates/common/commands/opsx', `${command}.md.hbs`),
-   { skillsDir, commandsDir },
+   { skillsDir, commandsDir, askTool: 'AskUserQuestion' },
  );
```

现有断言 `expect(rendered).toContain('AskUserQuestion')` 依然通过（claude 工具渲染后输出 `AskUserQuestion`）。

**文件**: `test/integration/init-matrix.test.ts`（~line 340）

该测试以 `claude` 工具运行 init，渲染后的入口文件将包含 `AskUserQuestion` 而非 `AskQuestion`：
```diff
- expect(entrance).toContain('必须使用 **AskQuestion** 询问用户是否关联外部需求');
+ expect(entrance).toContain('必须使用 **AskUserQuestion** 询问用户是否关联外部需求');
```

## 边界情况与风险评估

| 风险 | 评估 | 处理 |
|------|------|------|
| 旧 `.md` 文件残留 | 低 | 使用 `git mv` 重命名，确保 git 追踪正确 |
| Codex 无专用询问工具 | 低 | 已映射为 `AskUserQuestion`，与现有 command 模板行为一致 |
| Handlebars 转义 | 无 | `AskUserQuestion`/`AskQuestion` 不含 HTML 特殊字符，`{{askTool}}` 安全 |
| `{{askTool}}` 泄漏到渲染输出 | 低 | `executeInstallPlan` 对所有 `kind: 'template'` 文件执行渲染，变量必然被替换 |
| 语言本地化冲突 | 无 | Reference 文件无 `.zh.md`/`.en.md` 变体，不影响 `selectBundleEntries` 逻辑 |

## 变更文件清单

```
修改 (src):
  src/core/init/buildInstallPlan.ts          # 新增 askTool 上下文变量
  src/core/assets/manifest.ts                # 可选：更新 templateFiles

修改 (templates - 替换 AskUserQuestion → {{askTool}}):
  templates/common/commands/opsx/propose.md.hbs
  templates/common/commands/opsx/apply.md.hbs
  templates/common/commands/opsx/archive.md.hbs
  templates/common/commands/opsx/verify.md.hbs
  templates/common/commands/opsx/sync.md.hbs

修改 (templates - 替换 AskQuestion → {{askTool}}):
  templates/common/skills/opsx-dev-pipeline/SKILL.md.hbs

重命名 (templates - .md → .md.hbs + 替换 AskQuestion → {{askTool}}):
  templates/common/skills/opsx-dev-pipeline/references/phase-0-entrance.md
  templates/common/skills/opsx-dev-pipeline/references/phase-1-propose.md
  templates/common/skills/opsx-dev-pipeline/references/phase-2-apply.md
  templates/common/skills/opsx-dev-pipeline/references/phase-3-review.md
  templates/common/skills/opsx-dev-pipeline/references/phase-4-unit-tests.md
  templates/common/skills/opsx-dev-pipeline/references/phase-5-archive.md
  templates/common/skills/opsx-dev-pipeline/references/phase-6-merge-push.md

修改 (tests):
  test/unit/build-install-plan.test.ts       # 增加 askTool 到渲染上下文
  test/integration/init-matrix.test.ts       # 更新断言匹配 Claude 工具名
```

## 验证方式

1. **单元测试**: `npm test` — 所有现有测试通过
2. **类型检查**: `npm run typecheck` — 无类型错误
3. **冒烟测试**: `npm run init:smoke` — 初始化流程正常
4. **手动验证**:
   - 对 `claude` 工具执行 `init`，检查渲染后的 command 和 reference 文件都使用 `AskUserQuestion`
   - 对 `cursor` 工具执行 `init`，检查渲染后的文件都使用 `AskQuestion`
   - 对 `codex` 工具执行 `init`，检查渲染后的文件使用 `AskUserQuestion`
