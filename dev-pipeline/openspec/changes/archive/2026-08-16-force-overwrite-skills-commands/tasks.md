## 1. 配置修改

- [x] 1.1 修改 `src/core/assets/manifest.ts` 中 `opsx-dev-pipeline-skill-bundle` 的 `onConflict` 为 `overwrite`
- [x] 1.2 修改 `src/core/assets/manifest.ts` 中所有 `opsx-*-command` 资产的 `onConflict` 为 `overwrite`

## 2. 测试验证

- [x] 2.1 运行 `npm test` 确保现有测试通过
- [x] 2.2 手动测试 init 流程，验证 skills/commands 自动覆写
- [x] 2.3 手动测试 sync 流程，验证 skills/commands 自动覆写
- [x] 2.4 手动测试 upgrade 流程，验证 skills/commands 自动覆写
- [x] 2.5 验证其他文件（config、readme、gitignore、docs）仍提示用户

## 3. 文档更新

- [x] 3.1 更新 README.md 说明 skills/commands 的自动覆写行为
