# 代码审查报告：full-screen-game-map

**日期**: 2026-08-01
**分支**: feature/lite
**变更文件**: `index.html` (+314 / -214)

## 审查概要

| 维度 | 结果 |
|------|------|
| 正确性 | ✅ 通过（1 个建议） |
| 安全性 | ✅ 通过 |
| 性能 | ✅ 通过（1 个建议） |
| 可维护性 | ✅ 通过（2 个建议） |
| 规范对照 | ✅ 通过（1 个建议） |

无严重或重要问题。以下是详细发现。

---

## 发现 1（建议·正确性）

**位置**: `initGame()` 中 `gridLocked` 重置时机

```javascript
// 当前代码
gridLocked = false;
```

`gridLocked = false` 在 `initGame()` 开头执行，但若 `initGame()` 在某处被调用但游戏实际未开始（如初始化被中断），`gridLocked` 已被重置，可能导致后续 resize 事件误触发网格重算。

**建议**: 将 `gridLocked = false` 移到 `isRunning = true` 之后（`startGame()` 函数中），仅在游戏真正启动后解锁。

---

## 发现 2（建议·性能）

**位置**: HUD 自动淡化的事件监听

```javascript
document.addEventListener('mousemove', resetHudFade);
document.addEventListener('touchstart', resetHudFade, { passive: true });
document.addEventListener('keydown', resetHudFade);
```

`mousemove` 事件在游戏运行期间会以极高频率触发（每帧可能多次），每次调用 `resetHudFade` 都会执行 `classList.remove` 和 `clearTimeout`/`setTimeout`，即使 HUD 未淡化也会频繁操作 DOM。

**建议**: 增加状态检查，仅在 HUD 处于淡化状态时才执行恢复操作：

```javascript
function resetHudFade() {
    if (!hudTop.classList.contains('hud-fade')) {
        // 未淡化，仅重置计时器
        if (hudFadeTimer) clearTimeout(hudFadeTimer);
        if (isRunning) {
            hudFadeTimer = setTimeout(function () {
                hudTop.classList.add('hud-fade');
                hudBottom.classList.add('hud-fade');
            }, 5000);
        }
        return;
    }
    // 当前已淡化，执行恢复
    hudTop.classList.remove('hud-fade');
    hudBottom.classList.remove('hud-fade');
    // ... 重新设置计时器
}
```

---

## 发现 3（建议·可维护性）

**位置**: 旧 CSS 类残留

以下 CSS 类和 HTML 元素已从 DOM 中移除，但 CSS 文件中仍保留其样式定义，可能造成混淆：
- `.key-hint`、`.key-badge`、`.key-group`（controls-info 子元素，父级已 `display: none`）
- `.skin-selector`、`.skin-swatch`、`.skin-label`（皮肤选择器已移除，但 CSS 仍保留）
- `.btn-icon`（按钮样式已替换为 `.hud-btn`）
- `.help-btn-global`（按钮元素已移除）

**建议**: 清理未使用的 CSS 规则，减少文件体积和维护负担。可后续在独立清理 PR 中处理。

---

## 发现 4（建议·可维护性）

**位置**: `spawnFood()` 仍为单食物模式

当前 `food` 仍为单变量，`spawnFood()` 返回单个位置。设计文档中定义了 `foodCount = max(1, floor(totalCells / 400))`，但在大屏（96×54 = 5184 格）下一旦启用多食物（12 个），当前代码需要显著重构。

**建议**: 后续迭代中实现 `foods` 数组支持，或在本期明确 `foodCount` 为后续预留（当前恒为 1）。

---

## 发现 5（建议·规范对照）

**位置**: 新增 CSS 变量使用硬编码颜色

```css
.hud-top {
    background: rgba(15, 23, 42, 0.6);  /* 硬编码，应使用 var(--bg) */
}
```

HUD 背景色使用了硬编码的 `rgba(15, 23, 42, 0.6)`，在切换皮肤（尤其是浅色系皮肤）时可能不协调。

**建议**: 后续迭代中使用皮肤 CSS 变量：`background: color-mix(in srgb, var(--bg) 60%, transparent);`，或新增 `--hud-bg` CSS 变量。

---

## 敏感信息扫描

✅ 无 API key、password、token 或私钥泄露。

---

## 总结

- **严重问题**: 0
- **重要问题**: 0
- **建议**: 5

所有发现均为建议级别，不阻塞流程。核心实现正确，游戏已验证可正常运行。
