---
name: phase-3-review
description: 全局步骤 8–11，含决策点 3 与 fix-cr 子流程。进入归档路径后执行 phase-4-archive.md 步骤 12。
compatibility: 需要 git；项目规范来自 `openspec/project.md` 或新版的 `openspec/config.yaml`，否则 CLAUDE.md；Cursor 中推荐 AskQuestion。
---

## Phase 3: 代码审查 (Review)

8. **加载项目规范**

   **项目信息来源**（兼容不同 OpenSpec 版本）：
   - **若存在 `openspec/project.md`**：优先读取（技术栈、架构规则、命名规范等）。
   - **否则若存在 `openspec/config.yaml`**：读取并解析 YAML（新版本 OpenSpec 常以该文件承载项目信息；字段名以仓库内实际内容及 `openspec` 文档为准）。
   - **若两者均不存在**：输出警告「未找到 openspec/project.md 与 openspec/config.yaml，将使用 CLAUDE.md 中的默认规范」，改用 CLAUDE.md。

   **若两者同时存在**：以 `project.md` 为规范叙述的首要依据；`config.yaml` 可作补充（如 schema、工具链），不与 `project.md` 明显冲突即可一并纳入审查基准。

   下文将步骤 8 加载结果统称为 **项目基准**。

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

    **本步骤自包含**：以下审查标准全部在本流水线内执行，**不要求**安装任何外部的独立 Git 代码审查 skill。

    **10.1 敏感信息扫描**  
    在 diff 全文中检查疑似机密：API key / apikey、`password` / `passwd`、`token` / `access_token` / `refresh_token`、私钥块（`-----BEGIN … PRIVATE KEY-----`）、含用户名密码的数据库 URL、AWS/Azure/GCP 典型密钥格式等。**一旦发现**记入「严重」区块，建议使用环境变量或密钥管理服务；若已进提交历史须提示清理历史的风险（filter-repo / BFG 等）。

    **10.2 规范基准**  
    以步骤 8 的 **项目基准** 为准（`project.md` / `config.yaml` 以及必要时 **CLAUDE.md**）：技术栈、分层、命名、风格、约束；凡基准中写明的内容，须在 diff 上逐条对照。

    **10.3 通用审查维度**（在基准文档未展开的缺口上补充）  
    - **正确性**：逻辑错误、边界与空值、错误处理遗漏、资源未关闭/泄漏风险  
    - **安全**：注入（SQL 等）、XSS、敏感数据明文、鉴权/授权绕过或缺失  
    - **性能**：明显 N+1、无谓热路径复杂度、大批量无分页  
    - **可维护性**：重复逻辑、过大的函数/类、关键行为缺少可读说明  

    **10.4 典型 Java 分层栈**（**仅当**项目基准或目录结构表明适用时强化检查，否则以项目基准与通用维度为主）  
    - 分层与依赖：Web → Biz → Core → Common，禁止上层被下层反向依赖、禁止跨层乱依赖  
    - 命名后缀：Controller、BizService/Impl、DomainService/Impl、Mapper、DO、Model、VO、Request、Convert 等（以项目基准为准）  
    - 写操作事务：`@Transactional(rollbackFor = Throwable.class)`（若栈使用 Spring）  
    - 对象转换：优先 MapStruct（`INSTANCE`），避免大面积手写映射  
    - 日志：使用框架 logger，避免 `System.out.println`  

    **10.5 历史审查**  
    若 `openspec/review/` 中已有**同一分支**的近期报告，对比重复问题、已修复项与回归。

    **10.6 超大 diff**  
    若变更行数过多（例如统计超过约 5000 行），可按文件或目录分块审查，在报告「概要」中说明分块策略，避免遗漏整文件。

    **10.7 报告（必须使用中文）**  
    报告须写入对话并保存到文件（目录不存在则 `mkdir -p openspec/review`）。建议结构：**概要**（文件数、增删行、问题分级统计）、**严重 / 重要 / 一般 / 建议**、**规范违规表**（对照项目基准）、**已审查文件列表**、**敏感信息扫描结果**、**与上次审查对比**（若有）、**修复建议**、**亮点**。  
    **严重程度**：严重（安全漏洞、泄密、破坏性缺陷）→ 重要（规范/性能/设计明显问题）→ 一般（风格、命名）→ 建议（可选优化）。

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
    e. 归档修复 change（修复类 change 通常无 delta specs：跳过 Step 13 的 delta 对话时，可用 `--skip-specs`；若有 delta 需合并则去掉该 flag）：
       ```bash
       bash opsx-dev-pipeline/scripts/opsx-archive.sh "fix-cr-<type>" -y --skip-specs
       ```
       **等价**：`openspec archive "fix-cr-<type>" -y --skip-specs`；失败时再用 `mkdir` + `mv` 手动归档（同 Phase 4 降级说明）。
    f. 重新执行 Step 9-11（代码审查），进入下一轮
    g. 如果 3 轮后仍有严重问题，强制暂停并提示用户手动介入，展示恢复指引后退出

    **"直接修复并重新审查"子流程（最多循环 3 轮）：**

    a. 根据审查问题直接在当前代码上执行修复变更（不创建新 change）
    b. 重新执行 Step 9-11
    c. 如果 3 轮后仍有严重问题，强制暂停，展示恢复指引后退出
