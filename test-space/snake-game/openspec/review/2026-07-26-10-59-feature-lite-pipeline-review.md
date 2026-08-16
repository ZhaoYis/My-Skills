# Code Review: add-bomb-system

**Date:** 2026-07-26 10:59
**Branch:** feature/lite
**Reviewer:** Automated Pipeline Review
**File:** `index.html` (+439/-3 lines)

## Summary

| Severity | Count |
|----------|-------|
| Critical | 1 |
| Medium | 0 |
| Low | 2 |
| Info | 1 |

## Findings

### 1. [Critical] Chain Reaction Duplicate Explosion

**File:** `index.html` — `triggerExplosion()` function
**Lines:** Chain reaction section

**Issue:** The `otherBombs` array is filtered from `bombs` before the recursive loop. However, recursive `triggerExplosion` calls can remove bombs that are also in `otherBombs`. When the loop subsequently reaches an already-removed bomb, `triggerExplosion` processes it again (bombIdx === -1, but the function continues), causing:
- Duplicate head-in-blast checks (potential double-death)
- Duplicate body severing
- Duplicate food destruction
- Incorrect chain level (the bomb gets both its proper chain level from the first recursive call AND a wrong chain level from the second)

**Scenario:**
```
bomb1 explodes → otherBombs = [bomb2, bomb3]
  ├─ triggerExplosion(bomb2, chainLevel=2)
  │   └─ bomb3 in bomb2's blast → triggerExplosion(bomb3, chainLevel=3)
  │       └─ bomb3 properly exploded and removed
  └─ triggerExplosion(bomb3, chainLevel=2)  ← BUG: bomb3 already exploded!
      └─ bomb3 NOT in bombs[] → bombIdx=-1 → explosion effects re-applied
```

**Fix:**
```javascript
for (const other of otherBombs) {
    if (!bombs.includes(other)) continue; // guard against duplicate explosions
    triggerExplosion(other, chainLevel + 1);
}
```

---

### 2. [Low] Fragile String Replace for Color Alpha

**File:** `index.html` — `drawExplosions()` function

**Issue:** The alpha blending uses `.replace('0.7', String(blastAlpha))` which assumes the skin color string contains "0.7". If a skin definition changes its alpha value, the replace silently fails (no runtime error, but incorrect rendering).

All 4 current skins use 0.7 for `explosionBlast`, 0.6 for `explosionGround`, and 0.9 for `explosionParticle`, so this works now. Future skin additions could break this.

**Recommendation:** Consider storing colors as `{ r, g, b }` objects with a separate alpha parameter, or use a helper function to rebuild the rgba string.

---

### 3. [Low] Non-Deterministic Particle Rendering

**File:** `index.html` — `drawExplosions()` particle section

**Issue:** Particle sizes use `Math.random() * 3` each frame, causing particles to flicker randomly rather than animate smoothly. Using the deterministic `seed` variable (derived from explosion position) would produce consistent, smooth animation.

**Current:**
```javascript
const pSize = (2 + Math.random() * 3) * (1 - progress);
```

**Suggested:**
```javascript
const pSize = (2 + ((seed + p) % 3)) * (1 - progress);
```

---

### 4. [Info] Consistent Code Patterns

**Positive observation:** The implementation follows existing codebase conventions:
- Uses `Object.freeze()` for constants (matching `ITEM_TYPES`, `SKINS`)
- Follows the same accumulator-based game loop pattern
- Reuses existing `canvasWrapper.classList` flash animation
- Consistent naming: `snakeOccupies` → `cellIsOccupiedByBomb` → `bombAt`
- Guards for boundary conditions (board edges, max bombs, snake length)
- No hardcoded credentials or security issues
- All colors come from skin system (respects Skin Color Independence spec)

## Verification

- **JavaScript syntax:** ✅ No errors in browser console (tested via Playwright)
- **Game lifecycle:** ✅ Start → Play → Game Over works correctly
- **Bomb rendering:** Not visually confirmed (automated test limitations) but no rendering errors
- **Skin parameters:** All 4 skins have complete bomb color sets (13 params each)
- **Classic mode items:** ✅ `rollItemType()` no longer mode-guarded
- **Shield-bomb interaction:** ✅ Shield consumed on explosion death, not on dormant touch

## Recommendation

Fix the critical chain reaction issue before proceeding. The low-severity items are acceptable for initial release and can be addressed in follow-up changes.
