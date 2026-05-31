# opsx-dev-pipeline 常见失败场景与恢复矩阵

本文件用于落实优化方案中的 Step A3：梳理常见失败场景与恢复动作。

目标：

- 将散落在 `references/phase-*.md`、`references/recovery-guardrails-appendix.md` 和 `scripts/opsx-*.sh` 中的失败处理规则统一整理
- 明确哪些失败属于前置阻断、哪些属于流程内可恢复异常、哪些属于需要用户显式决策的高风险场景
- 为后续 Step A4 的附录补强与 Step A6 的异常路径测试提供基线

## 使用原则

- **优先区分是否可继续主流程**：不是所有失败都应立即结束
- **优先给出恢复动作，而不是只解释错误**
- **明确恢复点**：用户恢复时应从哪个 Phase / Step 继续
- **区分自动建议与人工确认**：高风险动作必须由用户显式选择

## 失败场景恢复矩阵

| ID | 阶段 | 场景 | 典型信号 | 恢复动作 | 是否需要用户确认 | 恢复点 | 备注 |
|---|---|---|---|---|---|---|---|
| R0-1 | Phase 0 | openspec CLI 不可用 | `opsx-preflight.sh` 失败；`openspec --version` 失败 | 提示安装 openspec，并结束当前流水线 | 否 | 无 | 前置阻断 |
| R0-2 | Phase 0 | 当前目录不在 git 仓库中 | `git rev-parse --is-inside-work-tree` 失败 | 提示进入 git 仓库或执行 `git init`，并结束当前流水线 | 否 | 无 | 前置阻断 |
| R0-3 | Phase 0 | change 不存在 | `openspec status --change` 失败；用户输入名称无效 | 列出可用 change，要求用户重新选择 | 是 | Phase 0 Step 2a | 不应自动新建同名 change |
| R0-4 | Phase 0 | schema 无法识别 | `opsx-detect-schema.sh` 返回默认或异常信息 | 警告并按默认 schema 路径继续 | 否 | 当前 Phase 继续 | 非阻断性降级 |
| R0-5 | Phase 0 | custom schema 缺少 change 元数据 | `changeHasOpenSpecYaml=false` 或 metadata 缺失 | 回到 Phase 1 补齐 `.openspec.yaml` 与元数据 | 是 | Phase 1 Step 3/4 | 进入 Apply 前应补齐 |
| R0-6 | Phase 0 | 已有 change 状态不完整或无法准确判断 | `status` 信息与文件系统状态不一致 | 以保守方式建议用户从较早阶段续接；必要时要求人工确认 | 是 | 依确认结果 | 典型场景是已归档/已推送/未合并等边界状态 |
| R1-1 | Phase 1 | change 名称冲突 | `openspec new change` 返回冲突 | 提示在已有 change 上继续或创建新名称 | 是 | Phase 1 Step 3 | 不自动覆盖已有 change |
| R1-2 | Phase 1 | 制品未能生成完整 | `applyRequires` 未完成；instructions 无法产出完整制品 | 补充缺失制品，必要时继续循环生成 | 否 | Phase 1 Step 3 | 未过提案门禁前不得进入 Phase 2 |
| R1-3 | Phase 1 | 提案与需求不一致 | 用户明确提出“还要修改” | 通过自由文本补充/修改，更新制品后回到决策点 1 | 是 | Phase 1 Step 4 | 高概率循环场景 |
| R2-1 | Phase 2 | apply 返回 blocked | `state: blocked` | 回到 Phase 1 补制品，或终止流程 | 是 | Phase 1 Step 3 / 3.a | 典型可恢复异常 |
| R2-2 | Phase 2 | 单个任务实施遇阻塞 | 任务不明确、上下文不足、设计不清 | 用户补充说明 / 跳过此任务 / 终止流程 | 是 | 当前任务或下一个任务 | 局部阻塞，不一定中断整条流程 |
| R2-3 | Phase 2 | change 元数据缺失 | `opsx-change-context.sh` 无法得到 metadata | 回到 Phase 1 补齐 change 元数据，再继续 Apply | 是 | Phase 1 → Phase 2 | custom schema 相关 |
| R3-1 | Phase 3 | 无变更可审 | `git diff HEAD` 为空且无未推送提交 | 提示没有可审查变更，进入 Phase 5 | 否 | Phase 5 Step 16 | 非错误，更像空路径处理 |
| R3-2 | Phase 3 | 审查报告目录创建失败 | 无法创建 `openspec/review` | 报告仅输出到对话，并提示落盘失败 | 否 | 当前 Phase 继续 | 可降级继续 |
| R3-3 | Phase 3 | 严重/重要问题多轮未收敛 | 修复循环达到 3 轮上限 | 强制暂停，提示人工介入 | 否 | 重新进入 Phase 3 | 不应无限循环 |
| R3-4 | Phase 3.1 | fix change 放弃继续 | 用户不再想走 fix-cr 子流程 | 通过“终止流程”退出 fix 子流程，清理 fix change 后回原 change 的 Phase 5 | 是 | 原 change 的 Phase 5 Step 16 | 特殊恢复路径 |
| R4-1 | Phase 4 | 存在未完成任务但准备归档 | `tasks.md` 中仍有未完成项 | 继续归档 / 回到 Phase 2 / 终止流程 | 是 | Phase 2 或当前归档流程 | 高风险确认点 |
| R4-2 | Phase 4 | verify 命令无法解析 | `opsx-resolve-verify.sh` 返回 `command=null` 或信息不足 | 先查 `make validate`、`./scripts/validate.sh all`，仍无法确定则要求用户确认 | 是 | Phase 4 Step 13 | custom schema 下不得默认跳过 |
| R4-3 | Phase 4 | verify 执行失败 | 验证命令返回非 0 | 修复后重试 / 暂停流水线 / 终止流程 | 是 | Phase 4 Step 13 | custom schema 下为硬门禁 |
| R4-4 | Phase 4 | openspec archive 失败 | `opsx-archive.sh` / `openspec archive` 返回失败 | 优先重试；必要时降级为手动归档 | 是 | Phase 4 Step 15 | 手动归档须保持与用户选择一致 |
| R4-5 | Phase 4 | 归档目标冲突 | archive 目录同名已存在 | 使用 CLI 自动处理；手动归档时追加 `-N` 后缀 | 否 | Phase 4 Step 15 | 非阻断性处理 |
| R5-1 | Phase 5 | 无法唯一确定测试命令 | 多个候选命令都合理 | 列出 2–3 个候选命令，请用户选择或输入惯用命令 | 是 | Phase 5 Step 16.1 | 不应擅自猜测 |
| R5-2 | Phase 5 | 测试失败 | 单测命令返回非 0 | 修复代码或测试后重试，或终止流程 | 是 | Phase 5 子流程 A 步骤 3 | 常见恢复场景 |
| R5-3 | Phase 5 | 用户选择暂停 | 用户暂不想处理单测 | 展示恢复指引，稍后从 Phase 5 Step 16 续跑 | 是 | Phase 5 Step 16 | 暂停类标准处理 |
| R6-1 | Phase 6 | 分支落后或分叉 | `git status` / `git fetch` 显示落后或 diverged | pull --rebase 后继续 / 继续后续流程（不先 rebase）/ 终止流程 | 是 | Phase 6 Step 17 | 继续后续流程需显式提示风险 |
| R6-2 | Phase 6 | rebase 冲突 | `git pull --rebase` 发生冲突 | 暂停流水线，手动调整后继续 / `git rebase --abort` 并终止 | 是 | Phase 6 Step 17 或 19 | 需展示冲突文件 |
| R6-3 | Phase 6 | 检测到敏感文件 | 暂存区含 `.env`、密钥、凭据等 | 排除敏感文件后继续后续流程 / 继续后续流程（包含敏感文件） / 终止流程 | 是 | Phase 6 Step 17 | 必须显式警告 |
| R6-4 | Phase 6 | 无可提交变更 | 工作区 clean 且无 diff | 告知用户并结束本 Phase，不强行 commit | 否 | 无 | 非错误，属于空路径 |
| R6-5 | Phase 6 | 推送失败 | `git push` 失败 | pull --rebase 后重试 / 终止流程 | 是 | Phase 6 Step 19 | 保留本地提交 |
| R6-6 | Phase 6 | 合并前工作区不干净 | `git status` 发现未提交/未暂存变更 | 先 stash / 先提交 / 终止流程 | 是 | Phase 6 Step 20 | 合并前门禁 |
| R6-7 | Phase 6 | 合并冲突 | `git merge` 冲突 | 中止合并 / theirs / ours / 暂停手动解决 | 是 | Phase 6 Step 20 | 需列出冲突文件 |
| R6-8 | Phase 6 | 合并后分支清理失败 | 删除本地或远程分支失败 | 提示失败，但不回滚已完成合并 | 否 | 当前 Phase 结束 | 收尾性异常 |
| RX-1 | 全局 | AskQuestion 不可用 | 工具环境受限 | 改为编号选项 fallback | 否 | 当前决策点 | 兼容性降级 |
| RX-2 | 全局 | openspec 命令超时或返回非预期格式 | 超时、stderr 异常、JSON 解析失败 | 提示错误，提供重试 / 跳过当前步骤 / 终止流程 | 是 | 当前步骤 | 通用恢复路径 |
| RX-3 | 全局 | 多轮对话中模型想提前收口 | 非用户明确终止 | 不得单方结束；需征得用户同意 | 是 | 当前 Phase | Guardrail 级规则 |
| RX-4 | 全局 | 用户选择暂停 | 任何决策点中显式暂停 | 展示 change、Phase、原因、恢复指引后退出 | 否 | 对应断点 | 标准中断恢复动作 |

## 按类型归类

### A. 前置阻断类
这类场景在修复前不应继续主流程：

- openspec CLI 不可用
- 不在 git 仓库中
- custom schema 必需元数据缺失
- verify 硬门禁未通过

### B. 可回退到前一 Phase 的场景

- apply blocked → 回到 Phase 1
- change 元数据缺失 → 回到 Phase 1
- 未完成任务但准备归档 → 回到 Phase 2

### C. 当前 Phase 内循环恢复场景

- 提案补充/修改
- 任务阻塞后的补充说明
- verify 修复后重试
- 单测失败后修复并重试
- push 失败后 rebase 重试

### D. 必须显式用户确认的高风险场景

- 忽略分支落后/分叉风险继续提交流程
- 包含敏感文件继续提交流程
- 在未完成任务情况下继续归档
- 无法解析 verify 命令但仍想继续
- 合并冲突时选择 ours / theirs

## Step A3 结论

Step A3 的结论是：

1. 当前仓库已经定义了大部分高频失败场景，但分散在多个 Phase 和附录中
2. 最常见的恢复模式有四类：
   - 回到前一阶段补信息
   - 在当前阶段循环修复后重试
   - 暂停并从断点恢复
   - 由用户显式确认后带风险继续
3. `references/recovery-guardrails-appendix.md` 适合继续作为总入口，但需要吸收本矩阵中更细的恢复动作描述
4. 后续 Step A4 应把这份矩阵中最关键的场景回填进附录，并让各 Phase 的失败说明更短、更统一
