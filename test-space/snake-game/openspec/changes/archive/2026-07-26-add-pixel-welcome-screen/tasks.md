# Tasks

## 1. HTML Structure & Font

- [x] 1.1 Add "Press Start 2P" Google Font `<link>` with `preload` and `font-display: swap` in `<head>`
- [x] 1.2 Add `#welcomeScreen` DOM structure in `<body>`: CRT outer frame, inner screen area, scanline overlay, title "SNAKE", mini canvas element, prompt hint "▶ PRESS ENTER"

## 2. CSS Styling

- [x] 2.1 Define Game Boy green palette CSS custom properties and welcome screen base styles (full-screen overlay, z-index above all existing layers)
- [x] 2.2 Apply pixel font to title with `font-smooth: never` / `-webkit-font-smoothing: none`
- [x] 2.3 Implement CRT scanline effect with `repeating-linear-gradient` semi-transparent overlay
- [x] 2.4 Implement CRT bezel (thick dark border) and vignette (radial-gradient edge darkening)
- [x] 2.5 Style the mini canvas container with `image-rendering: pixelated` / `crisp-edges`
- [x] 2.6 Style the prompt hint with blinking animation (opacity keyframes)
- [x] 2.7 Add responsive adjustments for mobile viewport

## 3. Mini Canvas AI Snake

- [x] 3.1 Initialize mini canvas (16×16 logical grid, ~10px cell size, CSS upscaled ~1.5-2×)
- [x] 3.2 Implement snake state: position array, direction, food position, score/length tracking
- [x] 3.3 Implement AI wander algorithm: prefer straight (80%), avoid walls (≤2 cells), occasional random turn (20%), bias toward food when nearby
- [x] 3.4 Implement mini canvas render loop: draw background grid, snake body (pixel squares), food, using `requestAnimationFrame`
- [x] 3.5 Implement snake growth/shrink cycle: eat food → grow (max 8 segments) → after reaching max, reset to 3 segments
- [x] 3.6 Stop mini canvas animation loop when welcome screen is hidden

## 4. Boot Sound

- [x] 4.1 Implement `playBootSound()` using Web Audio API: two OscillatorNode instances (440Hz → 880Hz, 150ms apart, square wave, simple ADSR envelope)
- [x] 4.2 Connect boot sound to the same AudioContext if available, or create a new one
- [x] 4.3 Respect mute state: check existing mute flag before playing
- [x] 4.4 Handle AudioContext `suspended` state gracefully (resume before playing)
- [x] 4.5 Gracefully degrade when Web Audio API is unavailable (no-op, no error)

## 5. Interaction & Transition

- [x] 5.1 Add event listeners: keydown (Enter/Space), click/touch on welcome screen → trigger exit
- [x] 5.2 Implement CRT power-off transition: CSS animation shrinking content to horizontal line via `clip-path`, bright line glow via `::after`, ~400ms duration
- [x] 5.3 On transition complete: hide `#welcomeScreen`, show `#startOverlay` with existing `.active` class
- [x] 5.4 Modify page initialization: on load, show welcome screen instead of start overlay; ensure mute/skin state still loads correctly

## 6. Integration & Cleanup

- [x] 6.1 Verify existing game flow: Welcome → Start Overlay → Game → Game Over → Back to Start Overlay (NOT back to Welcome)
- [x] 6.2 Verify "restart" button returns to Start Overlay only, not to Welcome screen
- [x] 6.3 Verify skin system and mute button are loaded correctly before entering game
- [x] 6.4 Manual E2E smoke test: full flow on desktop and mobile viewport
