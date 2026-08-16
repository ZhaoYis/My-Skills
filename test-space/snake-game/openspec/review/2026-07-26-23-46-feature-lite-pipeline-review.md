# 代码审查报告 — `add-settings`

**审查时间**: 2026-07-26 23:46
**变更范围**: `index.html` (+839 / -106 行)
**审查维度**: 正确性 / 安全 / 性能 / 可维护性 / 规范对照

---

## 发现汇总

| 严重度 | 数量 | 状态 |
|--------|------|------|
| 严重 | 0 | - |
| 重要 | 0 | - |
| 一般 | 1 | 需修复 |
| 建议 | 2 | 可选修复 |

---

## 一般问题

### 1. `SettingsStore._migrate()` 中 `SKINS` 引用存在 TDZ 风险

**文件**: `index.html` — `SettingsStore` IIFE 内部 `_migrate()` 函数
**严重度**: 一般

`SettingsStore` 模块的 IIFE 在初始化时同步调用 `_migrate()`，其中引用了 `SKINS[oldSkin]`。但 `SKINS` 常量定义在 `SettingsStore` 之后。在首次迁移场景（localStorage 中存在旧 `snake-skin` key 且值非 `classic`），`_migrate()` 执行时 `SKINS` 尚在暂时性死区（TDZ），会抛出 `ReferenceError` 导致整个脚本崩溃。

**当前测试未触发原因**：测试环境中 `snake-skin` 已被清空，`oldSkin` 为 `null`，短路评估跳过了 `SKINS[oldSkin]` 访问。

**修复建议**：将 `SKINS` 常量定义移至 `SettingsStore` 之前，或将 `_migrate()` 调用延迟到 DOMContentLoaded 之后执行。

---

## 建议

### 2. Toggle 开关缺少键盘支持 — ✅ 已修复

已添加 `addToggleKeyboard()` 辅助函数，为所有 toggle 按钮绑定 Enter/Space 键盘事件。

### 3. 皮肤选择按钮缺少 `aria-selected` 状态 — ✅ 已修复

`refreshSkinOptionsUI()` 中已为激活/非激活按钮设置 `aria-selected="true"/"false"`。

---

## 安全扫描

- 无硬编码凭据/密钥 ✅
- 无 innerHTML XSS 风险（皮肤选项使用 `document.createElement` + `textContent`）✅
- localStorage 操作使用 try/catch 包裹 ✅
- `exportGameData()` 使用 Blob + URL.createObjectURL，文件下载后正确清理 ✅

## 性能

- 设置面板 DOM 一次性构建，无重复查询 ✅
- 皮肤选项通过循环动态生成（`buildSkinOptions()`），避免硬编码重复 ✅
- canvas 重绘仅在实际需要时触发（`!isRunning` 条件下调用 `draw()`）✅

## 可维护性

- 新增代码遵循现有模块模式（IIFE 闭包）✅
- `DIFFICULTY_PRESETS` 使用 `Object.freeze` 防止意外修改 ✅
- 设置面板 JS 封装为独立 IIFE，通过 `window._settingsPanel` 暴露最小接口 ✅
- 变量命名与现有代码风格一致（snake_case 模块名、camelCase 函数名）✅
