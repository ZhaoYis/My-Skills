## Why

当前 `opsx-dev-pipeline` skill 的 references 目录下的 8 个 phase 模板文件缺少统一的 formatter 标准描述信息，导致生成的文档缺乏一致性和可识别性。需要在每个模板文件头部添加标准化的元数据描述，以便 AI 工具和用户能够快速识别文档类型、用途和格式规范。

## What Changes

- 为以下 8 个模板文件添加头部 formatter 标准描述信息：
  - `phase-0-entrance.md.hbs`
  - `phase-1-propose.md.hbs`
  - `phase-2-apply.md.hbs`
  - `phase-3-review.md.hbs`
  - `phase-4-unit-tests.md.hbs`
  - `phase-5-archive.md.hbs`
  - `phase-6-commit-push.md.hbs`
  - `phase-7-merge-deliver.md.hbs`
- 每个文件头部将添加包含以下信息的标准描述块：
  - 文档类型标识（phase reference）
  - 阶段名称和编号
  - 用途说明
  - 格式规范（Markdown with Handlebars templates）

## Capabilities

### New Capabilities

- `template-formatter-metadata`: 为 skill reference 模板添加标准化 formatter 描述信息的规范

### Modified Capabilities

（无现有 capability 需要修改）

## Impact

- **受影响代码**: `src/templates/common/skills/opsx-dev-pipeline/references/` 目录下的所有 `.md.hbs` 文件
- **向后兼容性**: 完全兼容，仅添加元数据，不改变现有模板逻辑
- **依赖**: 无新增依赖
- **用户影响**: 生成的文档将具有更清晰的元数据标识，便于 AI 工具解析和用户理解
