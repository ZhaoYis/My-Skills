---
name: phase-0-entrance
description: 全局步骤 1–2（环境预检、入口类型与续接确认）。完成后按步骤 2 进入 phase-1-propose.md 步骤 3、phase-2-apply.md 步骤 5、phase-3-review.md 步骤 8、phase-5-unit-tests.md 步骤 16 或 phase-6-merge-push.md 对应步骤；新建 change 后从 Phase 1 步骤 3 起；亦可终止。 
---

## Phase 0: 入口判断

`**<SKILL_ROOT>**`：本技能安装根目录（内含 `scripts/`）。下文命令中的占位符须替换为实际绝对路径（与业务仓库路径无关）。

**执行 `openspec` / `git` / 下文流水线命令时，当前工作目录仍应为目标 git 仓库根目录**，除非某一步另有说明。

### 步骤 1：环境预检与 schema 识别

1. **优先（一键）**（在目标仓库根目录执行；脚本路径替换 `<SKILL_ROOT>`）：
  ```bash
    bash <SKILL_ROOT>/scripts/dev-pipeline-preflight.sh
  ```
2. **等价**（无脚本时）：
  ```bash
    openspec --version
    git rev-parse --is-inside-work-tree
  ```
3. **结果处理**
  - 如果 openspec CLI 不可用：提示安装方式并退出
  - 如果不在 git 仓库中：提示 `git init` 或进入正确仓库后退出
4. **schema 识别**
  - 运行 `bash <SKILL_ROOT>/scripts/dev-pipeline-detect-schema.sh [<name>]`，识别：
  - 当前 `schema`
  - 是否存在 `openspec/config.yaml`
  - change 下是否已有 `.openspec.yaml`
  - 根据 schema 类型确定特定配置
    - 若检测到特定 schema（非默认的 spec-driven）：后续 **Phase 1 / 2 / 3 / 4 / 5** 均按 `assets/schema-adapter-summary.md` 启用 schema-aware 增强路径
    - 若 schema 无法识别或未声明：按默认 schema 路径继续，不阻断主流程
  - **复用约定**：Phase 0 已拿到的 `schema` / `stacks` / `.openspec.yaml` 存在性信息，应作为后续主路径的首份事实来源；后续 Phase 仅在需要补充 merged context、standards、rulesSummary、verify 命令，或 Phase 1 刚更新 `.openspec.yaml` / change 元数据时，才重新调用相关脚本，而不重复做同类探测

### 步骤 2：判断入口类型

#### 2.a 用户提供了已有 change 名称

1. **状态检查**
  - 运行 `bash <SKILL_ROOT>/scripts/dev-pipeline-change-status.sh "<name>"`（或 `openspec status --change "<name>" --json`）检查 change 状态
    - 如果 change 不存在：提示名称错误，运行 `bash <SKILL_ROOT>/scripts/dev-pipeline-list-changes.sh`（或 `openspec list --json`）展示可用 change，让用户重新选择
2. **若 change 存在：按固定判定顺序选择续接阶段**
  - 该步骤用于 **Phase 0 的入口判路**：决定本次流水线应从哪个 Phase / Step 续接；进入对应 Phase 后的再次状态检查，仅属于该 Phase 的**阶段内复核**，不应静默改判到更晚阶段
  - 推荐顺序遵循：**优先回到最早一个尚未完成的主干阶段或质量门禁**；若状态冲突，宁可保守回早，也不冒进推晚
  - **未归档 change**（仍在 `openspec/changes/<name>/` 下）按以下优先级判断：
    - `applyRequires` 制品未全部完成 → 推荐从 **Phase 1 Step 3** 继续（检查哪些制品处于 `ready` 状态，仅对未完成的制品执行生成流程，已完成的制品保持不变）
    - 制品已完成但任务未全部完成 → 推荐从 **Phase 2** 继续实施
    - 任务已全部完成且 `openspec/review/` 下无该分支审查报告 → 推荐从 **Phase 3** 开始审查
    - 任务已全部完成且已有审查报告，但审查后的单元测试 / 归档链路尚未完成 → 推荐先从 **Phase 5** 开始（审查后单元测试门禁），完成后再进入 **Phase 4** 归档
  - **已归档 change**（在 `openspec/changes/archive/` 下）按以下优先级判断：
    - 有未提交变更（`git status` 非 clean） → 推荐从 **Phase 6 Step 17/18** 开始（预提交检查 / 提交）
    - 无未提交变更，但存在未推送提交（`git log origin/<branch>..HEAD` 有提交） → 推荐从 **Phase 6 Step 19** 推送
    - 已推送但尚未完成目标分支合并 → 推荐从 **Phase 6 Step 20** 继续目标分支与合并策略处理
  - **若状态不完整或无法准确判断**（例如 `openspec status`、审查报告、文件系统与 git 状态彼此不一致）：使用较早阶段作为**保守恢复点**，并用 AskQuestion 让用户确认从哪个 Phase 续接，避免误跳到过晚阶段；该保守恢复点只可作为推荐，不可代替用户选择
3. **使用 AskQuestion tool 确认**
  - `从 Phase X 继续` — 按判断结果继续
    - `从头开始（新建 change）` — 向用户询问新的 change 名称，走完整 Phase 1（原 change 保留不动）
    - `终止流程` — 退出

#### 2.b 用户提供了需求描述

- 从描述中推导出 kebab-case 的 change 名称
- 进入 **Phase 1**；按 `phase-1-propose.md` **步骤 2.9（决策点 1c）** 先确认需求理解（可复用 `opsx-analysis` 输出）再生成制品，避免提案靠猜导致返工

#### 2.c 用户未提供任何输入

- 直接向用户发送文本消息询问（不使用 AskQuestion tool，因为此处需要自由文本输入）：
  > Phase：Phase 0 入口判断
  > 当前步骤：步骤 2（等待输入）
  > 已知状态：尚未获得需求描述或 change 名称
  > 下一动作：请描述您要实现的需求或功能，或输入已有 change 名称。
- 等待用户回复后，根据回答判断走 **2.a** 或 **2.b** 路径

