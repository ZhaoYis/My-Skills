---
name: pipeline-branch-matrix
description: 全流程分支覆盖矩阵，用于验证阶段跳转、决策点、恢复路径与关键护栏是否完整一致。
---

## 模拟需求

- 场景：为用户资料页新增头像上传，并同步后端接口校验与前端预览
- schema：自定义 schema
- 元数据：`[backend, frontend]`

## 分支覆盖矩阵

| Branch ID | 阶段 | 场景 | 期望路径 |
|---|---|---|---|
| P0-ENV-OK | Phase 0 | openspec 与 git 可用 | 继续入口判断 |
| P0-ENV-NO-OPENSPEC | Phase 0 | openspec 不可用 | 提示安装并退出 |
| P0-ENV-NO-GIT | Phase 0 | 非 git 仓库 | 提示初始化并退出 |
| P0-INPUT-REQ | Phase 0 | 输入需求文本 | 新建 change，进入 Phase 1 |
| P0-INPUT-CHANGE | Phase 0 | 输入已有 change | 进入续跑判断 |
| P0-INPUT-EMPTY | Phase 0 | 无输入 | 询问后再分流 |
| P0-SCHEMA-DEFAULT | Phase 0 | 默认 schema | 走默认路径 |
| P0-SCHEMA-CUSTOM | Phase 0 | 自定义 schema | 启用 schema-aware 增强 |
| P0-SCHEMA-UNKNOWN | Phase 0 | schema 无法识别 | 警告并降级继续 |
| P0-RESUME-P1 | Phase 0 | 制品不完整 | 从 Phase 1 Step 3 续跑 |
| P0-RESUME-P2 | Phase 0 | 制品完成、任务未完成 | 从 Phase 2 续跑 |
| P0-RESUME-P3 | Phase 0 | 任务完成、无审查报告 | 从 Phase 3 续跑 |
| P0-RESUME-P5 | Phase 0 | 已有审查报告、未归档 | 从 Phase 5 续跑，完成后进 Phase 4 |
| P0-RESUME-P6-DIRTY | Phase 0 | 已归档且工作区有未提交变更 | 从 Phase 6 续跑 |
| P0-RESUME-P6-PUSH | Phase 0 | 已归档且已提交未推送 | 从 Phase 6 Step 19 续跑 |
| P0-CONFIRM-CONTINUE | Phase 0 | 选择从检测阶段继续 | 按目标 Phase 续跑 |
| P0-CONFIRM-RESTART | Phase 0 | 选择新建 change | 回到 Phase 1 |
| P0-CONFIRM-TERMINATE | Phase 0 | 选择终止 | 退出 |
| P1-NAME-NEW | Phase 1 | change 名无冲突 | 创建 change |
| P1-NAME-CONFLICT-REUSE | Phase 1 | 名称冲突并复用 | 走 3.a |
| P1-NAME-CONFLICT-RENAME | Phase 1 | 名称冲突并改名 | 重新创建 |
| P1-ARTIFACTS-DEFAULT | Phase 1 | 默认 schema 制品 | proposal/design/specs/tasks |
| P1-ARTIFACTS-CUSTOM | Phase 1 | 自定义 schema 制品 | proposal/adr/specs/design/tasks |
| P1-META-GENERIC | Phase 1 | `.openspec.yaml` 缺失 | 补齐元数据 |
| P1-GATE-CONFIRM | Phase 1 | 确认提案 | 进入 Phase 2 |
| P1-GATE-REVISE | Phase 1 | 修改提案 | 循环至重新确认 |
| P1-GATE-TERMINATE | Phase 1 | 终止流程 | 退出 |
| P2-BLOCKED-BACK | Phase 2 | `state=blocked` | 回到 Phase 1 |
| P2-BLOCKED-TERM | Phase 2 | `state=blocked` 且终止 | 退出 |
| P2-ALL-DONE | Phase 2 | `state=all_done` | 进入 Phase 3 |
| P2-TASK-CLARIFY | Phase 2 | 任务阻塞后补充说明 | 继续当前任务 |
| P2-TASK-SKIP | Phase 2 | 任务阻塞后跳过 | 标记 `- [~]` |
| P2-TASK-TERM | Phase 2 | 任务阻塞后终止 | 退出 |
| P2-DONE-REVIEW | Phase 2 | 实施完成后审查 | 进入 Phase 3 |
| P2-DONE-PAUSE | Phase 2 | 实施完成后暂停 | 退出并给恢复指引 |
| P2-DONE-SKIP-REVIEW | Phase 2 | 实施完成后跳过审查 | 进入 Phase 5，后续进 Phase 4 |
| P2-DONE-TERM | Phase 2 | 实施完成后终止 | 退出 |
| P3-NO-DIFF | Phase 3 | 无变更可审 | 进入 Phase 5 |
| P3-NO-REMOTE | Phase 3 | 无远程跟踪分支 | 提示后进入 Phase 5 |
| P3-SEVERE-FIX-CR | Phase 3 | 严重问题走 fix-cr | 进入 Phase 3.1 |
| P3-SEVERE-DIRECT-FIX | Phase 3 | 严重问题直接修复 | 回到 Phase 3 |
| P3-SEVERE-PAUSE | Phase 3 | 严重问题暂停 | 退出 |
| P3-SEVERE-IGNORE | Phase 3 | 严重问题忽略 | 进入 Phase 5 |
| P3-SEVERE-TERM | Phase 3 | 严重问题终止 | 退出 |
| P3-MINOR-CONTINUE | Phase 3 | 一般问题继续 | 进入 Phase 5 |
| P3-MINOR-FIX-CR | Phase 3 | 一般问题走 fix-cr | 进入 Phase 3.1 |
| P3-MINOR-PAUSE | Phase 3 | 一般问题暂停 | 退出 |
| P3-MINOR-TERM | Phase 3 | 一般问题终止 | 退出 |
| P3-ZERO | Phase 3 | 无问题 | 直接进 Phase 5 |
| P3-DIRECT-FIX-LIMIT | Phase 3 | 直接修复超过 3 轮 | 强制暂停 |
| P31-CONFIRM | Phase 3.1 | fix-cr 提案确认 | 进入 Apply |
| P31-REVISE | Phase 3.1 | fix-cr 提案修改 | 回到提案门禁 |
| P31-ABANDON | Phase 3.1 | 放弃 fix-cr | 原 change 从 Phase 5 续跑 |
| P31-ARCHIVE-SKIP-SPECS | Phase 3.1 | 修复 change 无 delta specs | `--skip-specs` 归档 |
| P31-ARCHIVE-MERGE-SPECS | Phase 3.1 | 修复 change 有 delta specs | 归档并合并 specs |
| P5-NEED | Phase 5 | 需要补单测 | 进入子流程 A |
| P5-SKIP | Phase 5 | 不需要补单测 | 进入 Phase 4 |
| P5-PAUSE | Phase 5 | 暂停 | 退出并可从 Step 16 续跑 |
| P5-CMD-SCHEMA | Phase 5 | 按 schema/stacks 推导命令 | 使用 schema 优先命令 |
| P5-CMD-CONFIG | Phase 5 | 按 config 明示规则推导命令 | 使用 config 规则 |
| P5-CMD-HEURISTIC | Phase 5 | 按构建文件推导命令 | 使用仓库启发式 |
| P5-CMD-ASK | Phase 5 | 多候选命令 | 让用户确认 |
| P5-FAIL-RETRY | Phase 5 | 测试失败后修复重试 | 回到测试执行 |
| P5-FAIL-TERM | Phase 5 | 测试失败后终止 | 退出 |
| P5-PASS | Phase 5 | 测试通过 | 进入 Phase 4 |
| P4-UNFINISHED-CONTINUE | Phase 4 | 未完成项仍继续归档 | 继续 Phase 4 |
| P4-UNFINISHED-BACK | Phase 4 | 未完成项回到实施 | 回到 Phase 2 |
| P4-UNFINISHED-TERM | Phase 4 | 未完成项终止 | 退出 |
| P4-VERIFY-BACKEND | Phase 4 | backend verify | `./scripts/validate.sh backend` |
| P4-VERIFY-FRONTEND | Phase 4 | frontend verify | `./scripts/validate.sh frontend` |
| P4-VERIFY-ALL | Phase 4 | fullstack verify | `make validate` 或 `./scripts/validate.sh all` |
| P4-VERIFY-SKIP | Phase 4 | 默认 schema 无 verify 规则 | 跳过 verify |
| P4-VERIFY-UNRESOLVED | Phase 4 | verify 命令无法解析 | 按错误处理走人工确认 |
| P4-VERIFY-FAIL-RETRY | Phase 4 | verify 失败后重试 | 回到 Step 13 |
| P4-VERIFY-FAIL-PAUSE | Phase 4 | verify 失败后暂停 | 退出 |
| P4-VERIFY-FAIL-TERM | Phase 4 | verify 失败后终止 | 退出 |
| P4-DELTA-SYNC | Phase 4 | 同步 delta 到主 specs | archive 不带 `--skip-specs` |
| P4-DELTA-SKIP | Phase 4 | 不同步 delta | archive 带 `--skip-specs` |
| P4-ARCHIVE-CLI | Phase 4 | 正常归档 | 使用 `opsx-archive.sh` |
| P4-ARCHIVE-FALLBACK | Phase 4 | archive 失败手工降级 | `mkdir` + `mv` |
| P4-POST-MERGE | Phase 4 | 提交并合并 | 进入 Phase 6 merge 路径 |
| P4-POST-PUSH | Phase 4 | 仅提交推送 | 进入 Phase 6 push-only 路径 |
| P4-POST-TERM | Phase 4 | 终止流程 | 退出 |
| P6-DIVERGED-REBASE | Phase 6 | 分支落后/分叉后 rebase | 继续 |
| P6-DIVERGED-IGNORE | Phase 6 | 分支落后/分叉后忽略 | 继续 |
| P6-DIVERGED-TERM | Phase 6 | 分支落后/分叉后终止 | 退出 |
| P6-SENSITIVE-EXCLUDE | Phase 6 | 检测敏感文件后排除 | 继续 |
| P6-SENSITIVE-INCLUDE | Phase 6 | 检测敏感文件后包含 | 继续 |
| P6-SENSITIVE-TERM | Phase 6 | 检测敏感文件后终止 | 退出 |
| P6-COMMIT-CONFIRM | Phase 6 | 确认提交信息 | commit |
| P6-COMMIT-EDIT | Phase 6 | 修改提交信息 | commit |
| P6-COMMIT-CANCEL | Phase 6 | 取消提交 | 退出并给恢复指引 |
| P6-NO-DIFF | Phase 6 | 无可提交变更 | 结束本阶段 |
| P6-PUSH-OK | Phase 6 | push 成功 | 继续/结束 |
| P6-PUSH-RETRY | Phase 6 | push 失败后 rebase 重试 | 重试 push |
| P6-PUSH-TERM | Phase 6 | push 失败后终止 | 退出 |
| P6-MERGE-TARGET | Phase 6 | 选择目标分支 | main/qa/stg/develop/other |
| P6-MERGE-STRATEGY | Phase 6 | 选择合并策略 | standard/squash/no-ff |
| P6-MERGE-ABORT | Phase 6 | 合并冲突中止 | 退出 |
| P6-MERGE-THEIRS | Phase 6 | 合并冲突 theirs | 继续 |
| P6-MERGE-OURS | Phase 6 | 合并冲突 ours | 继续 |
| P6-MERGE-MANUAL | Phase 6 | 合并冲突手动解决 | 暂停 |
| P6-BRANCH-KEEP | Phase 6 | 合并后保留源分支 | 结束 |
| P6-BRANCH-DELETE | Phase 6 | 合并后删除源分支 | 结束 |
| R-ASK-FALLBACK | Recovery | AskQuestion 不可用 | 使用编号选项 |
| R-PAUSE-RESUME | Recovery | 各阶段暂停后续跑 | 用 change 名从断点恢复 |
| R-FORCED-EXIT | Recovery | 执行方想中途退出 | 必须征得用户同意 |
