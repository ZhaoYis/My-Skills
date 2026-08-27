## 1. 创建 command 模板

- [x] 1.1 创建 `src/templates/common/commands/opsx/init.md.hbs`，遵循现有 command 模式（frontmatter 适配各工具，正文委托给 `opsx-init` skill）

## 2. 创建 skill 模板

- [x] 2.1 创建 `src/templates/common/skills/opsx-init/SKILL.md.hbs`，包含完整的项目分析流程（检测技术栈、语言、AI 工具等）和 config.yaml 生成逻辑，参考 `openspec/config.yaml` 的格式

## 3. 注册资产

- [x] 3.1 在 `src/core/assets/manifest.ts` 中注册 `opsx-init-command` 资产（template，指向 `commands/opsx/init.md.hbs`）
- [x] 3.2 在 `src/core/assets/manifest.ts` 中注册 `opsx-init-skill-bundle` 资产（bundle，指向 `skills/opsx-init/`）
- [x] 3.3 在 `src/core/init/buildInstallPlan.ts` 的 `buildTemplateContext` 中添加 `init` 命令调用映射

## 4. 验证

- [x] 4.1 运行 `npm run build` 确保编译通过
- [x] 4.2 运行 `npm test` 确保无回归
- [x] 4.3 手动验证：`opsx init --dry-run` 确认命令和 skill 资产出现在输出列表中