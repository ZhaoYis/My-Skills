# 流水线 `.pipeline-state` 最终状态未提交问题 — 修复方案

> 日期: 2026-07-27 | 状态: 已实现（3/3）

---

## 问题描述

在原 Phase 6 流水线中，Step 21 执行 `git add openspec/` + `git commit`，此时 `.pipeline-state/<change>.json` 被提交到仓库。但此后 Steps 22-26 的所有状态更新仅写入磁盘，**永远不会被提交到 git**。当前流程已拆为 Phase 6（Step 20-22）和 Phase 7（Step 23-26）。

### 问题追溯

| 步骤 | 操作 | 状态变更 | 是否提交 |
|------|------|---------|---------|
| Step 21 | `git add openspec/` + `git commit` | — | ✅ 提交了 Phase 5 结束时的状态快照 |
| Step 21 (commit 后) | `set delivery.commitSha` | 写入磁盘 | ❌ 未提交 |
| Step 22 | `set delivery.sourcePushed` | 写入磁盘 | ❌ 未提交 |
| Step 23 | `set delivery.mergeCommitSha` | 写入磁盘 | ❌ 未提交 |
| Step 24 | `set delivery.targetPushed` | 写入磁盘 | ❌ 未提交 |
| Step 25 | `set delivery.tag` | 写入磁盘 | ❌ 未提交 |
| Step 26 | `complete` → `status: 'completed'` | 写入磁盘 | ❌ 未提交 |

**根因**：Step 21 的提交发生在所有 delivery 状态更新之前，导致 git 中的状态文件停留在半成品状态，甚至 `delivery.commitSha` 都是 null。

---

## 设计决策汇总

| # | 决策 | 结论 |
|---|------|------|
| 1 | `.pipeline-state` 是否提交？ | **必须提交**，是统计/看板数据源 |
| 2 | Step 21 + Step 26 两次提交 vs 仅 Step 26 一次？ | **仅一次**：Step 21 排除 `.pipeline-state/`，Step 26 一次性提交完整状态 |
| 3 | 用户能否跳过状态提交？ | **不能**：去掉「跳过」选项，只保留「确认提交」/「终止」 |
| 4 | merge 模式 tag 需覆盖状态文件？ | **是**：状态提交必须在 tag 创建之前 |
| 5 | 防止误提交其他文件？ | **需要**：提交前 `git diff --cached --name-only` 检查 |
| 6 | 中断恢复幂等性？ | **需要**：结合 `git log`、完成状态和 `git diff --quiet` 检查是否已完整提交 |
| 7 | push 失败处理？ | 复用现有 `pause` 机制 |
| 8 | 是否需要追加 phase history 记录？ | **不需要**：`status: 'completed'` + `updatedAt` 已记录交付时间 |
| 9 | 是否需要改 `dev-pipeline-state.mjs`？ | **不需要**：职责单一，git 操作由模板引导 |
| 10 | Squash merge 兼容？ | **不需要特殊处理**：状态提交作为独立 commit 跟在 squash commit 之后 |
| 11 | 目标分支保护规则？ | **不需要特殊处理**：现有 `pause` 机制已覆盖 |
| 12 | 测试框架同步更新？ | **一起做** |

---

## 调整后的执行顺序

| 步骤 | local-only | push-only | merge |
|------|-----------|-----------|-------|
| Step 21 | 提交代码（**排除 `.pipeline-state/`**）| 同左 | 同左 |
| Step 22 | 跳过 | push source | push source |
| Step 23 | 跳过 | 跳过 | merge → target |
| Step 24 | 跳过 | 跳过 | push target |
| **Step 26 前置** | **complete + commit state** | **complete + commit state + push state** | **complete + commit state + push state** |
| Step 25 | 跳过 | 跳过 | **创建 tag** ← tag 覆盖完整状态 ✅ |
| Step 26 收尾 | 展示摘要 | 展示摘要 | 展示摘要 |

> ⚠️ **merge 模式注意**：Step 26 的状态提交 + push 必须在 Step 25 创建 tag 之前完成，确保 tag 覆盖完整的流水线状态文件。

---

## 具体修改

### ✅ 文件 1：`templates/common/skills/opsx-dev-pipeline/references/phase-6-commit-push.md.hbs` 与 `phase-7-merge-deliver.md.hbs`

#### Step 21 变更

将现有暂存命令改为排除 `.pipeline-state/`：

```diff
  git add -u
  git add openspec/
+ git reset -- openspec/.pipeline-state/
  git status --porcelain
```

#### Step 26 重写

现有 Step 26 仅包含 `complete` + 展示摘要。重写为三部分：完成流水线 → 提交流水线状态 → 推送 + 摘要。

```markdown
## Step26：完成状态、提交流水线记录与摘要

### 26.1 完成流水线

只有以下交付结果之一成立时才执行 `complete`：仅本地提交完成、source push 完成、或 target push 完成。

恢复执行时先读取状态，并检查最后一次状态提交和工作区差异。只有状态已经是 `completed`、commit message 包含 `finalize pipeline delivery state`，且状态文件相对 HEAD 无差异时，才跳过 26.1 和 26.2；不要先重复调用 `complete`，以免仅因刷新 `updatedAt` 产生多余提交。

```bash
node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs complete "<name>"
```

### 26.2 提交最终流水线状态

> ⚠️ **merge 模式**：请在本步骤（提交状态 + push）完成后再执行 Step25 创建 tag，
> 确保 tag 覆盖完整的流水线状态文件。

Steps 22-26 均修改了 `openspec/.pipeline-state/<name>.json`
（记录 push、合并、标签和完成状态），但 Step21 的提交已将 `.pipeline-state/` 排除。
必须创建一个独立的提交将这些变更纳入仓库。

1. **幂等性检查**——确认状态文件是否已被提交：

   ```bash
   git log -1 --format="%s" -- openspec/.pipeline-state/<name>.json
   git diff --quiet HEAD -- openspec/.pipeline-state/<name>.json
   ```

   如果返回的 commit message 包含 `finalize pipeline delivery state`，且 `git diff --quiet` 返回 0，
   说明状态已提交过 → 跳过 26.2，直接进入 26.3。
   如果返回其他提交、空（文件从未被 commit），或状态文件仍有差异，继续执行以下步骤。

2. 展示状态文件变更：

   ```bash
   git diff HEAD -- openspec/.pipeline-state/<name>.json
   ```

3. 确认当前分支（恢复上下文）：
   - **local-only** 或 **push-only** 应位于 source branch。
   - **merge** 应位于 target branch。
   分支不符合预期时暂停并询问。

4. **询问**：`确认提交最终流水线状态` / `终止流程`。确认后备注"用户已确认提交状态文件"并继续。

   > 注意：不提供「跳过」选项——`.pipeline-state` 是统计与看板的数据源，跳过即数据丢失。

5. 暂存并检查：

   ```bash
   git add -f -- openspec/.pipeline-state/<name>.json
   git diff --cached --name-only
   ```

   如果输出多于一个文件，暂停并询问用户：是只提交状态文件（`git reset` 其他文件），还是一起提交。

6. 提交：

   ```bash
   # 将 <change-name> 替换为当前 change 的实际名称（即 get "<name>" 中的 name）
   git commit -m "chore(<change-name>): finalize pipeline delivery state"
   ```

   hook 失败时修复后重试；`--no-verify` 必须作为新的高风险决策单独确认。

### 26.3 推送与摘要

1. **推送**按交付模式决定：

   - **local-only**：不推送，进入摘要。
   - **push-only**：询问 `推送最终状态到 source branch` / `终止流程`。确认后：
     ```bash
     git push origin "<source-branch>"
     ```
   - **merge**：询问 `推送最终状态到 target branch` / `终止流程`。确认后：
     ```bash
     git push origin "<target-branch>"
     ```

   推送失败不得自动 rebase。先 fetch 并展示 ahead/behind，
   再询问 `pull --rebase`、保持本地等待人工处理或终止。
   若最终无法推送成功，调用 `pause "<name>" "state-commit-push-failed"`。

2. **推送成功后最终确认**：

   ```bash
   node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs get "<name>"
   ```

3. **展示摘要**：change、归档路径、审查报告、测试/verify 结果、各决策、提交 SHA、
   source/target push、合并策略、分支清理和标签结果。
   跳过项明确标记，不得用"完成"掩盖暂停或失败。
```

#### Step 25 增加前置提示

merge 模式在 Step 26.1 预先确认并记录计划创建的标签名；最终状态提交和 target push 完成后，Step 25 再创建并推送该标签。这样最终状态文件包含 `delivery.tag`，标签也会指向最终状态提交。

在 Step 25 开头增加提示：

```markdown
> ⚠️ **merge 模式前置条件**：请确认 Step26 的状态提交与推送已完成，
> 再继续本步骤创建 tag。确保 tag 覆盖完整的流水线状态文件。
```

---

### ✅ 文件 2：`test-pipeline/src/harness/DeterministicPipelineExecutor.ts`

在 `complete` 调用后追加 git 状态提交操作（约 216-266 行区域）：

```typescript
// After complete:
// Commit the finalized pipeline state file
await git(env, 'add', '-f', '--', `openspec/.pipeline-state/${changeName}.json`);
await git(env, 'commit', '-m', `chore(${changeName}): finalize pipeline delivery state`);

// Push per delivery mode
if (postArchiveAction === 'push-only') {
  await git(env, 'push', 'origin', env.sourceBranch);
} else if (postArchiveAction === 'merge') {
  await git(env, 'push', 'origin', env.targetBranch);
}
// local-only: no push
```

---

### ✅ 文件 3：`test-pipeline/src/validators/PhaseValidators.ts`

更新 `validatePhase6` 和 `validatePhase7` 断言：

1. **新增**：验证状态提交存在：

```typescript
{
  description: 'Final pipeline state commit exists in git log',
  passed: stateCommitMessage.includes('finalize pipeline delivery state'),
}
```

2. **merge 模式**：`currentBranch === env.targetBranch && status.isClean` 改为仅验证分支正确（去掉 `isClean`——因为 Step 26 的 commit 之后可能还有其他无变更状态，但 tag 指向的 commit 后 work tree 可能不 clean）：

```typescript
// merge 模式：
{
  description: 'Delivery finishes on the target branch',
  passed: currentBranch === env.targetBranch,
}
```

3. **push-only 模式**：同样去掉强制 `isClean` 断言。

---

## 交付模式矩阵

| 交付模式 | 状态提交所在分支 | Push 目标 | 备注 |
|---------|-----------------|-----------|------|
| `local-only` | source branch | 不推送 | Step 22-25 已跳过 |
| `push-only` | source branch | `origin/<source>` | Step 23-25 已跳过 |
| `merge` | target branch | `origin/<target>` | 状态提交在 tag 之前 |

---

## 边界情况

| 场景 | 处理方式 |
|------|---------|
| 状态文件无变更（空 diff） | `complete` 始终写入 `status` 和 `updatedAt`，不会为空 |
| 工作区有其他未提交文件 | `git diff --cached --name-only` 检查，多于一个文件时暂停 |
| 中断恢复（complete 成功但提交失败） | 结合 `git log`、完成状态和 `git diff --quiet` 做幂等性检查 |
| 用户拒绝状态提交 | 不再提供此选项，只允许确认或终止 |
| Squash merge | 状态提交作为独立 commit 跟在 squash commit 之后，不影响 |
| 目标分支受保护 | push 失败 → `pause`，现有机制已覆盖 |
| 分支不匹配 | Step 26.2 子步骤 3 显式校验 |
| 推送失败（网络/权限） | `pause "state-commit-push-failed"`，后续恢复 |

---

## 不需要修改的文件

- **`dev-pipeline-state.mjs`** — 所有命令已正确工作，职责单一
- **`SKILL.md.hbs`** — 步骤索引和 Phase 引用表不变
- **其他 Phase reference 文件** — 无交叉引用影响
- **`mutablePaths`** — 不需要新字段

---

## 验证方式

```bash
# 1. 构建
npm run build

# 2. 全量测试
npm test
npm run test:pipeline

# 3. 手动验证（在 test-space/snake-game 中）
cd test-space/snake-game
# 执行完整流水线后检查：
git log --oneline -3
# 应包含 "chore(<change-name>): finalize pipeline delivery state" 提交
git show HEAD -- openspec/.pipeline-state/<change-name>.json
# 应包含完整的 delivery 字段和 status: 'completed'
```
