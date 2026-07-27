# 流水线 `.pipeline-state` 最终状态未提交问题 — 修复方案

> 日期: 2026-07-27 | 状态: 待实现

---

## 问题描述

在 Phase 6 流水线中，Step 21 执行 `git add openspec/` + `git commit`，此时 `.pipeline-state/<change>.json` 被提交到仓库。但此后 Steps 22-26 的所有状态更新仅写入磁盘，**永远不会被提交到 git**。

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

**根因**：Step 21 的提交发生在所有 delivery 状态更新之前，导致 git 中的状态文件停留在 Phase 5 结束时的快照（甚至 `delivery.commitSha` 都是 null），而非最终的交付完成状态。

---

## 推荐方案：Step 26 末尾追加补充提交

### 方案选择

| 方案 | 描述 | 评价 |
|------|------|------|
| A. Step 26 末尾追加提交 | `complete` 后再 commit + push 状态文件 | ✅ 推荐：最小改动，逻辑自然 |
| B. 新建 Step 27 | 独立步骤提交状态 | ❌ 需修改步骤索引表、交叉引用 |
| C. amend Step 21 的提交 | `complete` 后 `git commit --amend` | ❌ 已推送，需 force push（被禁止） |
| D. Step 21 排除 .pipeline-state | 最后单独提交状态文件 | ❌ 实现复杂，`git add openspec/` 会包含它 |

### 选择方案 A 的理由

- 仅修改 1 个文件：`phase-6-merge-push.md.hbs`
- `complete` 设置 `status: 'completed'`，状态提交是其自然延伸
- 不需要修改 `dev-pipeline-state.mjs` 或任何脚本
- 无需修改步骤索引表、SKILL.md phase 引用表、其他 Phase 文档的交叉引用

---

## 具体修改

### 文件：`templates/common/skills/opsx-dev-pipeline/references/phase-6-merge-push.md.hbs`

在现有 Step 26 末尾追加以下子步骤：

```markdown
### 提交最终流水线状态

Steps 22-26 均修改了 `openspec/.pipeline-state/<name>.json`（记录 push、合并、标签和完成状态），
但 Step21 的提交仅包含修改前的状态文件。必须创建一个补充提交将这些变更纳入仓库。

1. 展示状态文件与上一次提交的差异：
   ```bash
   git diff HEAD -- openspec/.pipeline-state/<name>.json
   ```

2. 确认当前分支（恢复上下文）：
   - **local-only** 或 **push-only** 应位于 source branch。
   - **merge** 应位于 target branch。
   分支不符合预期时暂停并询问。

3. 询问：`确认提交更新后的流水线状态文件` / `跳过（状态文件不入库）` / `终止流程`。确认后：

   ```bash
   git add openspec/.pipeline-state/<name>.json
   git commit -m "chore(<change-name>): finalize pipeline delivery state"
   ```

   hook 失败时修复后重试；`--no-verify` 必须作为新的高风险决策单独确认。

4. 推送按交付模式决定：

   - **local-only**：不推送，流程结束。
   - **push-only**：询问 `推送最终状态到 source branch` / `暂不推送` / `终止流程`。确认后：
     ```bash
     git push origin "<source-branch>"
     ```
   - **merge**：询问 `推送最终状态到 target branch` / `暂不推送` / `终止流程`。确认后：
     ```bash
     git push origin "<target-branch>"
     ```

   推送失败不得自动 rebase。先 fetch 并展示 ahead/behind，
   再询问 `pull --rebase`、保持本地等待人工处理或终止。

5. 推送成功后最终确认：
   ```bash
   node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs get "<name>"
   ```
```

---

## 交付模式矩阵

| 交付模式 | 状态提交所在分支 | Push 目标 | 备注 |
|---------|-----------------|-----------|------|
| `local-only` | source branch | 不推送 | Step 22-25 已跳过 |
| `push-only` | source branch | `origin/<source>` | Step 23-25 已跳过 |
| `merge` | target branch | `origin/<target>` | 所有 Step 均执行 |

---

## 边界情况分析

| 场景 | 处理方式 |
|------|---------|
| 状态文件无变更（空 diff） | `complete` 始终写入 `status` 和 `updatedAt`，diff 不会为空；若意外为空则跳过提交 |
| 工作区有其他未提交文件 | `git add` 仅针对单个状态文件路径，安全规则已禁止 `git add -A` |
| 用户拒绝推送 | 允许"暂不推送"，状态提交保留在本地 |
| Squash merge（Step 23） | Step 21 的提交被 squash，但状态提交作为独立 commit 在 merge commit 之上，语义正确 |
| 用户曾拒绝 Step 22/24 推送 | 拒绝推送会触发暂停，不会到达 Step 26；到达 Step 26 意味着之前的推送均已成功 |
| 分支不匹配 | 子步骤 2 显式校验当前分支，不符合预期时暂停 |

---

## 不需要修改的文件

- **`dev-pipeline-state.mjs`** — 所有命令（`set`、`complete`）已正确工作，`saveState` 保证原子写入
- **`SKILL.md.hbs`** — 步骤索引和 Phase 引用表不变
- **其他 Phase reference 文件** — 无交叉引用影响

---

## 可选：测试框架同步更新

如需保持测试框架与模板行为一致（非阻塞）：

- **`test-pipeline/src/harness/DeterministicPipelineExecutor.ts`**（约 216-266 行）：
  在 `complete` 后模拟 `git add` + `git commit` + 按模式 push

- **`test-pipeline/src/validators/PhaseValidators.ts`**（约 225-306 行）：
  `validatePhase6` 中对最终状态提交增加断言（如验证 git log 中存在状态提交、work tree clean）

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
