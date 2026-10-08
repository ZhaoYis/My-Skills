# pipeline-execution-integrity Specification

## Purpose
确保消费方的 Pipeline 在 Route 选择、审查、交付及中断恢复时遵守同一组可验证约束，同时保护原有宿主配置和多 Tool Asset 的生命周期，避免流程完成标记与实际 Git 交付事实不一致。

## Requirements

### Requirement: 保留用户宿主配置
CLI MUST 在 init、sync、upgrade 与 uninstall 中保留用户字段和无关 Hook；已有 JSON 无效时 MUST 在 Asset 写入前拒绝执行。

#### Scenario: 更新并卸载已有宿主配置
- **WHEN** 宿主配置包含 permissions 与其他 Hook
- **THEN** Pipeline 安装仅更新自身 Hook，卸载仅移除自身 Hook

### Requirement: 保持 Tool 归属与 active Tool 一致
CLI MUST 识别 `.agents/` 下的 Codex Asset，包括旧记录；部分卸载后 active Tool MUST 属于仍安装的 Tool 集合。

#### Scenario: 从多 Tool 安装中移除一个 Tool
- **WHEN** 从 Codex 与 Claude 的混合安装中移除 Codex，然后执行 Sync
- **THEN** Codex Asset 被移除，Codex 不会重新出现在 Manifest 中

### Requirement: 按 Route 推进且保留实施确认
Pipeline MUST 从配置的 Route 推导下一 Phase；所有 Route 离开 Phase2 前 MUST 要求实施确认。

#### Scenario: 轻量 Route 离开实施阶段
- **WHEN** trivial 请求进入 Phase6，或 standard 请求进入 Phase5，但尚未确认实施
- **THEN** 阶段迁移被拒绝

#### Scenario: 已跳过轻量阶段后升级
- **WHEN** change 升级 Route，之前跳过的 Phase 成为必需阶段
- **THEN** Pipeline 回到最早新增的前置 Phase，清除受影响的旧门禁结果并保留审计历史

### Requirement: 审查完整变更范围
Pipeline MUST 纳入相对已记录基线的已提交、工作区和未跟踪实现变更；缺少基线的旧状态 MUST 要求用户明确选择基线。

#### Scenario: 源提交已经推送后审查
- **WHEN** 实施提交已推送，且新增文件仍未跟踪
- **THEN** 实施提交与未跟踪文件都包含在审查范围内

### Requirement: 必需交付动作成功后才允许完成
Pipeline MUST 在完成前检查所选交付模式的事实；merge 交付 MUST 位于 Phase7 且目标分支已推送。

#### Scenario: 目标推送尚未完成
- **WHEN** 合并提交已存在，但目标推送尚未成功
- **THEN** complete 被拒绝

### Requirement: 依据远程证据恢复最终状态交付
Pipeline MUST 区分本地最终状态 commit 与实际远程交付分支包含该 commit 的事实。

#### Scenario: 在最终状态 commit 与 push 之间中断
- **WHEN** push-only 恢复时最终状态已提交到本地，但尚未推送
- **THEN** 继续推送最终状态，不报告交付已完成

#### Scenario: 最终状态 commit 后 push 失败
- **WHEN** 最终状态 commit 已存在，但其推送失败
- **THEN** 已提交快照保持不变，恢复时使用最新远程证据重试交付同一 commit

### Requirement: 接受成功 Squash 交付并安全清理
Pipeline MUST 用已记录的源提交、合并提交与实际远程目标包含关系核验 Squash 交付；缺少源提交祖先关系 MUST NOT 阻断标签或要求强制删除分支。

#### Scenario: 成功 Squash merge
- **WHEN** 已记录的 Squash commit 已推送到目标分支，且源 tip 未改变
- **THEN** 交付核验通过，保留源分支时仍可继续标签步骤
