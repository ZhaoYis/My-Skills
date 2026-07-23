# Phase 3: 代码审查 (Review)

## 步骤 8：加载项目规范

按优先级加载：`openspec/config.yaml` → `AGENTS.md` → `CLAUDE.md`。三者均不存在时警告并回退为读取仓库现有代码做启发式判断。下文统称 **项目基准**。

## 步骤 9：获取变更内容

- 有未提交变更：`git diff HEAD` + `git diff --stat HEAD`
- 无未提交变更：检查未推送提交 `git log origin/<branch>..HEAD --oneline`
- 无任何变更：提示后进入 Phase 4

## 步骤 10：执行代码审查

**敏感信息扫描**：API key、password、token、私钥块等 → 发现记入「严重」。

**审查维度**：
- 正确性：逻辑错误、边界空值、错误处理遗漏
- 安全：注入、XSS、敏感数据明文、鉴权绕过
- 性能：明显 N+1、无分页大批量
- 可维护性：重复逻辑、过大函数、关键行为缺少说明
- 规范对照：以步骤 8 项目基准逐条对照

**报告保存**到 `openspec/review/YYYY-MM-DD-HH-mm-<branch-safe>-pipeline-review.md`，多轮追加 `-round-N`。

> **分支名安全处理**：将 `<branch>` 中的 `/` 替换为 `-`（如 `feature/my-fix` → `feature-my-fix`），避免路径遍历/目录创建失败。

## 步骤 11：[决策点 3] 审查结果处理

### 有严重或重要问题 → AskQuestion：
- `生成修复提案并应用` → 执行下方「修复子流程」后重新审查
- `直接修复并重新审查` → 直接改代码后重新审查
- `回到 Phase 2 重新实施` → 回到 Phase 2
- `暂停流水线，手动调整后继续` → 展示恢复指引后退出
- `继续后续流程` → Phase 4（完成后进入 Phase 5）
- `终止流程` → 退出

### 仅有一般问题或建议 → AskQuestion：
- `继续后续流程` → Phase 4
- `生成修复提案并应用` → 执行修复子流程
- `暂停流水线，手动调整后继续` → 退出
- `终止流程` → 退出

### 审查无问题 → 直接进入 Phase 4

**修复循环最多 3 轮**（每轮 = 一次"生成修复提案并应用"或一次"直接修复" → 重新审查），超过强制暂停并提示人工介入。

---

## 修复子流程（「生成修复提案并应用」）

1. 根据审查报告确定修复 scope，名称 `fix-cr-<type>`（如 `fix-cr-security`）
2. 新建修复 change 并生成制品（同 Phase 1 步骤 3）
3. **修复提案门禁**：严格按 Phase 1 决策点 1 使用 AskQuestion（三选项一致）
4. 逐任务实施修复（同 Phase 2 步骤 5-6）
5. 归档修复 change：`bash <SKILL_ROOT>/scripts/dev-pipeline-archive.sh "fix-cr-<type>" -y --skip-specs`
6. 回到步骤 9 重新审查
