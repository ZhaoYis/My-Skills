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
