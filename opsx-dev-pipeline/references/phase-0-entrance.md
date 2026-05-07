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
