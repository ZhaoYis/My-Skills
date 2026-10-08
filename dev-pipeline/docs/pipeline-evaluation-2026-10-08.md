# Pipeline 修复与测评记录

日期：2026-10-08。范围：本次评审的十项问题及最终状态推送失败后的恢复衔接。

本机测评通过：63 个测试文件、641 项测试全部通过，类型检查、lint、构建、打包与 Init 干运行通过。独立消费方测评完成三条路径。跨平台 CI 尚未验证，不能据此宣称发布门禁的完整矩阵全绿。

## 问题与验证对应

| # | 评审问题 | 修复行为 | 主要验证 |
| --- | --- | --- | --- |
| 1 | Hook 配置覆盖用户权限和其他 Hook | 按所有权合并；坏 JSON 在 Asset 写入/删除前拒绝；卸载保留用户配置 | `merge-hook-config.test.ts`、`hooks/config-preservation.test.ts` |
| 2 | Codex `.agents/` Asset 缺少 Tool 归属 | 识别项目和 user Scope 路径，并兼容旧 Manifest | `manifest-io.test.ts`、`multi-tool-lifecycle.test.ts` |
| 3 | 部分卸载后 active Tool 残留，Sync 复活已卸载 Tool | active Tool 始终属于剩余 `tools`；Sync 使用已安装集合 | `multi-tool-lifecycle.test.ts` |
| 4 | 轻量 Route 绕过实施确认 | 离开 Phase2 的确认检查先于中间 Phase 跳过判断 | `state-routing.test.ts` |
| 5 | merge 在 Phase6 或目标未推送时可 complete | 按 local-only / push-only / merge 分别检查 Phase 和交付事实，重复完成幂等 | `state-routing.test.ts`、`pipeline-state.test.ts` |
| 6 | 后期升级 Route 无法补做已跳过阶段 | 回到最早新增前置 Phase，清除失效门禁，保留历史和适用归档事实；completed 拒绝升级 | `state-routing.test.ts`、独立场景 B |
| 7 | Phase reference 固定跳转与轻量 Route 冲突 | `next` 查询配置的下一 Phase 后再 transition；trivial 直接实施；脚本绝对路径从消费方仓库调用 | `phase-protocol.test.ts`、四种 Tool 的 `init-matrix.test.ts`、场景 A/B |
| 8 | 审查漏掉未跟踪文件和已推送实现 | 保存基线，纳入已提交/工作区 diff 和未跟踪文件；空仓库覆盖首次提交，旧状态明确补基线 | `pipeline-git-evidence.test.ts`、场景 B |
| 9 | 最终状态 commit 后未 push 就报告完成 | 区分 `localCommitted` 和实际远程 `remoteContains`，使用新鲜 ls-remote；失败不改已提交快照，恢复仅补推 | `pipeline-git-evidence.test.ts`、独立恢复场景 C |
| 10 | Squash 缺少源祖先关系导致清理阻断标签 | 按三种合并策略核验交付；Squash 可保留源分支继续标签；源 tip 改变拒绝旧证据清理，已删除分支可恢复 | `pipeline-git-evidence.test.ts` |

## 自动化验证

运行环境：macOS arm64，Node.js v24.11.1，Git 2.50.1。所有真实 Git 推送均指向临时目录中的本地裸仓库。

| 检查 | 结果 |
| --- | --- |
| 修复前 `npm test` | 57 个文件、590 项测试通过 |
| 修复后 `npm test` | 63 个文件、641 项测试通过，94.16 秒 |
| 最后 Phase 文本修正后的定向测试 | `phase-protocol.test.ts` + `phase-0-route-evaluation.test.ts`，12 项通过 |
| `npm run typecheck` | 通过 |
| `npm run lint` | 通过，136 个源代码/测试文件 |
| `npm run build` | 通过 |
| `npm run pack:check` | 通过，256 个打包文件；新增 Git evidence 脚本包含在 Bundle 中 |
| `npm run init:smoke` | 通过，仅 dry-run |
| `git diff --check` | 通过 |
| OpenSpec strict validate | 通过 |

全量测试同时覆盖已有 Hook、安全拦截、CLI 生命周期、Route、原生 OpenSpec 脚本集成及四种 Tool 模板渲染。新测试使用真实临时 Git 仓库，覆盖远程落后、陈旧 tracking ref、源分支移动、空仓库与失败退出码。

## 独立消费方测评

独立 Agent 读取渲染 Skill 并执行命令，没有修改实现源码。A/B 共记录 213 条命令，两个非零退出均为检查暂存差异的预期 `git diff --cached --quiet` exit 1。

| 场景 | 实际路径与结果 |
| --- | --- |
| A：README 拼写修正 | trivial：Phase0 → Phase2 → Phase6，local-only；无提案制品、无补造质量通过结果；最终 `completed`、`localCommitted=true`、工作区干净 |
| B：已有 standard 选择合并 | Phase6 升级 full 回到 Phase3；审查已推送实现、补跑 4 项 Node 测试和 verify、复用原归档；在 main 重跑验证后推送合并和最终状态；`remoteContains=true`、`delivered=true` |
| C：最终状态推送失败后恢复 | finalize 后将本地 origin 临时移走，push exit 128、远程核验 exit 5；恢复 origin 时仍为 `remoteContains=false`，仅补推后变为 true；JSON、finalize SHA 均不变 |

场景 C 共 70 条命令，最终状态文件 2761 字节，前后 SHA256 均为 `4dca56516a11aa782e363d757366728e3608a6494fd78815f179e214c4f00297`；finalize SHA 为 `5e8aee6ff7dff2dbcf60f7abd81b3e0d8be1874a`，状态文件历史仅有 1 次提交，finalize 后写状态命令为 0。

独立 A/B 初始测评时存在 4 个文件的快照差异，随后对当前源码重新核验 A/B final-state 和 B merge，均通过。最后对 Phase0 completed 恢复入口、Phase6 模式切换与补推、SKILL/Phase7 快照保留约束进行文本复核，协议一致。

机器证据已保存到 `docs/evaluation/pipeline-2026-10-08/`：`scenario-a-result.json`、`scenario-b-result.json`、`current-source-recheck.json`、`snapshot-sha256.json`、`final-push-recovery.json`。完整命令日志及临时 Git 仓库分别位于 `/var/folders/6f/h440pn6d6lbb_szrsths70dc0000gn/T/pipeline-forward-eval-GL0c4i/` 和 `/var/folders/6f/h440pn6d6lbb_szrsths70dc0000gn/T/pipeline-final-recovery-5LnIin/`；临时目录可能被系统清理。

## 测评边界

- 本机没有 GitHub 登录，也没有可调用的 Windows/Linux runner；未运行三平台 × Node 20/22/24 的 CI 矩阵。提交/发布前仍需该矩阵通过。
- 独立 A/B 的 OpenSpec Preflight 使用 fixture CLI，未在这两条路径实测原生 propose/archive；已有原生集成测试与本次 OpenSpec strict 校验通过。
- 本地裸仓库验证 Git 包含关系和中断恢复，未验证真实网络认证或托管平台的分支保护；分支清理/标签失败后的协议经过复核，未做独立故障注入。
- 消费方已有安装需要 Sync/Upgrade 才能获得新 Skill 与脚本。旧状态缺审查基线时要求用户明确补齐；旧版已 finalize 后又 pause 的快照需要按差异事实处理，不能当成新协议中的干净最终提交。
