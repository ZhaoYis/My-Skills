# 预检 JSON Contract

`scripts/opsx-learn-preflight.sh` 应输出单个 JSON 对象，用于在进入知识沉淀前传递仓库上下文、推荐知识目录与知识健康提示。

## 顶层字段

| 字段 | 类型 | 必有 | 说明 |
| ---- | ---- | ---- | ---- |
| `status` | `"ok"` | 是 | 当前预检脚本自身执行成功。当前版本固定为 `ok`；脚本执行失败时直接退出并返回非零码，而不是输出失败 JSON。 |
| `repoRoot` | `string` | 是 | 当前目标 git 仓库根目录绝对路径。 |
| `firstUse` | `boolean` | 是 | 是否未检测到明显的既有知识目录。`true` 表示本次更可能需要与用户确认首个知识库存放位置。 |
| `recommendedKnowledgeDir` | `string` | 是 | 推荐写入位置。优先复用既有知识目录；若未检测到，则默认建议 `.knowledge/`。 |
| `knowledgeHealthAvailable` | `boolean` | 是 | 是否成功获取到 `.knowledge` 健康报告。 |
| `knowledgeHealthStatus` | `"ok" | "warn" | "fail" | "unknown"` | 是 | 知识健康总体状态；当未拿到健康报告时为 `unknown`。 |
| `knowledgeHealthSummary` | `string` | 否 | 面向人读的一句话摘要。仅在 `knowledgeHealthAvailable = true` 时出现。 |
| `knowledgeHealthHighlights` | `array` | 否 | 面向人读的重点问题列表。仅在 `knowledgeHealthAvailable = true` 时出现。 |
| `knowledgeHealth` | `object` | 否 | 原始完整知识健康报告。仅在 `knowledgeHealthAvailable = true` 时出现。 |
| `knowledgeHealthSource` | `"global" | "node_modules" | "npx" | "unknown"` | 否 | doctor 命令的解析来源。仅在成功获取健康报告时出现。 |
| `message` | `string` | 是 | 通用预检说明，提醒如何选择知识目录，以及在拿到 health report 时如何处理。 |

## `knowledgeHealthHighlights` 条目结构

每个 highlight 条目来自原始 `knowledgeHealth.checks[]` 中的 `warn` / `fail` 项，最多返回前 3 条。

| 字段 | 类型 | 必有 | 说明 |
| ---- | ---- | ---- | ---- |
| `id` | `string` | 否 | 原始检查项 ID。 |
| `status` | `"warn" | "fail"` | 是 | 该高优先级问题的状态。 |
| `message` | `string` | 否 | 面向用户展示的问题描述。 |
| `missingFiles` | `string[]` | 否 | 若问题与缺失文件 / 目录有关，则返回缺失项。 |
| `missingSections` | `string[]` | 否 | 若问题与索引 section 缺失有关，则返回缺失 section。 |
| `placeholderCount` | `number` | 否 | 若问题与占位符过多有关，则返回占位符计数。 |

## 推荐消费顺序

当预检返回知识健康相关字段时，按以下顺序使用：

1. `knowledgeHealthSummary`
   - 用于先给用户一个总体判断
   - 适合作为 Phase 5 写前提醒的第一句话
2. `knowledgeHealthHighlights`
   - 用于补充最值得优先关注的 1～3 个问题
   - 适合直接引导用户决定是否先修复骨架或同步索引
3. `knowledgeHealth`
   - 仅在用户追问、需要逐项核对，或要做更细的自动化处理时再展开

## 降级语义

当满足任一情况时，预检脚本应保留主流程可用性，并降级为“不提供知识健康详情”而不是中断： 

- 全局 PATH、`node_modules/.bin` 与 `npx` 均无法解析 `opsx-dev-pipeline` CLI
- `doctor --json` 调用失败
- doctor 输出不是合法 JSON
- doctor JSON 中缺少 `knowledge` 对象或结构不符合预期

> **注意**：未执行 `npm install -g opsx-dev-pipeline` 时，预检会通过 `npx --yes opsx-dev-pipeline` 自动回退，**不应**因此进入降级模式（前提是本机有 Node.js 与网络）。

降级后的期望行为：

- `knowledgeHealthAvailable = false`
- `knowledgeHealthStatus = "unknown"`
- 不输出：
  - `knowledgeHealthSummary`
  - `knowledgeHealthHighlights`
  - `knowledgeHealth`
- 仍输出：
  - `status`
  - `repoRoot`
  - `firstUse`
  - `recommendedKnowledgeDir`
  - `message`

## 维护约束

当修改以下任一项时，应同步检查并更新：

- `scripts/opsx-learn-preflight.sh`
- `SKILL.md.hbs`
- `references/phase-5-review-and-write.md`
- `assets/write-targets.md`
- `assets/maintenance-index.md`
- 本文档
