# Init Config Schema 合并修复

## 背景

当 `init` 在已安装过 OpenSpec 的项目（即 `openspec/config.yaml` 已存在）上运行时，会触发 `config-merge` 追加策略。`executeInstallPlan.ts` 中的 `mergeConfigContent()` 函数目前只处理：

1. `mergeConfigLanguage()` — 更新 `language:` 和 `rules.language`
2. `appendConfigContext()` — 追加缺失的 context 行

但它**没有**更新 `schema:` 字段。如果用户用不同的 stack 重新初始化（例如从 `backend` 切换到 `fullstack`），`schema:` 字段会保持旧值。这意味着 OpenSpec 的 schema 校验会使用错误的 schema。

## 修复

新增 `mergeConfigSchema()` 函数，在合并 config.yaml 时更新 `schema:` 行，使其与当前选定的 stack 保持一致。

### 修改文件

**`src/core/init/executeInstallPlan.ts`** — 两处改动：

1. ✅ **新增 `mergeConfigSchema()` 函数**（插入在 `mergeConfigLanguage` 之后、`mergeConfigContent` 之前）：

```typescript
function mergeConfigSchema(existingContent: string, nextContent: string): string {
  const schemaLine = nextContent.match(/^schema:\s*(?:backend|frontend|fullstack)\s*$/m)?.[0];
  if (!schemaLine) return existingContent;

  const lines = existingContent.split('\n');
  const existingSchemaIndex = lines.findIndex((line) => /^schema:\s*/.test(line));

  if (existingSchemaIndex >= 0) {
    lines[existingSchemaIndex] = schemaLine;
  } else {
    const languageIndex = lines.findIndex((line) => /^language:\s*/.test(line));
    lines.splice(languageIndex >= 0 ? languageIndex + 1 : 0, 0, schemaLine);
  }

  return lines.join('\n');
}
```

2. ✅ **更新 `mergeConfigContent()`** 以组合调用 `mergeConfigSchema`：

```typescript
function mergeConfigContent(existingContent: string, nextContent: string): string {
  return appendConfigContext(
    mergeConfigSchema(mergeConfigLanguage(existingContent, nextContent), nextContent),
    nextContent,
  );
}
```

### ✅ 新增测试

在 `test/integration/init-matrix.test.ts` 中，参照 `backfills language during sync`（第 544 行）的模式新增测试用例：

1. ✅ 创建一个 legacy 项目，`openspec/config.yaml` 中为 `schema: backend`
2. ✅ 将 manifest 的 `stack` 改为 `fullstack`
3. ✅ 执行 `runSyncCommand` 触发 `config-merge`
4. ✅ 断言 `config.yaml` 中现在包含 `schema: fullstack`

### 边界情况

| 场景 | 行为 |
|---|---|
| 新模板没有 `schema:` 行 | 返回原内容不变 |
| 现有配置为 `schema: backend`，新模板 → `schema: fullstack` | 替换该行 |
| 现有配置中没有 `schema:` 行 | 插入到 `language:` 之后（如果有），否则插入到文件顶部 |
| `mergeConfigLanguage` 依赖 `schema:` 行做插入定位 | 正常，因为 `mergeConfigLanguage` 先执行，`mergeConfigSchema` 再更新 |

### 验证

1. ✅ 运行已有测试：`pnpm test` — 所有已有测试应通过
2. ✅ 单独运行新增的集成测试
3. ✅ 手动测试：`--stack backend` 初始化项目，再用 `--stack fullstack --force` 重新初始化，验证 `openspec/config.yaml` 中为 `schema: fullstack`
