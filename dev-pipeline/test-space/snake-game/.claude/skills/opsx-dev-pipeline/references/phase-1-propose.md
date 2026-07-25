# Phase1: 提案编写 (Propose)

## Step3：[决策点 1a] 需求理解确认（制品生成前）

在生成制品前先确认理解正确。用中性表述给出：影响范围、关键链路、待确认问题。

使用 **AskQuestion**：
- `确认需求理解，开始生成制品（推荐）` → 进入Step4
- `补充/修改需求理解` → 文本对话澄清后回到本决策点
- `终止流程` → 退出

确认后记录：
```bash
node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs decision "<name>" requirementsConfirmed true
```

## Step4：创建 change 并生成制品

**续接已有 change**：跳过创建，仅对未完成制品执行生成。

**新建 change**：
```bash
bash <SKILL_ROOT>/scripts/dev-pipeline-new-change.sh "<name>"
```
若名称冲突，**AskQuestion**：`在已有 change 上继续` / `创建新名称`。

对每个 `ready` 状态的制品：
```bash
bash <SKILL_ROOT>/scripts/dev-pipeline-instructions.sh "<name>" <artifact-id>
```
读取指令后创建文件。优先使用当前 Agent 的任务工具；不可用时在回复中维护编号进度，并以 `tasks.md` 为完成事实。

（可选）在决策点 1 前运行 `bash <SKILL_ROOT>/scripts/dev-pipeline-validate-change.sh "<name>"` 做结构校验。

## Step5：[决策点 1] 确认提案（必过门禁）

**硬性规则：用户明确选择「确认提案，开始实施」前，禁止进入 Phase2。**

展示提案摘要（对照用户原始需求：范围、关键行为、非目标与假设），然后 **AskQuestion**：
- `确认提案，开始实施` → 进入 Phase2
- `提案不符合预期，我要补充/修改` → 文本对话收集反馈，改制品后回到本决策点
- `终止流程` → 退出

确认进入实施时，先记录门禁再迁移：
```bash
node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs decision "<name>" proposalApproved true
node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs transition "<name>" 2 6
```

用户要求修改时记录 `proposalApproved=false`；暂停或终止时执行状态 `pause` 并写明原因。
