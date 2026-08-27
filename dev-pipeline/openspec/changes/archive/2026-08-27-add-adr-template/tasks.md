## 1. 创建 ADR 模板文件

- [x] 1.1 创建 `src/templates/common/schemas/backend/templates/adr.md.hbs`，使用 Michael Nygard ADR 格式（Title、Status、Context、Decision、Alternatives Considered、Consequences），包含引导注释
- [x] 1.2 创建 `src/templates/common/schemas/fullstack/templates/adr.md.hbs`，在 backend 版本基础上增加前后端架构决策相关的引导提示

## 2. 更新 Schema 定义

- [x] 2.1 在 `src/templates/common/schemas/backend/schema.yaml.hbs` 的 `artifacts` 列表中新增 `adr` artifact，标记为 conditional（instruction 中说明用户选择是否生成），`requires` 为 `proposal`
- [x] 2.2 在 `src/templates/common/schemas/fullstack/schema.yaml.hbs` 的 `artifacts` 列表中新增 `adr` artifact，标记为 conditional（instruction 中说明用户选择是否生成），`requires` 为 `proposal`

## 3. 验证

- [x] 3.1 运行 `npm run build` 确保模板编译通过
- [x] 3.2 在 backend 栈下执行 `opsx init --stack backend` 验证 ADR 模板作为可选 artifact 出现
- [x] 3.3 在 fullstack 栈下执行 `opsx init --stack fullstack` 验证 ADR 模板作为可选 artifact 出现
- [x] 3.4 在 frontend 栈下执行 `opsx init --stack frontend` 确认 ADR 模板不出现