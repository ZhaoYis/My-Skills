## Why

当前 Pipeline 的 Phase 协议与状态机不一致，轻量 Route 会断路或绕过确认，审查与交付恢复缺少 Git 事实证据。CLI 同时存在覆盖用户 Hook 配置、多 Tool 归属与卸载后 Manifest 不一致的问题，需要修复并补齐行为测评。

## What Changes

- 修复 Hook JSON 合并与 Tool Asset 生命周期，保留消费方配置。
- 统一 Route 的下一 Phase 查询、实施确认、升级补偿和交付完成门禁。
- 保存审查基线，覆盖已提交、未提交及新增文件。
- 增加最终状态远程包含检查和按合并策略的交付证据检查。
- 修正 Phase reference，补齐三档 Route 和 Git 中断恢复回归测试。

## Capabilities

### New Capabilities

- `pipeline-execution-integrity`：Route 推进、审查范围、交付事实和多 Tool 生命周期的完整性约束。

### Modified Capabilities

无。保持 ADR 0002 的三档 Phase 矩阵及只允许升级的规则。

## Impact

影响 CLI 的 Asset 写入与 Manifest 管理、Pipeline Skill 和附属 Node.js 脚本。新增脚本无外部依赖，维持 Node 20+ 及 macOS/Linux/Windows 支持。旧状态缺审查基线时要求明确补齐，不自动认定无变更。
