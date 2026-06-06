# opsx 失败恢复矩阵

本文件只保留当前 skill 仍需要的失败场景、恢复动作、恢复续接点与权威来源，用于快速导航到恢复正文；恢复规则正文以 `references/recovery-guardrails-appendix.md` 与相关 `references/phase-*.md` 为准。

## 1. 使用原则

- 失败场景的规则正文以当前 Phase 与 `references/recovery-guardrails-appendix.md` 为准
- 本矩阵只用于统一恢复动作、恢复续接点与定位权威来源
- 恢复时优先回答三件事：现象、恢复动作、从哪里继续
- 可恢复异常优先引导恢复，不直接结束流程

## 2. 失败场景矩阵

| ID | Phase | 场景 | 触发信号 | 推荐恢复动作 | 是否需要用户确认 | 恢复续接点 | 权威来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R0-1 | Phase 0 | `openspec` 不可用 | `openspec --version` 失败 | 修复环境后重试 | 否 | 无 | `references/recovery-guardrails-appendix.md` §3.1 | 硬前置失败 |
| R0-2 | Phase 0 | 当前目录不在 git 仓库中 | `git rev-parse --show-toplevel` 失败 | 进入或初始化 git 仓库后重试 | 否 | 无 | `references/recovery-guardrails-appendix.md` §3.1 | 硬前置失败 |
| R0-3 | Phase 0 | change 不存在 | `openspec status --change` 失败 | 用户确认后重新选择 change | 是 | Phase 0 | `references/recovery-guardrails-appendix.md` §3.1；`references/phase-0-entrance.md` | 不应自动新建同名 change |
| R0-4 | Phase 0 | change 状态不完整或冲突 | `openspec status` 与本地 git / 文件状态无法一致解释 | 用户确认后回到较早 Phase | 是 | 由保守恢复判断决定 | `references/recovery-guardrails-appendix.md` §3.1、§3.2；`references/phase-0-entrance.md` | 保守恢复优先 |
| R0-5 | Phase 0 | custom schema 缺少 change 元数据 | `changeHasOpenSpecYaml=false` 或 metadata 缺失 | 用户确认后回到 Phase 1 补齐元数据 | 是 | Phase 1 | `references/recovery-guardrails-appendix.md` §2.3、§3.1；`references/phase-1-propose.md` | 进入 Apply 前应补齐 |
| R1-1 | Phase 1 | change 名称冲突 | `openspec new change` 返回冲突 | 用户确认后继续已有 change 或创建新名称 | 是 | Phase 1 | `references/recovery-guardrails-appendix.md` §3.1；`references/phase-1-propose.md` | 不自动覆盖已有 change |
| R1-2 | Phase 1 | 制品未生成完整 | `applyRequires` 未完成；instructions 无法产出完整制品 | 补齐制品后继续 | 否 | Phase 1 | `references/phase-1-propose.md` | 未过提案门禁前不得进入 Phase 2 |
| R1-3 | Phase 1 | 提案与需求不一致 | 用户明确提出仍需修改 | 补充/修改后回到决策点 1 | 是 | Phase 1 | `references/phase-1-propose.md`；`references/recovery-guardrails-appendix.md` §3 | 高频循环场景 |
| R2-1 | Phase 2 | apply 返回 blocked | `state: blocked` | 用户确认后回到 Phase 1 或终止 | 是 | Phase 1 | `references/recovery-guardrails-appendix.md` §3.1；`references/phase-2-apply.md` | 典型可恢复异常 |
| R2-2 | Phase 2 | 单个任务实施遇阻塞 | 任务不明确、上下文不足、设计不清 | 用户确认后补充、跳过或终止 | 是 | 当前任务或下一个任务 | `references/phase-2-apply.md` | 局部阻塞 |
| R3-1 | Phase 3 | 无变更可审 | `git diff HEAD` 为空且无未推送提交 | 进入 Phase 5 | 否 | Phase 5 | `references/recovery-guardrails-appendix.md` §3.1；`references/phase-3-review.md` | 空路径处理 |
| R3-2 | Phase 3 | 审查不通过 | 审查结论需要修复 | 用户确认后修复、暂停或终止 | 是 | Phase 3 或 3.1 | `references/phase-3-review.md`；`references/recovery-guardrails-appendix.md` §3 | 主修复回环 |
| R3-3 | Phase 3.1 | fix change 提案不符合预期 | 用户要求修改 fix 提案 | 补充/修改后回到 fix 决策点 | 是 | Phase 3.1 | `references/phase-3.1-fix-review.md` | 复用 Phase 1 语义 |
| R3-4 | Phase 3.1 | 放弃继续 fix 子流程 | 用户不再走 fix-cr 子流程 | 结束子流程后回原 change 的 Phase 5 | 是 | 原 change 的 Phase 5 | `references/phase-3.1-fix-review.md` | 特殊恢复路径 |
| R4-1 | Phase 4 | 归档前发现未完成任务 | 任务状态未完成 | 用户确认后继续归档、回到 Phase 2 或终止 | 是 | Phase 2 或当前 Phase 4 | `references/phase-4-archive.md`；`references/recovery-guardrails-appendix.md` §3.2 | 高风险分支 |
| R4-2 | Phase 4 | verify 命令无法解析 | `opsx-resolve-verify.sh` 返回 `command=null` 或信息不足 | 用户确认后补充 verify 路径 | 是 | Phase 4 | `references/recovery-guardrails-appendix.md` §3.1；`references/phase-4-archive.md` | custom schema 下不得默认跳过 |
| R4-3 | Phase 4 | verify 执行失败 | 验证命令返回非 0 | 用户确认后重试、暂停或终止 | 是 | Phase 4 | `references/recovery-guardrails-appendix.md` §3.1；`references/phase-4-archive.md` | custom schema 下为硬门禁 |
| R4-4 | Phase 4 | `openspec archive` 失败 | `opsx-archive.sh` / `openspec archive` 返回失败 | 用户确认后重试或改走手动归档 | 是 | Phase 4 | `references/recovery-guardrails-appendix.md` §3.1；`references/phase-4-archive.md` | 手动归档须保持与用户选择一致 |
| R4-5 | Phase 4 | 归档目标冲突 | archive 目录同名已存在 | 使用 CLI 自动处理或手动追加后缀 | 否 | Phase 4 | `references/recovery-guardrails-appendix.md` §3.1；`references/phase-4-archive.md` | 非阻断性处理 |
| R5-1 | Phase 5 | 无法唯一确定测试命令 | 多个候选命令都合理 | 用户确认后选择测试命令 | 是 | Phase 5 | `references/recovery-guardrails-appendix.md` §3.1；`references/phase-5-unit-tests.md` | 不应擅自猜测 |
| R5-2 | Phase 5 | 单元测试失败 | 测试命令返回非 0 | 用户确认后重试、跳过或暂停 | 是 | Phase 5 | `references/recovery-guardrails-appendix.md` §3.1；`references/phase-5-unit-tests.md` | 是否允许跳过取决于当前门禁 |
| R5-3 | Phase 5 | 用户选择暂停 | 用户暂不处理单测 | 暂停并保留恢复点 | 是 | Phase 5 | `references/phase-5-unit-tests.md`；`references/recovery-guardrails-appendix.md` §1 | 暂停类标准处理 |
| R6-1 | Phase 6 | 分支落后或分叉 | `git status` / `git fetch` 显示落后或 diverged | 用户确认后 rebase、继续或终止 | 是 | Phase 6 | `references/recovery-guardrails-appendix.md` §3.1；`references/phase-6-merge-push.md` | 继续后续流程需显式提示风险 |
| R6-2 | Phase 6 | rebase 冲突 | `git pull --rebase` 发生冲突 | 用户确认后暂停处理或中止 rebase | 是 | Phase 6 | `references/recovery-guardrails-appendix.md` §3.1；`references/phase-6-merge-push.md` | 需展示冲突文件 |
| R6-3 | Phase 6 | 检测到敏感文件 | 暂存区含 `.env`、密钥、凭据等 | 用户确认后排除、继续或终止 | 是 | Phase 6 | `references/recovery-guardrails-appendix.md` §3.1；`references/phase-6-merge-push.md` | 必须显式警告 |
| R6-4 | Phase 6 | commit 失败 | `git commit` 返回非 0 | 用户确认后修改提交信息、处理问题或终止 | 是 | Phase 6 | `references/phase-6-merge-push.md` | 不应跳过 hook |
| R6-5 | Phase 6 | 推送失败 | `git push` 失败 | 用户确认后 rebase 重试或终止 | 是 | Phase 6 | `references/recovery-guardrails-appendix.md` §3.1；`references/phase-6-merge-push.md` | 保留本地提交 |
| R6-6 | Phase 6 | 合并前工作区不干净 | `git status` 发现未提交或未暂存变更 | 用户确认后 stash、提交或终止 | 是 | Phase 6 | `references/recovery-guardrails-appendix.md` §3.1；`references/phase-6-merge-push.md` | 合并前门禁 |
| R6-7 | Phase 6 | 合并冲突 | `git merge` 冲突 | 用户确认后中止、选 theirs / ours 或暂停手动解决 | 是 | Phase 6 | `references/recovery-guardrails-appendix.md` §3.1；`references/phase-6-merge-push.md` | 需列出冲突文件 |
| R6-8 | Phase 6 | 合并后分支清理失败 | 删除本地或远程分支失败 | 保留当前结果并提示清理失败 | 否 | 当前 Phase 结束 | `references/phase-6-merge-push.md` | 收尾性异常 |

## 3. 维护入口

- 流程入口：`SKILL.md`
- Phase 正文：`references/phase-*.md`
- 恢复总览与规则正文：`references/recovery-guardrails-appendix.md`
- 脚本输出契约：`assets/script-io-conventions.md`
