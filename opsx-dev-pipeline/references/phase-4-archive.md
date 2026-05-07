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
