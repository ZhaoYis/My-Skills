---
name: opsx-dev-pipeline
description: 需求开发全流程一站式执行：提案编写(propose) → 提案应用(apply) → 代码审查(review) → 提案归档(archive) → 代码提交合并推送(merge&push)。提案阶段须与用户确认方案与原始需求一致后方可进入实施；关键环节提供选项让用户决策。适用于用户希望一键完成从需求到合并的完整开发周期。
license: MIT
compatibility: Requires openspec CLI and git CLI.
metadata:
  author: zhaoyi
  version: "1.3"
---

# 需求开发全流程流水线

一站式完成从需求描述到代码合并的完整开发周期，在关键环节提供明确选项让用户决策。

**流程概览：**

```
[入口判断] → 提案编写(Propose) ⇄ 用户确认方案符合原始需求 → 提案应用(Apply) → …
         ↘ 已有change → 从对应阶段继续 ↗
```
（`⇄`：未确认前可在 Propose 内多轮对话与改稿，**不得**进入 Apply。）

**重要：** 所有输出使用中文。

---

**Input**: 用户的需求描述，或一个已有的 change 名称。

**Steps**

## Phase 0: 入口判断

1. **环境预检**

   ```bash
   openspec --version
   git rev-parse --is-inside-work-tree
   ```

   - 如果 openspec CLI 不可用：提示安装方式并退出
   - 如果不在 git 仓库中：提示 `git init` 并退出

2. **判断入口类型**

   **a. 用户提供了已有 change 名称：**
   - 运行 `openspec status --change "<name>" --json` 检查 change 状态
   - 如果 change 不存在：提示名称错误，运行 `openspec list --json` 展示可用 change，让用户重新选择
   - 如果 change 存在，根据制品和任务状态判断应从哪个阶段继续：
     - `applyRequires` 制品未全部完成 → 从 **Phase 1 Step 3** 继续（检查哪些制品处于 `ready` 状态，仅对未完成的制品执行生成流程，已完成的制品保持不变）
     - 制品已完成但任务未全部完成 → 从 **Phase 2** 继续实施
     - 任务已全部完成 → 从 **Phase 3** 开始审查
   - 使用 **AskQuestion tool** 确认：
     - `从 Phase X 继续` - 按判断结果继续
     - `从头开始（新建 change）` - 向用户询问新的 change 名称，走完整 Phase 1（原 change 保留不动）
     - `终止流程` - 退出

   **b. 用户提供了需求描述：**
   - 从描述中推导出 kebab-case 的 change 名称
   - 进入 **Phase 1**

   **c. 用户未提供任何输入：**
   - 直接向用户发送文本消息询问（不使用 AskQuestion tool，因为此处需要自由文本输入）：
     > "请描述您要实现的需求或功能，或输入已有 change 名称。"
   - 等待用户回复后，根据回答判断走 a 或 b 路径

---

## Phase 1: 提案编写 (Propose)

3. **创建 change 并生成制品**

   **a. 如果是从 Phase 0 Step 2a 续接已有 change**：跳过创建，直接执行 `openspec status --change "<name>" --json`，仅对未完成的制品执行生成流程。

   **b. 如果是新建 change**：

   ```bash
   openspec new change "<name>"
   ```

   **如果 change 名称已存在**：使用 **AskQuestion tool** 询问：
   - `在已有 change 上继续` - 按 3a 路径处理（跳过创建，续接制品生成）
   - `创建新名称` - 向用户发送文本消息询问新名称，获取后重新创建

   ```bash
   openspec status --change "<name>" --json
   ```

   按依赖顺序创建制品：对每个 `ready` 状态的制品，运行 `openspec instructions <artifact-id> --change "<name>" --json` 获取指令，读取依赖制品，按 `template` 结构创建文件。已完成的制品保持不变。循环直到所有 `applyRequires` 制品完成。

   使用 **TodoWrite tool** 跟踪各制品进度。

4. **[决策点 1] 确认提案（Apply 前置门禁，必过）**

   **硬性规则：在用户明确选择「确认提案，开始实施」之前，禁止进入 Phase 2（Apply）、禁止开始改代码或执行 `openspec instructions apply`。**

   **展示内容（须覆盖「是否做对事」而不仅是「生成了哪些文件」）：**
   - 用简短条目 **对照用户原始需求**：范围（接口/模块/数据）、关键行为、非目标与假设；
   - 再展示各制品摘要（`proposal.md` / `design.md` / delta `specs` / `tasks.md` 各用一两句话概括要点）。

   **先使用 AskQuestion tool** 询问（选项固定如下，**不得**用 AskQuestion 代替用户对「是否符合预期」的自由表述——若用户选「不符合」类，须继续用文字对话）：

   **选项：**
   - `确认提案，开始实施` - 仅当用户判断提案与原始任务要求**已一致**时选择；进入 Phase 2
   - `提案不符合预期，我要补充/修改` - **不**使用 AskQuestion 收集细节：通过**文本对话**请用户说明差距（缺什么、错什么、要增删哪些点）；根据反馈**直接改** `openspec/changes/<name>/` 下对应制品（proposal / design / specs / tasks），必要时重跑 Step 3 中未就绪的制品生成逻辑；改完后**回到本决策点**，重新展示对照摘要并再次 AskQuestion。**重复直到用户选择「确认提案，开始实施」或「终止流程」**（不设次数上限，以「与原始需求一致」为准；若多轮仍无法对齐，应主动建议暂停、缩小范围或拆分 change，由用户选择是否终止）
   - `终止流程` - 退出流水线

   **执行注意：**
   - 用户若仅在聊天里说「再改一下 xxx」而未点选项，视为走「补充/修改」路径：先改制品，再展示并**仍然**用 AskQuestion 给出上述三选项，避免跳过显式确认。
   - 续接已有 change（Phase 0 Step 2a）且制品已存在时：**同样**须经过本决策点；若用户认为历史提案过时，应先按对话结果更新制品再走确认。

---

## Phase 2: 提案应用 (Apply)

5. **获取实施指令并读取上下文**

   ```bash
   openspec instructions apply --change "<name>" --json
   ```

   **处理返回状态：**
   - `state: "blocked"`（缺少制品）→ 使用 **AskQuestion tool** 询问：
     - `回到 Phase 1 补充制品` - 回到 Step 3a 续接制品生成
     - `终止流程` - 退出
   - `state: "all_done"` → 所有任务已完成，跳到 Phase 3
   - 其他 → 读取 `contextFiles` 中的所有上下文文件，继续实施

6. **逐任务实施**

   遍历 tasks.md 中的待办任务，逐个实施：
   - 展示当前任务进度："正在实施任务 N/M: <任务描述>"
   - 执行代码变更（编写代码时遵循 `pprod-code-auto-gen` 技能的规范）
   - 标记任务完成：`- [ ]` → `- [x]`
   - 继续下一个任务

   **如果遇到阻塞**（任务不明确、设计缺陷等），使用 **AskQuestion tool** 询问：
   - `提供补充说明` - 用户补充后继续当前任务
   - `跳过此任务` - 在 tasks.md 中标记为 `- [~] <任务描述> (已跳过)`，继续下一个任务
   - `终止流程` - 退出流水线（提供恢复指引）

7. **[决策点 2] 实施完成确认**

   所有任务完成后，展示实施摘要（完成任务数、跳过任务数、变更文件列表），使用 **AskQuestion tool** 询问：

   **选项：**
   - `进入代码审查` - 进入 Phase 3
   - `暂停流水线，手动调整后继续` - 展示恢复指引后退出，用户调整完后重新触发 pipeline 并传入 change 名称即可从 Phase 3 继续
   - `跳过审查，直接归档` - 跳到 Phase 4
   - `终止流程` - 退出流水线

---

## Phase 3: 代码审查 (Review)

8. **加载项目规范**

   读取 `openspec/project.md` 获取项目技术栈、架构规则、命名规范等。

   **如果 `openspec/project.md` 不存在**：输出警告"未找到 openspec/project.md，将使用 CLAUDE.md 中的默认规范"，使用 CLAUDE.md 中的规范继续。

9. **获取变更内容**

   使用 `git diff HEAD` 获取全部未提交变更（包含 unstaged + staged），同时用 `git diff --stat HEAD` 获取变更统计。

   **如果没有未提交变更**，检查是否有未推送的提交：
   ```bash
   git rev-parse --verify origin/<current-branch> 2>/dev/null
   ```
   - 如果远程跟踪分支存在：运行 `git log origin/<current-branch>..HEAD --oneline` 检查未推送提交
     - 有未推送提交：使用 `git diff origin/<current-branch>..HEAD` 审查
     - 无未推送提交：提示"没有需要审查的变更"，跳到 Phase 4
   - 如果远程跟踪分支不存在（分支从未推送过）：使用 `git log --oneline -20` 列出近 20 条提交供参考，提示"当前分支尚未推送到远程，建议先完成提交推送后再审查"，跳到 Phase 4

10. **执行代码审查**

    按照 `git-code-review` 技能的审查标准执行：
    - 敏感信息扫描
    - 技术栈合规性（Java 8 兼容性等）
    - 分层架构合规性（Web → Biz → Core → Common）
    - 命名规范、注解使用、代码风格、错误处理
    - 对象转换（MapStruct）、事务管理、安全性与性能

    保存审查报告到 `openspec/review/`：
    - 文件名：`YYYY-MM-DD-HH:mm-<branch-name>-pipeline-review.md`
    - 多轮审查时追加轮次后缀：`-round-2.md`、`-round-3.md`

11. **[决策点 3] 审查结果处理**

    展示审查摘要（问题统计 + 报告路径），根据审查结果提供不同选项：

    **如果发现严重或重要问题**，使用 **AskQuestion tool** 询问：

    **选项：**
    - `生成修复提案并应用` - 基于 CR 结果走完整 propose → apply → 归档修复 change → 重新审查
    - `直接修复并重新审查` - 不走提案流程，直接在当前代码上修复后重新审查
    - `暂停流水线，手动修复后继续` - 展示恢复指引后退出，用户修复完后重新触发 pipeline 传入 change 名称
    - `忽略问题，继续归档` - 跳过修复，进入 Phase 4
    - `终止流程` - 退出流水线

    **如果仅有一般问题或建议**，使用 **AskQuestion tool** 询问：

    **选项：**
    - `继续归档` - 进入 Phase 4
    - `生成修复提案并应用` - 基于 CR 结果走完整 propose → apply → 归档修复 change → 重新审查
    - `暂停流水线，手动调整后继续` - 展示恢复指引后退出
    - `终止流程` - 退出流水线

    **如果审查无问题（0 个问题）**：直接进入 Phase 4，不询问。

    ---

    **"生成修复提案并应用"子流程（最多循环 3 轮）：**

    a. 根据审查报告中的问题，构建修复提案描述：
       - 提案名称（kebab-case）：`fix-cr-<主要问题类型>`（如 `fix-cr-security`、`fix-cr-convention`、`fix-cr-mixed`）
       - 多轮时追加轮次：`fix-cr-<type>-round-2`
       - 提案内容包含：问题列表、影响文件、修复方案、审查报告路径引用
    b. 调用 `openspec-propose` 技能创建修复 change 并生成制品
    c. 展示修复提案摘要，使用 **AskQuestion tool** 确认：
       - `确认提案，开始修复` - 继续
       - `修改提案` - 用户说明修改内容后更新
       - `放弃修复，继续归档` - 清理已创建的修复 change（`rm -rf openspec/changes/fix-cr-*` 对应本次创建的），跳过修复，进入 Phase 4
    d. 调用 `openspec-apply-change` 技能逐任务实施修复
    e. 归档修复 change（修复类 change 无 delta specs，跳过同步检查，直接归档）：
       ```bash
       mkdir -p openspec/changes/archive
       mv openspec/changes/fix-cr-<type> openspec/changes/archive/YYYY-MM-DD-fix-cr-<type>
       ```
    f. 重新执行 Step 9-11（代码审查），进入下一轮
    g. 如果 3 轮后仍有严重问题，强制暂停并提示用户手动介入，展示恢复指引后退出

    **"直接修复并重新审查"子流程（最多循环 3 轮）：**

    a. 根据审查问题直接在当前代码上执行修复变更（不创建新 change）
    b. 重新执行 Step 9-11
    c. 如果 3 轮后仍有严重问题，强制暂停，展示恢复指引后退出

---

## Phase 4: 提案归档 (Archive)

12. **检查制品和任务完成状态**

    ```bash
    openspec status --change "<name>" --json
    ```

    读取 tasks.md 检查未完成任务数量。

    **如果存在未完成项**：显示警告并使用 **AskQuestion tool** 确认：
    - `继续归档` - 忽略未完成项，继续
    - `回到实施阶段` - 回到 Phase 2 继续实施
    - `终止流程` - 退出

13. **Delta spec 同步检查**

    检查 `openspec/changes/<name>/specs/` 下是否有 delta specs。

    **如果有 delta specs**：
    - 对比 delta spec 与主 spec（`openspec/specs/<capability>/spec.md`），展示变更摘要
    - 使用 **AskQuestion tool** 询问：
      - `同步到主 specs（推荐）` - 执行同步
      - `不同步，直接归档` - 跳过同步

14. **执行归档**

    ```bash
    mkdir -p openspec/changes/archive
    ```

    生成目标名称 `YYYY-MM-DD-<change-name>`。如果目标已存在，追加 `-N` 后缀。

    ```bash
    mv openspec/changes/<name> openspec/changes/archive/YYYY-MM-DD-<name>
    ```

15. **[决策点 4] 归档后操作**

    使用 **AskQuestion tool** 询问：

    **选项：**
    - `提交代码并合并到目标分支` - 进入 Phase 5 完整流程
    - `仅提交并推送（不合并）` - 进入 Phase 5，执行 commit + push 后结束
    - `终止流程` - 退出流水线（提供恢复指引）

---

## Phase 5: 提交合并推送 (Merge & Push)

16. **预提交检查**

    ```bash
    git status
    git branch --show-current
    git fetch origin
    ```

    检查分支同步状态（`git status` 对比远程）：
    - **如果落后远程或分支分叉**：使用 **AskQuestion tool** 询问：
      - `执行 git pull --rebase 后继续` - 运行 `git pull --rebase origin <branch>`，如果 rebase 产生冲突则提示冲突文件，使用 AskQuestion 询问：`手动解决后继续` / `git rebase --abort 并终止`
      - `忽略，直接提交（推送时可能失败）` - 继续提交流程
      - `终止流程` - 退出

    扫描敏感文件（`.env`、`*.key`、`*.pem`、含 password/secret/token 的文件）。
    **如果检测到敏感文件**：列出文件并使用 **AskQuestion tool** 询问：
    - `排除敏感文件后继续` - 使用 `git reset HEAD <敏感文件>` 从暂存区移除后提交
    - `包含敏感文件继续提交` - 用户确认风险后继续
    - `终止流程` - 退出

17. **暂存变更并提交**

    ```bash
    git add -A
    ```

    排除不应提交的文件（编译产物 `target/`、IDE 配置 `.idea/`、日志 `*.log`），用 `git reset HEAD <file>` 移除。始终包含 openspec 文件（archive、specs、review）。

    根据变更内容生成 conventional commit 信息：
    ```
    <type>: <description>

    Co-Authored-By: Claude <noreply@anthropic.com>
    ```

    展示提交信息，使用 **AskQuestion tool** 询问：

    **[决策点 5] 选项：**
    - `确认提交` - 使用生成的信息提交
    - `修改提交信息` - 选择后，通过文本消息向用户询问自定义提交信息（不使用 AskQuestion tool），等待用户回复后使用其输入的信息提交
    - `取消提交` - 不提交，展示恢复指引后退出（用户稍后可用 `git-commit-push` 技能手动完成）

    执行提交（使用 heredoc）：
    ```bash
    git commit -m "$(cat <<'EOF'
    <commit-message>
    EOF
    )"
    ```

18. **推送到远程**

    ```bash
    git push origin <current-branch>
    ```

    **如果推送失败**，使用 **AskQuestion tool** 询问：
    - `执行 pull --rebase 后重试` - 运行 `git pull --rebase origin <branch>`；如果 rebase 产生冲突，提示冲突文件并使用 AskQuestion 询问：`手动解决后继续`（用户解决后运行 `git rebase --continue` + 重新 push）/ `git rebase --abort 并终止`；如果 rebase 成功，重新 push
    - `终止流程` - 退出（提示：提交已保存在本地，稍后可用 `git push origin <branch>` 手动推送）

19. **[决策点 6] 合并分支（仅当用户在决策点 4 选择"提交代码并合并"时）**

    列出可用分支（`git branch -a`），使用 **AskQuestion tool** 询问目标分支：

    **选项（根据实际存在的分支动态生成）：**
    - `master` / `main`（如果存在）
    - `qa`（如果存在）
    - `stg`（如果存在）
    - `develop`（如果存在）
    - `其他（手动输入）`

    使用 **AskQuestion tool** 询问合并策略：
    - `Standard merge` - 标准合并（默认）
    - `Squash merge` - 压缩合并
    - `No-ff merge` - 非快进合并

    执行合并（先更新目标分支）：
    ```bash
    git fetch origin <target-branch>
    git checkout <target-branch>
    git pull origin <target-branch>
    ```

    根据所选策略执行：
    - **Standard merge**: `git merge <source-branch> -m "Merge branch '<source-branch>' into <target-branch>"`
    - **Squash merge**: `git merge --squash <source-branch>` → `git commit -m "Merge branch '<source-branch>' into <target-branch> (squashed)"`
    - **No-ff merge**: `git merge --no-ff <source-branch> -m "Merge branch '<source-branch>' into <target-branch>"`

    合并成功后推送并切回：
    ```bash
    git push origin <target-branch>
    git checkout <source-branch>
    ```

    **如果出现冲突**，先运行 `git diff --name-only --diff-filter=U` 列出冲突文件，然后使用 **AskQuestion tool** 询问：
    - `中止合并` - 执行 `git merge --abort` + `git checkout <source-branch>`，展示恢复指引后退出
    - `使用对方版本 (theirs)` - 执行 `git checkout --theirs .` + `git add .` 后继续 push
    - `使用我方版本 (ours)` - 执行 `git checkout --ours .` + `git add .` 后继续 push
    - `暂停，手动解决` - 展示冲突文件列表，提示用户手动解决后执行 `git add .` → `git commit` → `git push origin <target-branch>` → `git checkout <source-branch>`，然后退出

20. **合并后操作**

    合并成功后，使用 **AskQuestion tool** 询问：
    - `保留源分支（默认）` - 不做额外操作
    - `删除本地和远程源分支` - 执行 `git branch -d <source>` + `git push origin --delete <source>`，并留在目标分支

21. **展示最终摘要**

    根据实际执行路径动态生成摘要（跳过的阶段标记为"⏭️ 已跳过"），包含：
    - change 名称、归档路径、审查报告路径（含多轮 round 文件）
    - 各阶段状态表（提案/应用/审查/归档/提交/合并）
    - 提交信息和变更统计（文件数、新增行、删除行）

---

**流水线中断与恢复**

在任何决策点选择"终止流程"或"暂停流水线"时，展示：
- change 名称、中断阶段、中断原因
- 各 Phase 完成状态清单（`[x]` 已完成 / `[ ]` 未完成）
- 恢复指引：重新运行此技能传入 change 名称从断点继续，或使用单独技能（`openspec-apply-change`、`git-code-review`、`openspec-archive-change`、`git-commit-push`、`git-merge-branch`）手动完成

---

**Guardrails**

- 本技能内联了各子技能（`openspec-propose`、`openspec-apply-change`、`git-code-review`、`git-commit-push`、`git-merge-branch`）的核心逻辑以保证流水线连贯性；如子技能更新，需同步更新本技能中的对应逻辑
- 每个决策点必须使用 AskQuestion tool 提供明确选项，决策点之间自动执行
- **提案确认门禁**：未经决策点 1 中用户明确选择「确认提案，开始实施」，不得进入 Phase 2；用户提出修改时以对话澄清并改制品，循环直至确认或终止
- 需要自由文本输入时（如用户描述需求、提案修改意见、自定义提交信息），直接通过文本消息询问，不使用 AskQuestion tool
- "暂停流水线"类选项统一行为：展示恢复指引后退出，用户重新传入 change 名称即可从断点续接
- 代码审查修复循环最多 3 轮，超过后强制暂停
- 提案修改以用户确认「与原始需求一致」为终止条件，不设固定次数上限；多轮仍无法对齐时须建议暂停/拆分并由用户决定是否终止
- 编写代码时遵循 `pprod-code-auto-gen` 技能的项目规范
- 始终在提交时包含 openspec 相关文件
- 提交信息使用 conventional commit 格式，包含 Co-Authored-By
- 合并后始终切回源分支（除非用户选择删除源分支）
- 敏感文件检测到时必须警告并确认
- 不使用 `--no-verify` 或 `--force` 除非用户明确要求
- 最终摘要根据实际执行路径动态生成，跳过的阶段标记为"已跳过"
- 多轮审查报告使用 `-round-N` 后缀避免覆盖

**Error Handling**

| 场景 | 处理方式 |
|------|----------|
| openspec CLI 不可用 | 提示安装并退出 |
| 不在 git 仓库中 | 提示初始化并退出 |
| `openspec/project.md` 不存在 | 警告并使用 CLAUDE.md 默认规范继续 |
| change 名称冲突 | 询问复用还是创建新名称 |
| change 不存在 | 列出可用 change 让用户选择 |
| 审查时无变更可审 | 提示并跳到 Phase 4 |
| 推送失败 | 提供 pull --rebase 重试或终止选项 |
| 合并冲突 | 展示冲突文件，提供中止/theirs/ours/手动解决选项 |
| 审查报告目录创建失败 | 提示错误，报告仅输出到对话 |
| 归档目标已存在 | 追加 `-N` 后缀 |
| openspec 命令执行失败或返回非预期格式 | 展示错误输出，使用 AskQuestion tool 询问：重试 / 跳过当前步骤 / 终止流程 |
| openspec 命令超时（>30s 无响应） | 终止命令，提示可能原因（网络、配置），提供重试或终止选项 |

**决策点总览**

| # | 阶段 | 决策内容 | 选项 |
|---|------|----------|------|
| 0 | 入口 | 已有change续接确认 | 从判断阶段继续/从头开始(新名称)/终止 |
| 1 | Propose | 确认提案（Apply 门禁） | 确认开始实施 / 对话修改制品直至一致 / 终止 |
| 1a | Propose | change名称冲突 | 在已有change上继续/创建新名称 |
| 2a | Apply | state=blocked | 回到Phase 1补充制品/终止 |
| 2b | Apply | 任务阻塞 | 补充说明/跳过任务/终止 |
| 2 | Apply | 实施完成后 | 审查/暂停手动调整/跳过审查/终止 |
| 3 | Review | 审查结果处理 | 生成修复提案并应用/直接修复/暂停手动修复/忽略/终止 |
| 3a | Review 子流程 | 修复提案确认 | 确认修复/修改提案/放弃修复(清理change) |
| 4a | Archive | 未完成项处理 | 继续归档/回到实施/终止 |
| 4 | Archive | 归档后操作 | 提交并合并/仅提交推送/终止 |
| 5a | Commit | 分支落后/分叉 | pull --rebase/忽略/终止 |
| 5b | Commit | 敏感文件检测 | 排除后继续/包含继续/终止 |
| 5 | Commit | 确认提交信息 | 确认/修改(文本输入)/取消(退出) |
| 5c | Push | 推送失败 | pull --rebase重试/终止 |
| 6 | Merge | 目标分支+策略 | 分支选择/策略选择 |
| 6a | Merge | 合并冲突 | 中止/theirs/ours/暂停手动解决 |
| 6b | Merge | 合并后操作 | 保留源分支/删除源分支 |

> **注**：编号带字母后缀的为条件触发决策点，仅在对应条件满足时出现。决策点 3a 在每轮修复循环中触发。
