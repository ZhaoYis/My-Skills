# Phase 1: 提案编写 (Propose)

## 步骤 2.9：[决策点 1c] 需求理解确认（制品生成前）

在生成制品前先确认理解正确。用中性表述给出：影响范围、关键链路、待确认问题。

使用 **AskQuestion**：
- `确认需求理解，开始生成制品（推荐）` → 进入步骤 3
- `补充/修改需求理解` → 文本对话澄清后回到本决策点
- `终止流程` → 退出

## 步骤 3：创建 change 并生成制品

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
读取指令后创建文件。使用 **TaskCreate / TaskUpdate** 跟踪进度。

（可选）在决策点 1 前运行 `bash <SKILL_ROOT>/scripts/dev-pipeline-validate-change.sh "<name>"` 做结构校验。

## 步骤 4：[决策点 1] 确认提案（必过门禁）

**硬性规则：用户明确选择「确认提案，开始实施」前，禁止进入 Phase 2。**

展示提案摘要（对照用户原始需求：范围、关键行为、非目标与假设），然后 **AskQuestion**：
- `确认提案，开始实施` → 进入 Phase 2
- `提案不符合预期，我要补充/修改` → 文本对话收集反馈，改制品后回到本决策点
- `终止流程` → 退出
