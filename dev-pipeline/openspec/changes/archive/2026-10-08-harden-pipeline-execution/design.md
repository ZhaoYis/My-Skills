## Context

本次修复对应 proposal.md 所列的十项评审发现。保留 ADR 0001 的 OpenSpec/Pipeline 分层与 ADR 0002 的 Route 矩阵。CLI 新模块使用 TypeScript；随 Skill 分发的脚本维持现有原生 `.mjs` 形态，确保消费方仅依赖 Node 20+，无需 TypeScript loader。

## Goals / Non-Goals

**Goals:** 让 Phase 协议与状态机采用同一 Route 推进接口；用实际 Git 证据检查审查范围与交付恢复；保护用户配置和多 Tool 生命周期。

**Non-Goals:** 不更改 standard 默认跳过审查与单测的策略，不增加自动发布、强制推送或自动删除分支能力。

## Decisions

1. Hook JSON 按所有权合并和卸载，只识别本 Pipeline 的两项 Hook，保留未知字段与其他宿主配置；无效 JSON 在写入前拒绝。
2. Manifest 对 Codex 的 `.agents/` 资产显式归属，兼容旧记录；部分卸载同时更新 active Tool。
3. `next` 只读查询从 config 的 Route Phase 集合计算下一阶段。实施确认独立于中间 Phase 的跳过，完成条件按交付模式校验。
4. Route 升级回到最早新增的前置阶段，清除失效结果、保留历史与已有归档事实。已归档制品可作为升级后的质量检查上下文；不重复归档。
5. init 保存审查基线与空仓库标记，review-scope 同时返回基线到工作区的 diff 与未跟踪文件。旧状态缺基线时显式补齐，不按远程源分支估计范围。
6. delivery-check 用 `ls-remote` 查询真实远程分支，检查最终状态/合并提交是否包含其中，不信任陈旧 tracking ref。Squash 依赖已记录的合并提交和源 tip，不用 source 祖先关系误判失败，不能安全删除时保留源分支并继续标签。
7. 最终状态 commit 后的传输、清理与标签失败保留状态快照，仅暂停执行；恢复入口直接进入 Git 事实检查，不重放 `pause`、门禁补偿或阶段审计写入，重试交付原 commit。

## Risks / Trade-offs

- 远程最新提交对象不在本地 → 明确要求 fetch 后重试，检查脚本不隐式拉取或写状态。
- Squash 冲突解决不能由祖先关系证明内容等价 → 仍需 Phase7 在目标 HEAD 重跑 tests/verify，清理检查仅验证交付提交身份和远程包含关系。
- 本机没有 GitHub 登录和 Windows runner → 执行本机行为测试、类型检查、构建和打包检查，Windows/Linux CI 单列待验证，不能宣称全矩阵通过。

## Migration Plan

消费方通过 sync/upgrade 获取新 Skill 和脚本。旧 Manifest 读取时补齐 Tool 归属，旧状态缺审查基线时由用户明确选择并记录。回滚使用旧 CLI 版本和原始 Asset 备份，不修改已完成的交付记录。
