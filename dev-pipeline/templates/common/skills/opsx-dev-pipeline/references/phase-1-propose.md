---
name: phase-1-propose
description: 全局步骤 2.9–4，含决策点 1c（制品生成前的需求理解确认）与决策点 1（提案门禁）。用户确认「确认提案，开始实施」后进入 phase-2-apply.md 步骤 5。
compatibility: 需要 openspec CLI、git 与已初始化 OpenSpec 的项目；Cursor 中推荐 AskQuestion；需求理解确认可复用 opsx-analysis 输出。
---

## Phase 1: 提案编写 (Propose)

### 步骤 2.9：[决策点 1c] 需求理解确认（制品生成前，B 类）

在生成任何提案制品**之前**，先确认「是否要做对的事」，避免提案靠猜导致后续返工。该确认属于附录定义的 **B 类：可推荐，不可静默代选**。

1. **优先复用，不重复定义**

    - 若已运行过 `opsx-analysis` 并产出结构化分析：**直接复用**其需求目标、边界、影响面与待确认问题，不重复梳理。
    - 若没有现成分析：在本步骤做一次**轻量澄清**（不强制完整跑 `opsx-analysis`），用中性表述给出：
        - **影响范围**：涉及的模块 / 能力 / 数据 / 外部依赖（不绑定具体分层或技术栈）
        - **关键链路**：主要调用 / 数据流向的简要描述
        - **待确认问题**：逐条列出仍不明确、需用户拍板的点

2. **使用 AskQuestion tool**

    - `确认需求理解，开始生成制品（推荐）` — 用户认可上述理解后，进入 **步骤 3** 创建 change 并生成制品
    - `补充/修改需求理解` — **不**使用 AskQuestion 收集细节：通过**文本对话**让用户补充，更新理解后**回到本决策点**重新展示，循环直到确认或终止
    - `终止流程` — 退出流水线

3. **续接与跳过**

    - 续接已有 change（Phase 0 Step 2a）且历史需求理解仍然成立时，可在简述后快速通过本决策点；若用户认为理解已过时，应先按对话结果澄清再确认。
    - 信息确实充分、需求显而易见的小改动，可一次性展示理解并请用户确认，不必强行追问。

### 步骤 3：创建 change 并生成制品

#### 3.a 从 Phase 0 Step 2a 续接已有 change

- 跳过创建，优先复用 **Phase 0 Step 2a** 已获取的 `openspec status` 结果，仅对其中未完成的制品执行生成流程；只有在入口结果缺失、用户在进入 Phase 1 前后已修改制品，或需要刷新 `ready` 状态时，才重新执行 `bash <SKILL_ROOT>/scripts/dev-pipeline-change-status.sh "<name>"`（或 `openspec status --change "<name>" --json`）
- 此处的 status 查询目的，是在**已确定进入 Phase 1**后定位未完成制品，属于 **Phase 1 的阶段内复核**；若结果与 Phase 0 的入口判定冲突，不应静默改判到更晚阶段，而应按 `recovery-guardrails-appendix.md` 的保守恢复规则处理

#### 3.b 新建 change

1. **创建**

    ```bash
    bash <SKILL_ROOT>/scripts/dev-pipeline-new-change.sh "<name>"
    ```

2. **等价**

    `openspec new change "<name>"`

3. **若 change 名称已存在：使用 AskQuestion tool**

    - `在已有 change 上继续` — 按 **3.a** 路径处理（跳过创建，续接制品生成）
    - `创建新名称` — 向用户发送文本消息询问新名称，获取后重新创建

    随后执行：

    ```bash
    bash <SKILL_ROOT>/scripts/dev-pipeline-change-status.sh "<name>"
    ```

    **等价**：`openspec status --change "<name>" --json`

4. **按依赖顺序创建制品**

    - 对每个 `ready` 状态的制品，运行 `bash <SKILL_ROOT>/scripts/dev-pipeline-instructions.sh "<name>" <artifact-id>`（或 `openspec instructions <artifact-id> --change "<name>" --json`）获取指令，读取依赖制品，按 `template` 结构创建文件
    - **撰写 design 制品时**：若同级安装了 `opsx-design` 技能，加载其 `assets/section-skeleton.md` 章节骨架与 `assets/quality-checklist.md` 质量门禁来撰写并自检设计（相关性过滤、受众标注、改动影响汇总含"不受影响"项、验证断言字段、任务=一文件）；无该技能时按上述纪律内联执行。`opsx-design` 是"如何写好设计"的能力库，本步骤仍是"何时必须产出 design"的门禁权威，不在此复制其正文。
    - 已完成的制品保持不变
    - 循环直到所有 `applyRequires` 制品完成
    - 若检测到自定义 schema：
        - 按 schema 定义的 expected artifacts 进行处理
        - 如需要，执行 `bash <SKILL_ROOT>/scripts/dev-pipeline-ensure-change-meta.sh "<name>"`，补齐 `.openspec.yaml` 与相应的元数据
        - 根据 schema 定义的依赖关系处理制品生成顺序
    （可选：在 **决策点 1** 之前增加 `bash <SKILL_ROOT>/scripts/dev-pipeline-validate-change.sh "<name>"` 做结构校验）

5. **追踪**

    - 使用 **TaskCreate / TaskUpdate / TaskList** 跟踪各制品进度

### 步骤 4：[决策点 1] 确认提案（Apply 前置门禁，必过）

**硬性规则：在用户明确选择「确认提案，开始实施」之前，禁止进入 Phase 2（Apply）、禁止开始改代码或执行 `openspec instructions apply`。**

#### 展示内容（须覆盖「是否做对事」而不仅是「生成了哪些文件」）

- 建议先用短格式提示当前阶段信息：
  - `Phase：Phase 1 提案编写`
  - `change：<name>`
  - `当前步骤：步骤 4（决策点 1）`
  - `已知状态：提案制品已生成，等待确认是否进入实施`
  - `下一动作：先展示提案摘要，再进入决策点 1`
- 用简短条目 **对照用户原始需求**：范围（接口/模块/数据）、关键行为、非目标与假设
- 再按**当前 schema 的 expected artifacts** 展示各制品摘要；默认 schema 通常为 `proposal.md` / `design.md` / delta `specs` / `tasks.md`，若使用自定义 schema 则应按 schema 定义展示相应的制品
- 若使用自定义 schema：一并展示当前 change 的 `.openspec.yaml` 与相应的元数据；若尚未声明，则在本步骤补齐后再进入本决策点

#### 交互：先使用 AskQuestion tool

选项固定如下。**不得**用 AskQuestion 代替用户对「是否符合预期」的自由表述；若用户选「不符合」类，须继续用文字对话。

**选项：**

- `确认提案，开始实施` — 仅当用户判断提案与原始任务要求**已一致**时选择；进入 Phase 2
- `提案不符合预期，我要补充/修改` — **不**使用 AskQuestion 收集细节：通过**文本对话**请用户说明差距（缺什么、错什么、要增删哪些点）；根据反馈**直接改** `openspec/changes/<name>/` 下对应制品（proposal / design / specs / tasks），必要时重跑 **步骤 3** 中未就绪的制品生成逻辑；改完后**回到本决策点**，重新展示对照摘要并再次 AskQuestion。**重复直到用户选择「确认提案，开始实施」或「终止流程」**（不设次数上限，以「与原始需求一致」为准；若多轮仍无法对齐，应主动建议暂停、缩小范围或拆分 change，由用户选择是否终止）
- `终止流程` — 退出流水线

**执行注意：**

- 用户若仅在聊天里说「再改一下 xxx」而未点选项，视为走「补充/修改」路径：先改制品，再展示并**仍然**用 AskQuestion 给出上述三选项，避免跳过显式确认
- 续接已有 change（Phase 0 Step 2a）且制品已存在时：**同样**须经过本决策点；若用户认为历史提案过时，应先按对话结果更新制品再走确认
