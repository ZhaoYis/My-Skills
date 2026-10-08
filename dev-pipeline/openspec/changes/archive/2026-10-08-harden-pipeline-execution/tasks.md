## 1. CLI 配置与 Tool 生命周期

- [x] 1.1 Hook 安装/同步/升级/卸载只修改 Pipeline 所有条目，配置保留、幂等与坏 JSON 回归通过
- [x] 1.2 修复 Codex Asset 归属及部分卸载 active Tool，混合安装→卸载→Sync 测试通过

## 2. 状态机与 Phase 协议

- [x] 2.1 修复轻量 Route 实施确认、升级补偿、next 查询，三档 Route 行为测试通过
- [x] 2.2 完成条件按交付模式检查并保证幂等，未推送目标分支时 complete 拒绝
- [x] 2.3 对齐所有 Phase reference，trivial/standard/full 均可推进，归档后升级可复用制品

## 3. Git 事实与恢复

- [x] 3.1 保存审查基线并生成完整范围，覆盖已推送、新增文件、空仓库和旧状态错误路径
- [x] 3.2 增加最终状态远程包含检查，commit 后 push 前中断、推送失败重试及陈旧 tracking ref 测试通过
- [x] 3.3 按三种合并策略检查交付证据，Squash 保留源分支继续标签、源 tip 改变时拒绝清理

## 4. 综合测评

- [x] 4.1 macOS 本机全套测试、类型检查、lint、构建与打包检查通过；OpenSpec 规范校验通过
- [x] 4.2 独立行为测评完成并记录结果、测评覆盖与跨平台限制
