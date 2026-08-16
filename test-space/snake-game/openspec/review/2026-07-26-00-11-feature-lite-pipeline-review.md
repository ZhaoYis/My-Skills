# Code Review: add-timed-mode

**Date**: 2026-07-26
**Round**: 1 / 3
**Reviewer**: Claude Code (automated)
**Scope**: `index.html` (+705 / -140 lines)

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| Major | 0 |
| Minor | 3 |
| Suggestion | 2 |

---

## Findings

### 1. [Minor] Unused constant `TIME_PER_FOOD`

**File**: `index.html` (Constants section)
**Category**: simplification

The constant `TIME_PER_FOOD = 5` is declared but never referenced. All time effects are derived from `ITEM_EFFECTS[itemType].time`. This dead code should be removed or used.

**Recommendation**: Remove the constant or use it as the default value in `ITEM_EFFECTS`.

---

### 2. [Minor] Multiple `performance.now()` calls in `draw()`

**File**: `index.html` (Food rendering in `draw()`)
**Category**: correctness

The `draw()` function calls `performance.now()` multiple times within a single frame for sparkle angles, arc flicker timing, ring pulse, and boost glow. Each call returns a slightly different value, which can cause visual inconsistencies (e.g., golden apple sparkles might not be perfectly aligned with the body, lightning arcs might use different rotation from glow).

The same issue exists in the pre-existing pause indicator code (line 1050: `performance.now() / 200`), but is now amplified by the special item rendering.

**Failure scenario**: Rapid frame rendering causes slight positional jitter in golden apple sparkle particles relative to the apple body.

**Recommendation**: Snapshot `const now = performance.now()` once at the top of `draw()` and use `now` throughout.

---

### 3. [Minor] `screenFlash` animation missing box-shadow layer

**File**: `index.html` (CSS `@keyframes screenFlash`)
**Category**: correctness

The `.canvas-wrapper` has a 3-layer box-shadow:
```css
box-shadow:
    0 0 0 1px rgba(51, 65, 85, 0.5),    /* border ring */
    0 20px 60px rgba(0, 0, 0, 0.5),       /* drop shadow */
    0 0 80px rgba(34, 211, 238, 0.05);    /* accent glow */
```

But the `screenFlash` keyframes only declare the first two layers (border + shadow), omitting the accent glow layer. During the 0.3s flash animation, the accent glow disappears then abruptly returns when the animation ends.

**Failure scenario**: Shield triggers → purple flash for 0.3s → accent glow vanishes during flash → suddenly reappears. Visually jarring.

**Recommendation**: Add the third layer to the keyframes, or use a simpler approach like a temporary overlay element.

---

### 4. [Suggestion] `draw()` function growing large

**File**: `index.html` (draw function ~300 lines)
**Category**: maintainability

The four food rendering branches add ~120 lines to `draw()`. As the function grows, it becomes harder to reason about. Each item type's rendering logic (golden apple, lightning, shield) could be extracted into separate functions.

**Recommendation**: Extract `drawGoldenApple()`, `drawLightning()`, `drawShield()` functions, each accepting `(fx, fy, r, ctx)`.

---

### 5. [Suggestion] Redundant `foodItem` initialization in `initGame()`

**File**: `index.html` (initGame)
**Category**: simplification

`initGame()` calls `spawnFood()` (which sets `foodItem = rollItemType()`), then immediately calls `foodItem = rollItemType()` again on the next line. The second call overwrites the value set by spawnFood.

In classic mode, both calls return `null` (no effect). In timed mode, the second call could produce a different item type than what was set during spawnFood, but the visual rendering uses `foodItem` so the displayed item matches the second roll. The effect when eaten uses `foodItem` too, so the mismatch is purely that the visual and the consumed effect don't correspond to the same roll.

**Recommendation**: Remove the standalone `foodItem = rollItemType()` line from `initGame()`. The `spawnFood()` call already handles it.

---

## Security Scan

✅ No credentials, API keys, tokens, or sensitive data detected.
✅ No `innerHTML` usage — all DOM updates use `textContent` or `classList`.
✅ All `localStorage` operations are wrapped in try/catch.
✅ No `eval()` or dynamic code execution.

## Performance Review

✅ No N+1 queries or unbounded loops.
✅ Particle cleanup is O(n) with efficient splice.
✅ Canvas operations use standard patterns (radial gradients, arcs).

## Compliance with Project Baseline (CLAUDE.md)

✅ Single-file structure maintained.
✅ IIFE pattern preserved.
✅ CSS variable system extended (not replaced).
✅ Skin registry pattern respected — no hardcoded colors in draw() beyond item-specific rendering.
✅ Mobile responsive breakpoints extended.

---

## Verdict

**No blocking issues.** The 3 minor findings are cosmetic/simplification and do not affect gameplay correctness. The 2 suggestions are maintainability improvements.

**Recommendation**: Continue to Phase 4. Minor fixes can be applied now or deferred.
