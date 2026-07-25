# opsx-dev-pipeline 健壮性修复方案

## 目标

将 `opsx-dev-pipeline` 从依赖 Agent 猜测的提示流程，修复为具备稳定脚本协议、显式状态迁移、安全 Git 门禁和可信自动化验证的生产级 Skill 模板。

## 实施清单

### 工作包 0：方案与基线

- [x] ✅ 将完整修复方案写入 `docs/opsx-dev-pipeline-fix-plan.md`。
- [x] ✅ 记录修复前测试、类型检查和脚本验证基线。

修复前基线（2026-07-25）：

- `npm test`：49 条测试通过，但 `init-matrix.test.ts` 因语法错误导致 1 个 suite 失败。
- `npm run typecheck`：失败，主要原因是 `Phaseof` 等错误替换。
- `npm run lint`：失败，扫描了 `dist/` 等生成物，共报告 181 个错误。
- `test-pipeline npm test`：失败，子目录实际解析到 Node.js 16.13.2，与 Vitest/项目要求不兼容。
- `bash -n templates/common/skills/opsx-dev-pipeline/scripts/*.sh`：全部通过。

### 工作包 1：恢复测试可信度

- [x] ✅ 修复 `Phaseof`、`Phase===`、损坏变量名和错误文案替换造成的 TypeScript 语法问题。
- [x] ✅ 让测试报告状态由必需断言计算，禁止失败断言被标记为 `pass`。
- [x] ✅ 移除测试编排器固定返回 `pass` 的伪 Agent 执行路径。
- [x] ✅ 清理测试提示中的不存在脚本和 `git add -A`，使其与正式 Skill 一致。
- [x] ✅ 为 `test-pipeline` 声明 Node.js 20+，并避免使用不兼容运行时。
- [x] ✅ 调整 lint 范围，排除 `dist/`、报告和其他生成物。

验收：`npm run typecheck`、`npm run lint`、`npm test` 均通过；构造失败断言时报告必须为失败。

### 工作包 2：脚本协议与预检

- [x] ✅ 新增公共 Shell 库，统一参数校验、仓库根目录、名称校验和 JSON 错误输出。
- [x] ✅ 修复 OpenSpec 1.6 隐式根被误判为已初始化的问题。
- [x] ✅ 修复 `dev-pipeline-instructions.sh` 在 `set -e` 下丢失结构化错误的问题。
- [x] ✅ 统一所有脚本的退出码和 stdout/stderr 契约。
- [x] ✅ 删除未使用、不可移植的超时实现和失效退出码说明。
- [x] ✅ 为关键脚本增加 mock OpenSpec/Git 契约测试。

验收：全部脚本通过 `bash -n`；成功和失败路径均输出单个合法 JSON；从仓库子目录调用仍解析到正确根目录。

### 工作包 3：持久化状态机与 Phase 0-5

- [x] ✅ 新增原子读写的状态脚本和版本化状态结构。
- [x] ✅ 为 Phase 0-5 定义前置条件、完成条件和允许的状态迁移。
- [x] ✅ 禁止 Phase1 未确认进入 Phase2，禁止 `all_done` 绕过决策点 2。
- [x] ✅ 记录决策、审查轮次、测试、verify、归档路径和恢复信息。
- [x] ✅ 恢复时优先读取状态，再与 OpenSpec/Git 事实核对；不一致时暂停。
- [x] ✅ 增加状态迁移、非法跳转和中断恢复测试。

验收：任意 Phase 中断后可确定性恢复；非法阶段跳转返回非零和结构化原因。

### 工作包 4：安全 Git 交付

- [x] ✅ 在任何 checkout 前先确认并记录 source/target branch。
- [x] ✅ 重构 commit、source push、merge、target push 为独立确认门禁。
- [x] ✅ 修复 Standard、Squash、No-ff 命令和策略对应回滚方式。
- [x] ✅ 冲突改为逐文件处理，移除全局 ours/theirs 快捷操作。
- [x] ✅ 合并后重新执行 verify/tests，再允许 target push。
- [x] ✅ 删除分支和创建标签增加前置校验、显式确认和安全命令。
- [x] ✅ 使用隔离 bare remote 测试落后、分叉、冲突和三种合并策略。

验收：没有确认不得发生 commit/push/merge/delete/tag；任何失败都能恢复到明确状态。

### 工作包 5：Skill 与跨工具适配

- [x] ✅ frontmatter 只保留 `name` 和包含完整触发条件的 `description`。
- [x] ✅ 新增 `agents/openai.yaml` 并确保随 bundle 安装。
- [x] ✅ 为 Claude Code、Cursor、Codex 明确 `<SKILL_ROOT>` 或入口语义。
- [x] ✅ 为 AskQuestion 和任务跟踪提供无专用工具时的降级策略。
- [x] ✅ 将 Cursor `alwaysApply` 改为按需触发。
- [x] ✅ 更新安装矩阵、README 和模板断言。

验收：三个适配器的渲染产物无未解析变量；渲染后的 Skill 通过官方 `quick_validate.py`。

### 工作包 6：完整验证与发布门禁

- [x] ✅ 增加 OpenSpec 未安装、隐式根、已初始化、损坏输出和归档恢复场景。
- [x] ✅ 增加 review/test/verify 失败及三轮上限场景。
- [x] ✅ 运行 typecheck、lint、主测试、test-pipeline、build 和 pack 检查。
- [x] ✅ 运行 `bash -n`，并在可用时运行 ShellCheck。
- [x] ✅ 检查所有模板引用、脚本权限、状态协议和未解析变量。
- [x] ✅ 使用全新 Agent 上下文进行前向验证；若当前环境不能启动隔离 Agent，记录为人工发布门禁。

最终验证记录（2026-07-25）：

- `npm run typecheck`：通过。
- `./node_modules/.bin/tsc --noEmit -p test-pipeline/tsconfig.json`：通过。
- `npm run lint`：退出码 0；保留仓库既有的非阻断 warning/info。
- `npm test`：19 个测试文件、96 个测试全部通过。
- `npm run test:pipeline`：7 个场景文件、41 个测试全部通过。
- `npm run build`：通过。
- `npm_config_cache=/tmp/opsx-dev-pipeline-npm-cache npm run pack:check`：通过；使用隔离 cache 避免用户级 npm cache 的历史所有权问题。
- 全部 Shell 脚本 `bash -n` 与状态脚本 `node --check`：通过。
- Claude Code、Cursor、Codex 三种全新渲染产物均通过官方 `quick_validate.py`，引用存在、包装脚本可执行且无未解析变量。
- 当前机器未安装 ShellCheck：列为发布 CI 必跑门禁，不伪造本地验证结果。
- 当前会话规则禁止自行启动隔离 Agent：全新 Agent 前向执行列为发布前人工门禁；自动化矩阵已覆盖三适配器渲染与命令契约。

验收：全部自动化门禁通过，测试报告无假阳性，工作区只包含本方案范围内的变更。

## 发布策略

按工作包顺序提交。工作包 1 和 2 属于阻断级修复；工作包 3 和 4 完成前不得宣称流水线可安全恢复或自动合并；工作包 5 和 6 完成后才可发布新模板版本。
