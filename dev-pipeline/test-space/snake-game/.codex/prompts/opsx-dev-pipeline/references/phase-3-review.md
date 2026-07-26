# Phase3: 代码审查 (Review)

## Step9：加载项目规范

按优先级加载：`openspec/config.yaml` → `AGENTS.md` → `CLAUDE.md`。三者均不存在时警告并回退为读取仓库现有代码做启发式判断。下文统称 **项目基准**。

## Step10：获取变更内容

- 有未提交变更：`git diff HEAD` + `git diff --stat HEAD`
- 无未提交变更：检查未推送提交 `git log origin/<branch>..HEAD --oneline`
- 无任何变更：提示后进入 Phase4

## Step11：执行代码审查

**敏感信息扫描**：API key、password、token、私钥块等 → 发现记入「严重」。

**审查维度**：
- 正确性：逻辑错误、边界空值、错误处理遗漏
- 安全：注入、XSS、敏感数据明文、鉴权绕过
- 性能：明显 N+1、无分页大批量
- 可维护性：重复逻辑、过大函数、关键行为缺少说明
- 规范对照：以Step9 项目基准逐条对照

**报告保存**到 `openspec/review/YYYY-MM-DD-HH-mm-<branch-safe>-pipeline-review.md`，多轮追加 `-round-N`。

> **分支名安全处理**：将 `<branch>` 中的 `/` 替换为 `-`（如 `feature/my-fix` → `feature-my-fix`），避免路径遍历/目录创建失败。

报告写入后同步状态：
```bash
node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs set "<name>" review.reportPath '"<report-path>"'
node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs attempt "<name>" review passed # 或 issues-found
```

## Step12：[决策点 3] 审查结果处理

### 有严重或重要问题 → AskUserQuestion：
- `生成修复提案并应用` → 执行下方「修复子流程」后重新审查
- `直接修复并重新审查` → 直接改代码后重新审查
- `回到 Phase2 重新实施` → 回到 Phase2
- `暂停流水线，手动调整后继续` → 展示恢复指引后退出
- `继续后续流程` → Phase4（完成后进入 Phase5）
- `终止流程` → 退出

### 仅有一般问题或建议 → AskUserQuestion：
- `继续后续流程` → Phase4
- `生成修复提案并应用` → 执行修复子流程
- `暂停流水线，手动调整后继续` → 退出
- `终止流程` → 退出

### 审查无问题 → 直接进入 Phase4

进入后续流程前记录 `reviewDisposition`，再执行：
```bash
node <SKILL_ROOT>/scripts/dev-pipeline-state.mjs transition "<name>" 4 13
```

回到 Phase2 时执行 `transition "<name>" 2 6`；暂停时执行 `pause`。修复循环轮次以状态中的 `review.round` 为准。

**审查/修复循环最多 3 轮**。`attempt` 在第三次 `issues-found` 时原子记录暂停状态并返回非零；此时必须提示人工介入，不得继续 Phase4。

---

## 修复子流程（「生成修复提案并应用」）

1. 根据审查报告确定修复 scope，名称 `fix-cr-<type>`（如 `fix-cr-security`）
2. 新建修复 change、初始化独立状态并生成制品（同 Phase1 Step4）
3. **修复提案门禁**：严格按 Phase1 决策点 1 使用 AskUserQuestion（三选项一致）
4. 逐任务实施修复（同 Phase2 Step6-7）
5. 修复 change 按 Phase4–5 完成测试与归档，并以 `postArchiveAction=local-only` 迁移到 Phase6 后标记完成；代码随主 change 统一交付
6. 回到Step10 重新审查
