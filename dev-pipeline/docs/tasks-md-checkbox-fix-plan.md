# tasks.md 完成勾选缺失问题：根因分析与修复方案

## 问题现象

流水线执行 `tasks.md` 中的任务后，完成的任务对应的复选框没有被标记为已完成（`- [ ]` 未更新为 `- [x]`）。

## 证据

项目中所有已归档的 change，其 `tasks.md` 中没有任何一个 `[x]`：

| 归档 Change | 任务总数 (`[ ]`) | 已完成 (`[x]`) |
|---|---|---|
| `add-skin-system` | 18 | **0** |
| `add-bomb-system` | 45 | **0** |
| `add-timed-mode` | 34 | **0** |

这些 change 的代码实现已经完成，但 `tasks.md` 从未被更新过。

---

## 根因分析

### 两维度根因

**主要根因**：`opsx-dev-pipeline` 的 Phase 2 参考文件 `phase-2-apply.md` 中缺少显式指令。

对比两套指令体系：

| 指令来源 | 文件 | 是否包含 `[ ]` → `[x]` 编辑指令 |
|---|---|---|
| `openspec-apply-change` 独立 Skill | `SKILL.md` 第 77 行 | ✅ 明确："Mark task complete in the tasks file: `- [ ]` → `- [x]`" |
| `openspec-apply-change` 独立 Skill | `SKILL.md` 第 151 行 | ✅ Guardrail："Update task checkbox immediately after completing each task" |
| `opsx-dev-pipeline` 全流程 Skill | `phase-2-apply.md` Step7 第 16-37 行 | ❌ **缺失** — 只有自审查门禁表，没有文件编辑指令 |

当 AI 通过 `/opsx-dev-pipeline`（完整流水线）执行时，它读取的是 `phase-2-apply.md` 获取 Phase 2 指导。该文件描述了自审查门禁（12 项检查），但从未明确告诉 AI 去 **编辑 `tasks.md` 文件** 将 `- [ ]` 改为 `- [x]`。

**次要根因**：缺少程序化校验。相关脚本的行为：

| 组件 | 行为 |
|---|---|
| `dev-pipeline-state.mjs` | 管理阶段状态 JSON，**完全不读写 `tasks.md`** |
| `@fission-ai/openspec` CLI | **只读取** 复选框进行计数和进度汇报，**从不写入** |
| `DeterministicPipelineExecutor.ts` (测试用) | 程序化替换 `[ ]` → `[x]`，但 **仅在测试模式** 使用 |
| OpenSpec archive 门禁 | 会检查 `[ ]` 未完成任务并警告，但 AI 认为代码已完成，可能忽略 |

### 关键代码引用

**OpenSpec CLI 只读取，不写入** (`task-progress.js` 第 5-8 行)：
```js
const TASK_PATTERN = /^[-*]\s+\[[\sx]\]/i;
const COMPLETED_TASK_PATTERN = /^[-*]\s+\[x\]/i;
```

**`deterministic` 模式才程序化写入** (`DeterministicPipelineExecutor.ts` 第 120 行)：
```typescript
await fs.writeFile(tasksPath, tasks.replaceAll('- [ ]', '- [x]'));
```

**独立 apply skill 中的显式指令** (`openspec-apply-change/SKILL.md` 第 77 行)：
```
Mark task complete in the tasks file: `- [ ]` → `- [x]`
```

**全流程 Phase 2 中缺失对应指令** (`phase-2-apply.md` 第 35 行)：
```
**有一条不满足 → 不允许标記得完成**，先改到满足。
```
—— 只说了"不允许标记"，没说要通过编辑 `tasks.md` 来"标记"。

---

## 修复方案

### 修改文件

`templates/common/skills/opsx-dev-pipeline/references/phase-2-apply.md`

同步应用到：`test-space/snake-game/.claude/skills/opsx-dev-pipeline/references/phase-2-apply.md`

### 具体修改

在 `phase-2-apply.md` 的 **Step7** 中，第 35 行之后添加一行显式文件编辑指令：

**修改前**（第 35-37 行）：
```markdown
**有一条不满足 → 不允许标記得完成**，先改到满足。

遇到阻塞时 **AskQuestion**：`提供补充说明` / `回到 Phase1 修改提案` / `跳过此任务`（标记 `[~]`） / `终止流程`
```

**修改后**：
```markdown
**有一条不满足 → 不允许标記得完成**，先改到满足。

准出全部通过后，编辑 `tasks.md` 将该任务条目的 `- [ ]` 改为 `- [x]`，完成标记。

遇到阻塞时 **AskQuestion**：`提供补充说明` / `回到 Phase1 修改提案` / `跳过此任务`（标记 `[~]`） / `终止流程`
```

### 对齐说明

此修改使 `opsx-dev-pipeline` 的 Phase 2 与 `openspec-apply-change` 独立 Skill 的指令保持一致：

| 指令 | `openspec-apply-change` | `opsx-dev-pipeline` Phase 2 |
|---|---|---|
| 自审查门禁 | ❌ 无 | ✅ 有（12 项） |
| `[ ]` → `[x]` 编辑指令 | ✅ 有 | ✅ **修复后补充** |

两者互补：完整流水线既有严格的自审查门禁，也有明确的文件标记指令。

---

## 验证

1. 修改 `templates/common/skills/opsx-dev-pipeline/references/phase-2-apply.md`
2. 同步修改 `test-space/snake-game/.claude/skills/opsx-dev-pipeline/references/phase-2-apply.md`
3. 在 `test-space/snake-game` 中创建新 change 并执行 `/opsx-dev-pipeline`
4. 进入 Phase 2 后，确认 AI 每完成一个任务就编辑 `tasks.md` 将 `- [ ]` 改为 `- [x]`
5. Phase 2 结束后，检查 `tasks.md` 中所有已完成任务的复选框均为 `[x]`
