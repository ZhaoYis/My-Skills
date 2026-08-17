## Context

当前 dev-pipeline 在 init/sync/upgrade 时，对于已存在的 skills 和 commands 文件会提示用户选择处理方式。这些文件是工具自动生成的模板产物，用户通常不会手动修改，频繁提示增加了不必要的交互成本。

## Goals / Non-Goals

**Goals:**
- 修改 skills 和 commands 文件的写入策略，使其在冲突时自动覆写
- 保持其他文件（config、readme、gitignore、docs）的现有提示行为不变
- 确保向后兼容，不影响现有项目

**Non-Goals:**
- 不改变文件内容或模板结构
- 不修改其他类型文件的写入策略
- 不添加新的配置选项或命令行参数

## Decisions

### 1. 修改位置选择

**决策**: 在 `src/core/assets/manifest.ts` 中修改资产定义

**理由**:
- 这是资产策略的唯一定义位置
- 集中管理所有资产的写入行为
- 符合现有的配置模式

**替代方案**:
- 在 `fileWritePolicy.ts` 中添加特殊逻辑 → 增加复杂度，不利于维护
- 通过命令行参数控制 → 增加用户认知负担

### 2. 策略值选择

**决策**: 将 `onConflict` 设置为 `'overwrite'`

**理由**:
- `'overwrite'` 是现有的策略值，无需添加新逻辑
- 与 OpenSpec commands 的 init 模式行为一致
- 语义清晰：直接覆写，无需用户干预

**替代方案**:
- 添加新的 `'force-overwrite'` 策略 → 与 `'overwrite'` 语义重复
- 使用 `'skip'` → 与需求相反

### 3. 影响范围

**决策**: 仅修改 skill bundles 和 commands 的 `onConflict` 配置

**受影响的资产**:
- `opsx-dev-pipeline-skill-bundle`
- `opsx-propose-command`
- `opsx-apply-command`
- `opsx-archive-command`
- `opsx-verify-command`
- `opsx-sync-command`
- `opsx-explore-command`

**不受影响的资产**:
- `common-readme` (保持 `prompt`)
- `common-gitignore` (保持 `prompt`)
- `stack-config` (保持 `prompt`)
- `claude-docs` / `cursor-docs` / `codex-docs` (保持 `prompt`)

**理由**:
- Skills 和 commands 是工具核心功能，需要保持最新
- 用户很少手动修改这些文件
- 其他文件（如 config、readme）用户可能会自定义，需要保留选择权

## Risks / Trade-offs

**风险 1**: 用户自定义的 skills/commands 修改会被覆盖
- **缓解**: 这些文件本来就是工具生成的模板，用户修改的情况极少
- **缓解**: 如果用户需要自定义，可以通过 fork 或扩展机制实现

**风险 2**: 用户可能期望有选择权
- **缓解**: 这是工具自动化的核心文件，自动更新符合用户预期
- **缓解**: 其他文件（config、readme）仍保留选择权

**权衡**: 自动化 vs 控制权
- 选择自动覆写 skills/commands，牺牲少量控制权换取更好的用户体验
- 理由：这些文件是工具的核心功能，保持最新比用户自定义更重要

## Migration Plan

### 部署步骤

1. **修改配置文件**
   - 更新 `src/core/assets/manifest.ts` 中的资产策略
   - 无需修改其他代码

2. **测试验证**
   - 运行 `npm test` 确保现有测试通过
   - 手动测试 init/sync/upgrade 流程
   - 验证 skills/commands 自动覆写行为
   - 验证其他文件仍提示用户

3. **发布更新**
   - 更新版本号（patch 版本）
   - 发布新版本

### 回滚策略

- 如果新策略导致问题，可以回滚到旧版本
- 旧版本会恢复提示行为
- 不影响已生成的文件

### 用户迁移

- 现有项目无需迁移
- 下次运行 init/sync/upgrade 时自动应用新策略
- 用户会注意到 skills/commands 不再提示
