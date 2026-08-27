## 1. 基础设施：类型与工具配置

- [x] 1.1 在 `src/core/assets/types.ts` 的 `AssetDefinition` 接口中新增 `toolDestinations?: Partial<Record<ToolId, string>>` 字段
- [x] 1.2 修改 `src/config/tools.json` 中 codex 配置：`markers` → `[".agents"]`，`destinations.root` → `".agents"`，`destinations.skills` → `".agents/skills"`，`destinations.commands` → `".agents/skills"`，`userDestinations.commands` → `".agents/skills"`，更新 `postInstallNotes`

## 2. 核心逻辑：destination 解析支持覆盖

- [x] 2.1 修改 `src/core/init/buildInstallPlan.ts`：在解析 `asset.destination` 时，优先查 `asset.toolDestinations?.[toolId]`，未定义时回退到 `asset.destination`。需要在 `expandBundle` 和顶层资产两处都应用此逻辑

## 3. 模板适配：Handlebars helper 与 frontmatter 条件

- [x] 3.1 在 `src/core/init/renderTemplates.ts` 中注册 `isTool` helper（匹配现有 `isLanguage` 模式）：`Handlebars.registerHelper('isTool', function(toolId) { return this.toolId === toolId; })`
- [x] 3.2 修改 `src/templates/common/commands/opsx-dev-pipeline.md.hbs`：frontmatter 用 `{{#if (isTool "codex")}}...{{else}}...{{/if}}` 适配 skill 格式
- [x] 3.3 修改 `src/templates/common/commands/opsx/propose.md.hbs`：同上 frontmatter 适配
- [x] 3.4 修改 `src/templates/common/commands/opsx/apply.md.hbs`：同上
- [x] 3.5 修改 `src/templates/common/commands/opsx/archive.md.hbs`：同上
- [x] 3.6 修改 `src/templates/common/commands/opsx/verify.md.hbs`：同上
- [x] 3.7 修改 `src/templates/common/commands/opsx/sync.md.hbs`：同上
- [x] 3.8 修改 `src/templates/common/commands/opsx/explore.md.hbs`：同上
- [x] 3.9 修改 `src/templates/common/commands/opsx/grill-me.md.hbs`：同上
- [x] 3.10 修改 `src/templates/common/commands/opsx/grilling.md.hbs`：同上
- [x] 3.11 修改 `src/templates/common/commands/opsx/dev-spec-design.md.hbs`：同上

## 4. Manifest 更新：toolDestinations 与资产删除

- [x] 4.1 在 `src/core/assets/manifest.ts` 中为 `opsx-dev-pipeline-command` 添加 `toolDestinations: { codex: '{{commandsDir}}/opsx-dev-pipeline/SKILL.md' }`
- [x] 4.2 为 `opsx-propose-command` 添加 `toolDestinations: { codex: '{{commandsDir}}/opsx-propose/SKILL.md' }`
- [x] 4.3 为 `opsx-apply-command` 添加 `toolDestinations: { codex: '{{commandsDir}}/opsx-apply/SKILL.md' }`
- [x] 4.4 为 `opsx-archive-command` 添加 `toolDestinations: { codex: '{{commandsDir}}/opsx-archive/SKILL.md' }`
- [x] 4.5 为 `opsx-verify-command` 添加 `toolDestinations: { codex: '{{commandsDir}}/opsx-verify/SKILL.md' }`
- [x] 4.6 为 `opsx-sync-command` 添加 `toolDestinations: { codex: '{{commandsDir}}/opsx-sync/SKILL.md' }`
- [x] 4.7 为 `opsx-explore-command` 添加 `toolDestinations: { codex: '{{commandsDir}}/opsx-explore/SKILL.md' }`
- [x] 4.8 为 `opsx-grill-me-command` 添加 `toolDestinations: { codex: '{{commandsDir}}/opsx-grill-me/SKILL.md' }`
- [x] 4.9 为 `opsx-grilling-command` 添加 `toolDestinations: { codex: '{{commandsDir}}/opsx-grilling/SKILL.md' }`
- [x] 4.10 为 `opsx-dev-spec-design-command` 添加 `toolDestinations: { codex: '{{commandsDir}}/opsx-dev-spec-design/SKILL.md' }`
- [x] 4.11 从 manifest 中删除 `codex-docs` 资产定义
- [x] 4.12 从 manifest 中删除 `codex-command-guide` 资产定义

## 5. 测试更新

- [x] 5.1 更新 `test/unit/build-install-plan.test.ts`：codex 路径断言从 `.codex/prompts` 改为 `.agents/skills`，从 `.codex/commands` 改为 `.agents/skills`
- [x] 5.2 更新 `test/unit/scope-selection.test.ts`：codex 现在支持用户级 commands（`supportsUserDestination('commands')` 返回 `true`）
- [x] 5.3 更新 `test/unit/validate-target.test.ts`：codex marker 从 `.codex` 改为 `.agents`
- [x] 5.4 更新 `test/integration/init-matrix.test.ts`：codex 安装路径从 `.codex/prompts/` 和 `.codex/commands/` 改为 `.agents/skills/`
- [x] 5.5 运行 `npm test` 确保所有测试通过

## 6. 验证与收尾

- [x] 6.1 手动验证：用 `--tool codex` 执行 dry-run init，确认输出路径全部在 `.agents/skills/` 下
- [x] 6.2 手动验证：确认 Claude 和 Cursor 的安装路径不受影响
- [x] 6.3 运行 `npm run lint`（biome）确保代码风格通过
