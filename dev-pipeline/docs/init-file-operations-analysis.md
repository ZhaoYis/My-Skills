# `init` 命令文件写入可选操作分析文档

## 概述

`opsx-dev-pipeline init` 命令在执行初始化时，会根据配置生成一系列文件。当目标路径已存在同名文件时，会触发冲突解决流程，提示用户选择处理方式。本文档梳理了每一步文件写入时的可选操作项，以及各文件支持的选项差异。

---

## 整体执行流程

```
init 命令
  │
  ├── 1. validateTarget      检查目标目录状态，检测已有 AI 工具
  ├── 2. preflightOpenSpec   验证 openspec CLI >= 1.6.0
  ├── 3. initializeOpenSpec  运行 openspec init --tools <tool>
  ├── 4. collectInputs       收集用户输入（项目名、工具、stack、语言）
  ├── 5. buildInstallPlan    构建安装计划，标记文件是否存在
  ├── 6. resolveInstallConflicts  交互式冲突解决
  └── 7. executeInstallPlan  执行文件写入
```

---

## 冲突解决机制

### 决议优先级

| 优先级 | 条件 | 自动决议 | 说明 |
|:---:|------|:---:|------|
| 1 | `--force` 设置 | `overwrite` | 强制覆盖所有文件，不提示 |
| 2 | `replaceOnInit: true` 且 mode=`init` | `overwrite` | 特定资产在 init 模式下自动覆盖 |
| 3 | `--yes` 设置（非交互模式） | `skip` | 自动跳过所有冲突，不提示 |
| 4 | 以上都不满足 | — | **进入交互式提示** |

### 交互式提示选项

#### 可追加文件的选项（共 6 项）

当文件满足以下条件时，支持"追加"操作：
- 文件类型为 `template`（非 static）
- 文件名在追加白名单中：`.gitignore`、`CLAUDE.md`、`config.yaml`
- 或文件扩展名在追加白名单中：`.md`、`.mdc`、`.txt`

| 选项 | 枚举值 | 效果说明 |
|------|:---:|------|
| 强制覆盖 | `overwrite` | 用模板生成的新内容完全替换现有文件 |
| **追加** | `append` | 在现有文件内容末尾追加新内容 |
| 跳过 | `skip` | 保留现有文件不变，不写入 |
| 覆盖当前及剩余全部 | `overwrite-all` | 当前文件及后续所有冲突文件均覆盖 |
| 跳过当前及剩余全部 | `skip-all` | 当前文件及后续所有冲突文件均跳过 |
| 追加所有可追加文件，其余跳过 | `append-all-safe` | 可追加的文件执行追加，不可追加的跳过 |

> **代码位置**：`src/core/init/resolveInstallConflicts.ts:11-22`

#### 不可追加文件的选项（共 4 项）

static 文件或不在追加白名单中的 template 文件：

| 选项 | 枚举值 | 效果说明 |
|------|:---:|------|
| 强制覆盖 | `overwrite` | 用新内容完全替换现有文件 |
| 跳过 | `skip` | 保留现有文件不变 |
| 覆盖当前及剩余全部 | `overwrite-all` | 当前及后续全部覆盖 |
| 跳过当前及剩余全部 | `skip-all` | 当前及后续全部跳过 |

---

## 追加文件的判断逻辑

**代码位置**：`src/core/init/isAppendableInstallFile.ts`

```typescript
// 仅 template 类型文件支持追加，static 文件不支持
const APPENDABLE_BASENAMES = new Set(['.gitignore', 'CLAUDE.md', 'config.yaml']);
const APPENDABLE_EXTENSIONS = new Set(['.md', '.mdc', '.txt']);
```

一个文件被认为是"可追加的"需同时满足：
1. `kind === 'template'`
2. 文件名在 `APPENDABLE_BASENAMES` 中，或扩展名在 `APPENDABLE_EXTENSIONS` 中

---

## 追加的两种策略

**代码位置**：`src/core/init/executeInstallPlan.ts`

### 1. 简单追加（`appendContent`）

适用于大部分文件。在现有内容末尾加分隔符后拼接新内容：

```typescript
function appendContent(existingContent: string, nextContent: string): string {
  const separator = existingContent.endsWith('\n') ? '\n' : '\n\n';
  return `${existingContent}${separator}${nextContent}`;
}
```

### 2. 智能合并（`mergeConfigContent`）

**仅用于 `config.yaml`**，针对 YAML 结构进行智能合并：
- **`mergeConfigLanguage`**：合并 `language` 字段和 `rules` 中的 language 规则
- **`appendConfigContext`**：合并 `context` 字段中的新增行，避免重复

特殊判断逻辑（当前为硬编码）：
```typescript
path.basename(file.destinationPath) === 'config.yaml'
  ? mergeConfigContent(existingContent, content)
  : appendContent(existingContent, content)
```

---

## 逐文件详细分析

### 图例说明

| 符号 | 含义 |
|:---:|------|
| O | Overwrite（覆盖） |
| A | Append（追加） |
| S | Skip（跳过） |
| ✅ | 支持 |
| ❌ | 不支持 |
| 🔄 | 自动覆盖（不提示） |

---

### Feature: `base`（基础脚手架）

#### 1. `README.md`（`common-readme`）

| 属性 | 值 |
|------|-----|
| 类型 | `template` |
| 源模板 | `templates/common/base/README.md.hbs` |
| replaceOnInit | ❌ |
| 可追加 | ✅（`.md` 扩展名） |

| 可选操作 | 是否可用 |
|---------|:---:|
| 强制覆盖 (overwrite) | ✅ |
| 追加 (append) | ✅ |
| 跳过 (skip) | ✅ |
| 覆盖全部 (overwrite-all) | ✅ |
| 跳过全部 (skip-all) | ✅ |
| 追加可追加+跳过其余 (append-all-safe) | ✅ |

---

#### 2. `.gitignore`（`common-gitignore`）

| 属性 | 值 |
|------|-----|
| 类型 | `static`（直接文件拷贝） |
| 源文件 | `templates/common/base/gitignore` |
| replaceOnInit | ❌ |
| 可追加 | ❌（static 文件不支持追加） |

| 可选操作 | 是否可用 |
|---------|:---:|
| 强制覆盖 (overwrite) | ✅ |
| 追加 (append) | ❌ |
| 跳过 (skip) | ✅ |
| 覆盖全部 (overwrite-all) | ✅ |
| 跳过全部 (skip-all) | ✅ |
| 追加可追加+跳过其余 (append-all-safe) | ❌ |

---

### Feature: `schema`（OpenSpec Schema）

#### 3. Schema Bundle — 前端（`frontend-schema-bundle`）

| 属性 | 值 |
|------|-----|
| 类型 | `bundle`（目录批量展开） |
| Stack | 仅 `frontend` |
| 源目录 | `templates/common/schemas/frontend` |
| replaceOnInit | ❌ |

展开后的文件处理：

| 文件 | 类型 | 可追加 | 可选操作 |
|------|:---:|:---:|------|
| `schema.yaml` | template（.hbs → .yaml） | ❌ | O / S / 批量 |
| `proposal.md` | template（.hbs → .md） | ✅ | O / **A** / S / 批量 |
| `design.md` | template（.hbs → .md） | ✅ | O / **A** / S / 批量 |
| `spec.md` | template（.hbs → .md） | ✅ | O / **A** / S / 批量 |
| `tasks.md` | template（.hbs → .md） | ✅ | O / **A** / S / 批量 |

---

#### 4. Schema Bundle — 后端（`backend-schema-bundle`）

与前端的文件结构完全一致，仅 stack 限定为 `backend`，目标路径为 `openspec/schemas/backend/`。

---

#### 5. `openspec/config.yaml`（`stack-config`）

| 属性 | 值 |
|------|-----|
| 类型 | `template` |
| 源模板 | `templates/common/config/config.{{stack}}.yaml.hbs` |
| replaceOnInit | ❌ |
| 可追加 | ✅（`config.yaml` 在追加白名单中） |

| 可选操作 | 是否可用 |
|---------|:---:|
| 强制覆盖 (overwrite) | ✅ |
| 追加 (append) — **使用智能合并策略** | ✅ |
| 跳过 (skip) | ✅ |
| 覆盖全部 (overwrite-all) | ✅ |
| 跳过全部 (skip-all) | ✅ |
| 追加可追加+跳过其余 (append-all-safe) | ✅ |

> **特殊行为**：追加时使用 `mergeConfigContent()` 而非简单拼接。会智能合并：
> - `language` 字段（更新值，不重复）
> - `rules` 下的 language 规则块（替换已有规则，新增缺失规则）
> - `context` 字段中的行（增量添加新行，不重复已有行）

---

### Feature: `skills`（技能模板）

#### 6. Pipeline Skill Bundle（`opsx-dev-pipeline-skill-bundle`）

| 属性 | 值 |
|------|-----|
| 类型 | `bundle` |
| 目标路径 | `{{skillsDir}}/opsx-dev-pipeline/` |
| replaceOnInit | ❌ |

展开后包含三类文件，可选操作各不相同：

| 文件类型 | 示例文件 | 可追加 | 可选操作 |
|---------|------|:---:|------|
| Markdown 模板（`.md.hbs`） | `SKILL.md`、`phase-0-entrance.md`、`phase-1-propose.md` 等 | ✅ | O / **A** / S / 批量 |
| JavaScript 脚本（`.mjs`） | `pipeline-lib.mjs`、`new-change.mjs`、`archive.mjs` 等（共 12 个） | ❌ | O / S / 批量 |
| YAML 配置（`.yaml`） | `agents/openai.yaml` 等 | ❌ | O / S / 批量 |

> `.mjs` 和 `.yaml` 文件不在追加白名单扩展名中，因此不支持追加操作。

---

### Feature: `commands`（命令模板）

#### 7. `{{commandsDir}}/opsx-dev-pipeline.md`（`opsx-dev-pipeline-command`）

| 属性 | 值 |
|------|-----|
| 类型 | `template` |
| replaceOnInit | ❌ |
| 可追加 | ✅（`.md` 扩展名） |

| 可选操作 | 是否可用 |
|---------|:---:|
| 强制覆盖 (overwrite) | ✅ |
| 追加 (append) | ✅ |
| 跳过 (skip) | ✅ |
| 批量操作 | ✅ |

---

#### 8-13. opsx 子命令（6 个文件）

| 属性 | 值 |
|------|-----|
| 类型 | `template` |
| 路径 | `{{commandsDir}}/opsx/{name}.md` |
| **replaceOnInit** | ✅ **总是自动覆盖** |
| 可追加 | ✅（`.md` 扩展名） |

涉及的文件：

| 资产 ID | 目标文件 |
|------|------|
| `opsx-propose-command` | `opsx/propose.md` |
| `opsx-apply-command` | `opsx/apply.md` |
| `opsx-archive-command` | `opsx/archive.md` |
| `opsx-verify-command` | `opsx/verify.md` |
| `opsx-sync-command` | `opsx/sync.md` |
| `opsx-explore-command` | `opsx/explore.md` |

> ⚠️ **重要**：这 6 个文件因 `replaceOnInit: true`，在 `init` 模式下即使已存在也**不会触发交互提示**。它们会被自动覆盖，不进入冲突解决流程。在 `sync`/`upgrade` 模式下则正常进入冲突流程。

---

### Feature: `docs`（工具文档）

#### 14. `CLAUDE.md`（`claude-docs`）

| 属性 | 值 |
|------|-----|
| 类型 | `template` |
| Tool | 仅 Claude Code |
| 源模板 | `templates/tools/claude/overlay/CLAUDE.md.hbs` |
| replaceOnInit | ❌ |
| 可追加 | ✅（`CLAUDE.md` 在追加白名单中） |

| 可选操作 | 是否可用 |
|---------|:---:|
| 强制覆盖 (overwrite) | ✅ |
| 追加 (append) | ✅ |
| 跳过 (skip) | ✅ |
| 批量操作 | ✅ |

---

#### 15. `.cursor/rules/opsx-dev-pipeline.mdc`（`cursor-docs`）

| 属性 | 值 |
|------|-----|
| 类型 | `template` |
| Tool | 仅 Cursor |
| replaceOnInit | ❌ |
| 可追加 | ✅（`.mdc` 在追加白名单中） |

| 可选操作 | 是否可用 |
|---------|:---:|
| 强制覆盖 (overwrite) | ✅ |
| 追加 (append) | ✅ |
| 跳过 (skip) | ✅ |
| 批量操作 | ✅ |

---

#### 16. `.cursor/commands/README.md`（`cursor-command-guide`）

| 属性 | 值 |
|------|-----|
| 类型 | `template` |
| Tool | 仅 Cursor |
| replaceOnInit | ❌ |
| 可追加 | ✅（`.md` 扩展名） |

---

#### 17. `.codex/prompts/opsx-dev-pipeline.md`（`codex-docs`）

| 属性 | 值 |
|------|-----|
| 类型 | `template` |
| Tool | 仅 Codex |
| replaceOnInit | ❌ |
| 可追加 | ✅（`.md` 扩展名） |

---

#### 18. `.codex/commands/README.md`（`codex-command-guide`）

| 属性 | 值 |
|------|-----|
| 类型 | `template` |
| Tool | 仅 Codex |
| replaceOnInit | ❌ |
| 可追加 | ✅（`.md` 扩展名） |

---

## 汇总对照表

| # | 资产 ID | 目标文件 | 类型 | 可追加 | replaceOnInit | 冲突时可选操作 |
|---|------|------|:---:|:---:|:---:|------|
| 1 | `common-readme` | `README.md` | template | ✅ | — | O / **A** / S / 批量 |
| 2 | `common-gitignore` | `.gitignore` | **static** | ❌ | — | O / S / 批量 |
| 3 | `frontend-schema-bundle` | `openspec/schemas/frontend/*.yaml` | template | ❌ | — | O / S / 批量 |
| | | `openspec/schemas/frontend/*.md` | template | ✅ | — | O / **A** / S / 批量 |
| 4 | `backend-schema-bundle` | `openspec/schemas/backend/*.yaml` | template | ❌ | — | O / S / 批量 |
| | | `openspec/schemas/backend/*.md` | template | ✅ | — | O / **A** / S / 批量 |
| 5 | `stack-config` | `openspec/config.yaml` | template | ✅ | — | O / **A（智能合并）** / S / 批量 |
| 6 | `opsx-dev-pipeline-skill-bundle` | `{skillsDir}/opsx-dev-pipeline/*.md` | template | ✅ | — | O / **A** / S / 批量 |
| | | `{skillsDir}/opsx-dev-pipeline/*.mjs` | static | ❌ | — | O / S / 批量 |
| | | `{skillsDir}/opsx-dev-pipeline/*.yaml` | static | ❌ | — | O / S / 批量 |
| 7 | `opsx-dev-pipeline-command` | `{commandsDir}/opsx-dev-pipeline.md` | template | ✅ | — | O / **A** / S / 批量 |
| 8 | `opsx-propose-command` | `{commandsDir}/opsx/propose.md` | template | ✅ | ✅ | 🔄 自动覆盖 |
| 9 | `opsx-apply-command` | `{commandsDir}/opsx/apply.md` | template | ✅ | ✅ | 🔄 自动覆盖 |
| 10 | `opsx-archive-command` | `{commandsDir}/opsx/archive.md` | template | ✅ | ✅ | 🔄 自动覆盖 |
| 11 | `opsx-verify-command` | `{commandsDir}/opsx/verify.md` | template | ✅ | ✅ | 🔄 自动覆盖 |
| 12 | `opsx-sync-command` | `{commandsDir}/opsx/sync.md` | template | ✅ | ✅ | 🔄 自动覆盖 |
| 13 | `opsx-explore-command` | `{commandsDir}/opsx/explore.md` | template | ✅ | ✅ | 🔄 自动覆盖 |
| 14 | `claude-docs` | `CLAUDE.md` | template | ✅ | — | O / **A** / S / 批量 |
| 15 | `cursor-docs` | `.cursor/rules/opsx-dev-pipeline.mdc` | template | ✅ | — | O / **A** / S / 批量 |
| 16 | `cursor-command-guide` | `.cursor/commands/README.md` | template | ✅ | — | O / **A** / S / 批量 |
| 17 | `codex-docs` | `.codex/prompts/opsx-dev-pipeline.md` | template | ✅ | — | O / **A** / S / 批量 |
| 18 | `codex-command-guide` | `.codex/commands/README.md` | template | ✅ | — | O / **A** / S / 批量 |

---

## 当前存在的问题

通过以上分析可以看出，每个文件的可选操作存在**不统一**的问题：

### 1. 追加能力判断不透明

- 追加判断逻辑硬编码在 `isAppendableInstallFile.ts` 中
- 仅通过固定的文件名和扩展名集合判断
- 无法按资产粒度自定义是否支持追加

### 2. 冲突选项不一致

- 可追加文件展示 6 个选项，不可追加文件展示 4 个
- `buildChoices()` 函数在 `resolveInstallConflicts.ts` 中根据 `file.appendable` 布尔值分支

### 3. 合并策略硬编码

- `config.yaml` 的智能合并策略通过 `path.basename()` 硬编码判断
- 无法扩展新的合并策略到其他文件类型

### 4. `replaceOnInit` 特殊通道

- 6 个 opsx 子命令通过 `replaceOnInit` 标志绕过正常的冲突解决流程
- 行为与其他文件不一致，增加理解成本

### 5. 逻辑分散

- 文件操作相关逻辑分布在 4 个文件中：
  - `isAppendableInstallFile.ts` — 追加能力判断
  - `resolveInstallConflicts.ts` — 交互选项生成
  - `executeInstallPlan.ts` — 合并策略选择
  - `buildInstallPlan.ts` — replaceOnInit 处理

---

## 改进方向

建议创建统一的 **`FileWritePolicy`** 机制：

1. **统一工具**：一个 `fileWritePolicy.ts` 模块统一管理所有文件写入的策略判断
2. **可配置化**：在 `AssetDefinition` 中增加 `writePolicy` 字段，允许每个资产自定义冲突行为
3. **策略驱动**：用 `appendStrategy`（`simple` / `config-merge` / `none`）替代硬编码的文件名判断

## 实施任务

- [x] ✅ 任务 1：新增统一的 `FileWritePolicy` 类型与 `fileWritePolicy.ts` 策略解析模块。
- [x] ✅ 任务 2：在 `AssetDefinition` 中配置 `writePolicy`，移除 `replaceOnInit` 和全局追加白名单。
- [x] ✅ 任务 3：让安装计划、冲突决议、文件写入和卸载流程统一消费文件写入策略。
- [x] ✅ 任务 4：补齐回归测试，并通过 typecheck、lint、全量测试和 build 验证。
