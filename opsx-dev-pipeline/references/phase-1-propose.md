## Phase 1: 提案编写 (Propose)

3. **创建 change 并生成制品**

   **a. 如果是从 Phase 0 Step 2a 续接已有 change**：跳过创建，直接执行 `bash opsx-dev-pipeline/scripts/opsx-change-status.sh "<name>"`（或 `openspec status --change "<name>" --json`），仅对未完成的制品执行生成流程。

   **b. 如果是新建 change**：

   ```bash
   bash opsx-dev-pipeline/scripts/opsx-new-change.sh "<name>"
   ```

   **等价**：`openspec new change "<name>"`

   **如果 change 名称已存在**：使用 **AskQuestion tool** 询问：
   - `在已有 change 上继续` - 按 3a 路径处理（跳过创建，续接制品生成）
   - `创建新名称` - 向用户发送文本消息询问新名称，获取后重新创建

   ```bash
   bash opsx-dev-pipeline/scripts/opsx-change-status.sh "<name>"
   ```

   **等价**：`openspec status --change "<name>" --json`

   按依赖顺序创建制品：对每个 `ready` 状态的制品，运行 `bash opsx-dev-pipeline/scripts/opsx-instructions.sh "<name>" <artifact-id>`（或 `openspec instructions <artifact-id> --change "<name>" --json`）获取指令，读取依赖制品，按 `template` 结构创建文件。已完成的制品保持不变。循环直到所有 `applyRequires` 制品完成。（可选：在 **决策点 1** 之前增加 `bash opsx-dev-pipeline/scripts/opsx-validate-change.sh "<name>"` 做结构校验。）

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
