---
name: phase-6-merge-push
description: 全局步骤 17–22（预提交 5a/5b、提交决策点 5、推送 5c、合并决策点 6、合并后、最终摘要）。须先完成 phase-5-unit-tests.md 步骤 16 与 phase-4-archive.md 步骤 12–16；步骤 22 后主干结束。支持三种交付模式：push_only / local_merge / pr。
compatibility: 需要 git、可访问的 remote（推送/拉取）；Cursor 中推荐 AskQuestion。
---

## Phase 6: 提交合并推送 (Merge & Push)

本 Phase 对应全局 **步骤 17–22**。须先完成 `phase-5-unit-tests.md` **步骤 16** 与 `phase-4-archive.md` **步骤 12–16**。

---

### 交付模式分发

在进入步骤 17 之前，必须先确定当前交付模式。交付模式的优先级：

1. 若 `openspec/runtime-state.yaml` 已存在且包含 `delivery_mode` → 以该值为准（续接场景）
2. 否则，以用户在 **决策点 4** 中的选择为准
3. 若两者均未设定 → **AskQuestion** 请用户选择

> **互斥规则**（强制）：
> - PR 模式下，Phase 6 **步骤 20（本地 merge）必须被跳过**
> - 本地合并模式下，不得为同一变更执行 `gh pr create` + `gh pr merge`
> - push_only 模式下，步骤 20–21 全部跳过
> - 模式选择写入 `openspec/runtime-state.yaml` → `delivery_mode` 后立即生效

**模式分发逻辑**：

```
读取 delivery_mode
├── push_only    → 执行步骤 17–19 → 步骤 22（最终摘要）。跳过步骤 20–21。
├── local_merge  → 执行步骤 17–22（完整现有流程，与原有行为一致）
└── pr           → 执行步骤 17–19 → 跳转到 Phase 7（phase-7-pr-ci.md）。
                   步骤 20–21 在 PR 模式下被禁止，步骤 22 由 Phase 7 中的对应步骤提供。
```

> 恢复续接：若 runtime state 显示 `current_phase: phase7_*`（PR 已创建/CI 等待中/CI 分诊中），从 Phase 7 恢复，不重新进入 Phase 6。

---

### 步骤 17：预提交检查

1. **基础检查**

    ```bash
    git status
    git branch --show-current
    git stash list
    git fetch origin
    ```

    - 若存在 stash：在摘要中**提示**用户注意，避免与本次提交混淆；不自动 pop

2. **分支同步**

    - 依据 `git status` 对比远程
    - **若落后远程或分支分叉**：使用 **AskQuestion tool**：
        - `执行 git pull --rebase 后继续` — 运行 `git pull --rebase origin <branch>`；若 rebase 产生冲突则提示冲突文件，使用 AskQuestion：`暂停流水线，手动调整后继续` / `git rebase --abort 并终止`
        - `继续后续流程（不先 rebase）` — 继续提交流程，并提示推送阶段可能失败
        - `终止流程` — 退出

3. **敏感路径 / 文件名扫描**

    - 模式示例：`.env`、`.env.local`、`.env.*.local`；路径或文件名含 `secret` / `password` / `credential`；`*.key`、`*.pem`、`*.p12`、`*.jks`；内容明显含 `api_key` / `token`（与凭据连写）的配置文件
    - 对已跟踪的 `application-*.yml` / `application-*.properties`：仅在疑似含明文密钥时告警

4. **若检测到敏感文件**

    - 列出文件并使用 **AskQuestion tool**：
        - `排除敏感文件后继续后续流程` — 使用 `git reset HEAD <敏感文件>` 从暂存区移除后提交
        - `继续后续流程（包含敏感文件）` — 用户确认风险后继续
        - `终止流程` — 退出

### 步骤 18：暂存变更并提交

1. **暂存**

    ```bash
    git add -A
    ```

    - 排除不应提交的文件（编译产物 `target/`、IDE 配置 `.idea/`、日志 `*.log`），用 `git reset HEAD <file>` 移除
    - 始终包含 openspec 文件（archive、specs、review）

2. **提交信息**

    - 根据变更含义选择 **conventional commit** 类型（示例）：`feat`、`fix`、`perf`、`refactor`、`docs`、`test`、`chore`、`style`、`ci`；单行描述简明；可多行正文
    - 若目标仓库的 `CONTRIBUTING` / `CLAUDE.md` / 团队模板另有格式，从其规定

3. **默认正文（可选用）**

    ```
    Co-Authored-By: Claude <noreply@anthropic.com>
    ```

    （若团队禁用 Co-Authored-By 或改用其他署名方式，按仓库约定调整。）

4. **展示提交信息并使用 AskQuestion：[决策点 5]**

    **选项：**

    - `确认提交` — 使用生成的信息提交
    - `修改提交信息` — 通过文本消息向用户询问自定义提交信息（不使用 AskQuestion tool），等待用户回复后使用其输入的信息提交
    - `终止流程` — 不提交，展示恢复指引后退出（用户可稍后**从 Phase 5 `phase-5-unit-tests.md` 步骤 16 或本 Phase 步骤 17 起**自行执行单测确认、暂存、提交与推送）

5. **若无任何可提交变更**（已无 diff、且工作区干净）

    - 告知用户并结束本 Phase，不强行 `git commit`

6. **执行提交**（使用 heredoc）

    ```bash
    git commit -m "$(cat <<'EOF'
    <commit-message>
    EOF
    )"
    ```

### 步骤 19：推送到远程

```bash
git push origin <current-branch>
```

- **若推送失败**：使用 **AskQuestion tool**：
    - `执行 pull --rebase 后重试` — 运行 `git pull --rebase origin <branch>`；若 rebase 产生冲突，提示冲突文件并使用 AskQuestion：`暂停流水线，手动调整后继续`（用户解决后运行 `git rebase --continue` + 重新 push）/ `git rebase --abort 并终止`；若 rebase 成功，重新 push
    - `终止流程` — 退出（提示：提交若已保存在本地，可稍后执行 `git push origin <branch>`，步骤同本 Phase **步骤 19**）

### 步骤 20：[决策点 6] 合并分支

**前提**：仅当 `delivery_mode = local_merge` 且用户在 **决策点 4** 选择「提交代码并合并」时执行本步骤。

**PR 模式下禁止**：若 `delivery_mode = pr`，本步骤不得执行。PR 模式下的合并操作由 Phase 7（`phase-7-pr-ci.md`）中的 `gh pr merge` 处理。

#### 合并前自检（对齐内联合并流程）

- 运行 `git status`：须无未暂存/未提交变更（除非当前流程与用户选择明确允许留有 WIP）；若有，**AskQuestion**：`先 stash 再继续` / `先提交再继续` / `终止流程`；若用户不希望在此阶段处理，则应结束当前尝试并保留恢复指引
- 记录源分支名 `<source-branch>`（当前分支）
- **若**存在 `origin/<source-branch>`：**建议** `git log origin/<source-branch>..HEAD --oneline` 无未推送提交再合并；若有未推送提交，**AskQuestion** 是否在合并前补跑 **步骤 19** 推送或仍继续（并说明风险）
- 在满足 **步骤 19** **门禁**前提下再执行后续步骤：进入本步前应尽量保证 **步骤 19** 已成功 push；若仅因网络未完成 push，应先处理或由用户确认再继续

#### 选择目标分支与合并策略

- 列出可用分支（`git branch -a`），使用 **AskQuestion tool** 询问目标分支

    **选项（根据实际存在的分支动态生成）：**

    - `master` / `main`（若存在）
    - `qa`（若存在）
    - `stg`（若存在）
    - `develop`（若存在）
    - `其他（手动输入）`

- 使用 **AskQuestion tool** 询问合并策略：
    - `Standard merge` — 标准合并（推荐默认）
    - `Squash merge` — 压缩合并
    - `No-ff merge` — 非快进合并

  合并策略选择属于附录定义的 **A 类：必须用户确认**；`Standard merge` 仅为推荐项，不得静默代选。

#### 更新目标分支并合并

```bash
git fetch origin <target-branch>
git checkout <target-branch>
git pull origin <target-branch>
```

依据所选策略执行：

- **Standard merge**：`git merge <source-branch> -m "Merge branch '<source-branch>' into <target-branch>"`
- **Squash merge**：`git merge --squash <source-branch>` → `git commit -m "Merge branch '<source-branch>' into <target-branch> (squashed)"`
- **No-ff merge**：`git merge --no-ff <source-branch> -m "Merge branch '<source-branch>' into <target-branch>"`

合并成功后推送并切回：

```bash
git push origin <target-branch>
git checkout <source-branch>
```

#### 若出现冲突

- 先运行 `git diff --name-only --diff-filter=U` 列出冲突文件
- 使用 **AskQuestion tool**：该分支属于附录定义的 **A 类：必须用户确认**；`theirs` / `ours` / `中止合并` 均不得默认执行
    - `中止合并` — 执行 `git merge --abort` + `git checkout <source-branch>`，展示恢复指引后退出
    - `使用对方版本 (theirs)` — 执行 `git checkout --theirs .` + `git add .` 后继续 push
    - `使用我方版本 (ours)` — 执行 `git checkout --ours .` + `git add .` 后继续 push
    - `暂停，手动解决` — 展示冲突文件列表，提示用户手动解决后执行 `git add .` → `git commit` → `git push origin <target-branch>` → `git checkout <source-branch>`，然后退出；用户后续可从 **步骤 20** 继续

### 步骤 21：合并后操作

合并成功后，使用 **AskQuestion tool**：

- `保留源分支（推荐默认）` — 不做额外操作
- `删除本地和远程源分支` — 执行 `git branch -d <source>` + `git push origin --delete <source>`，并留在目标分支

该决策点属于附录定义的 **A 类：必须用户确认**；保留源分支只作为推荐项，删除分支不得默认。

### 步骤 22：展示最终摘要

根据实际执行路径动态生成摘要（跳过的阶段标记为「⏭️ 已跳过」），包含：

- change 名称、归档路径、审查报告路径（含多轮 round 文件）
- 各阶段状态表（提案/应用/审查/归档/**单元测试**/提交/合并）
- **决策点 4b** 选择（需要单测 / 跳过）及若适用时的测试命令与结果概要
- 提交信息和变更统计（文件数、新增行、删除行）
- **交付模式**与下一动作：
  - `push_only` → 流水线完成
  - `local_merge` → 流水线完成（已合并到目标分支）
  - `pr` → 引导用户进入 Phase 7（`phase-7-pr-ci.md`），或提示 PR 已创建/CI 状态/合并完成
