## Why

当前 skills 和 commands 文件在 init/sync/upgrade 时如果已存在，会提示用户选择处理方式（覆写/跳过/追加），增加了不必要的交互成本。这些文件是由工具自动生成的模板产物，用户通常不会手动修改，应该直接覆写以保持与最新版本一致。

## What Changes

- 修改 `src/core/assets/manifest.ts` 中 skills 和 commands 相关资产的 `writePolicy` 配置
- 将所有 skill bundle 资产的 `onConflict` 策略从 `prompt` 改为 `overwrite`（适用于 init/sync/upgrade 所有模式）
- 将所有 command 资产的 `onConflict` 策略从 `prompt` 改为 `overwrite`（适用于 init/sync/upgrade 所有模式）
- 其他资产（如 config、readme、gitignore、docs）保持现有的 `prompt` 策略不变

## Capabilities

### New Capabilities

（无新 capability）

### Modified Capabilities

（无现有 capability 需要修改 - 这是纯配置变更，不改变外部行为契约）

**注意**：此变更仅影响内部写入策略配置，不改变对外 API 或用户可见的行为规范。根据 OpenSpec 规范，纯配置/工具变更应设置 `skip_specs: true`。

需要在 `.openspec.yaml` 中设置：
```yaml
skip_specs: true
```

## Impact

- **受影响代码**:
  - `src/core/assets/manifest.ts`：修改资产写入策略配置
- **向后兼容性**: 完全兼容，仅改变冲突处理行为
- **依赖**: 无新增依赖
- **用户影响**: 
  - init/sync/upgrade 时 skills 和 commands 文件会自动覆写，不再提示
  - 其他文件（config、readme 等）保持原有提示行为
  - 用户无法再选择跳过或追加 skills/commands 文件
