---
name: phase-0-entrance
description: 全局步骤 1–2（环境预检、入口类型与续接确认）。完成后按步骤 2 进入 phase-1-propose.md 步骤 3、phase-2-apply.md 步骤 5 或 phase-3-review.md 步骤 8；新建 change 后从 Phase 1 步骤 3 起；亦可终止。
compatibility: 需要 openspec CLI 与 git；在 git 仓库根目录执行。
---

## Phase 0: 入口判断

**`<SKILL_ROOT>`**：本技能安装根目录（内含 `scripts/`）。下文命令中的占位符须替换为实际绝对路径（与业务仓库路径无关）。**执行 `openspec` / `git` / 下文流水线命令时，当前工作目录仍应为目标 git 仓库根目录**，除非某一步另有说明。

1. **环境预检**

   **优先（一键）**（在目标仓库根目录执行；脚本路径替换 `<SKILL_ROOT>`）：

   ```bash
   bash <SKILL_ROOT>/scripts/opsx-preflight.sh
   ```

   **等价**（无脚本时）：

   ```bash
   openspec --version
   git rev-parse --is-inside-work-tree
   ```

   - 如果 openspec CLI 不可用：提示安装方式并退出
   - 如果不在 git 仓库中：提示 `git init` 并退出

2. **判断入口类型**

   **a. 用户提供了已有 change 名称：**
   - 运行 `bash <SKILL_ROOT>/scripts/opsx-change-status.sh "<name>"`（或 `openspec status --change "<name>" --json`）检查 change 状态
   - 如果 change 不存在：提示名称错误，运行 `bash <SKILL_ROOT>/scripts/opsx-list-changes.sh`（或 `openspec list --json`）展示可用 change，让用户重新选择
   - 如果 change 存在，根据制品和任务状态判断应从哪个阶段继续：
      - `applyRequires` 制品未全部完成 → 从 **Phase 1 Step 3** 继续（检查哪些制品处于 `ready` 状态，仅对未完成的制品执行生成流程，已完成的制品保持不变）
      - 制品已完成但任务未全部完成 → 从 **Phase 2** 继续实施
      - 任务已全部完成且 `openspec/review/` 下无该分支审查报告 → 从 **Phase 3** 开始审查
      - 任务已全部完成且已有审查报告，但 change 尚未归档（仍在 `openspec/changes/<name>/` 下） → 从 **Phase 4** 开始归档
      - change 已归档（在 `openspec/changes/archive/` 下）且有未提交变更（`git status` 非 clean） → 从 **Phase 5** 开始（提交前单测）
      - change 已归档且变更已提交但未推送（`git log origin/<branch>..HEAD` 有提交） → 从 **Phase 6 Step 19** 推送
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
