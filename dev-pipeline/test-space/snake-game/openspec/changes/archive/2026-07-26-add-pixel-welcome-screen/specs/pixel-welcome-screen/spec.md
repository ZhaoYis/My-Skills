## ADDED Requirements

### Requirement: Pixel Welcome Screen Display

The system SHALL display a full-screen pixel-art welcome screen when the page loads, before the existing start overlay. The welcome screen MUST occupy the entire viewport and hide all other game UI elements.

#### Scenario: Page loads and welcome screen appears
- GIVEN the user navigates to the game page
- WHEN the page finishes loading
- THEN the welcome screen is displayed in full-screen mode
- AND all other UI elements (start overlay, canvas, controls) are hidden
- AND the welcome screen uses the Game Boy green color palette (#0f380f, #306230, #8bac0f, #9bbc0f)

#### Scenario: Welcome screen appears every page load
- GIVEN the user has previously visited the game page and played games
- WHEN the user reloads the page or navigates back
- THEN the welcome screen SHALL be displayed again
- AND SHALL NOT auto-skip based on prior visits or localStorage state

### Requirement: Pixel SNAKE Title

The system SHALL display the word "SNAKE" as a large title on the welcome screen using the "Press Start 2P" Google Font. The title MUST be rendered with pixel-perfect anti-aliasing disabled for authentic pixel aesthetics.

#### Scenario: Title renders with pixel font
- GIVEN the welcome screen is displayed
- WHEN the font "Press Start 2P" has loaded
- THEN the title "SNAKE" is rendered in the pixel font
- AND `font-smooth: never` and `-webkit-font-smoothing: none` are applied

#### Scenario: Font loading fallback
- GIVEN the welcome screen is displayed
- WHEN the "Press Start 2P" font has not yet loaded or fails to load
- THEN a system monospace fallback font is used
- AND the title remains readable

### Requirement: CRT Display Effect

The system SHALL render a CRT (Cathode Ray Tube) display effect on the welcome screen consisting of: horizontal scanlines, a dark bezel/frame border, and edge vignette darkening.

#### Scenario: CRT effects render
- GIVEN the welcome screen is displayed
- WHEN the browser renders the screen
- THEN horizontal scanlines are visible as a repeating semi-transparent pattern across the entire screen
- AND a thick dark border (bezel) surrounds the screen area
- AND the edges of the screen area are darker than the center (vignette effect)

### Requirement: Mini Pixel Canvas with AI Snake

The system SHALL render a small pixel-art canvas grid on the welcome screen where an AI-controlled snake moves autonomously. The canvas MUST use `image-rendering: pixelated` for crisp pixel rendering.

#### Scenario: Mini canvas renders
- GIVEN the welcome screen is displayed
- WHEN the page renders
- THEN a mini pixel canvas (at least 16×16 logical cells) is visible
- AND the canvas uses `image-rendering: pixelated` CSS property
- AND the canvas is rendered at a scale factor that makes individual pixels clearly visible

#### Scenario: AI snake moves autonomously
- GIVEN the welcome screen is displayed and the mini canvas is rendering
- WHEN the animation loop runs
- THEN a snake sprite moves autonomously on the grid
- AND the snake avoids self-collision and wall collision by changing direction
- AND the snake periodically eats food items that spawn randomly on the grid
- AND the snake's movement is smooth and visually distinguishable from a static image

#### Scenario: AI snake respects grid boundaries
- GIVEN the AI snake is approaching a wall boundary
- WHEN the snake's next move would place its head outside the grid
- THEN the snake changes direction to avoid the wall
- AND the snake continues moving without interruption

### Requirement: Boot Sound Effect

The system SHALL play a Game Boy-style boot chime sound effect when the welcome screen first appears. The sound MUST be synthesized using the Web Audio API.

#### Scenario: Boot sound plays on welcome screen
- GIVEN the welcome screen is displayed
- WHEN the welcome screen enters its first animation frame
- THEN a short ascending two-tone chime is synthesized and played via Web Audio API
- AND the sound duration is less than 500ms

#### Scenario: Boot sound respects mute setting
- GIVEN the mute button has been activated (sound muted)
- WHEN the welcome screen is displayed
- THEN the boot sound SHALL NOT play

#### Scenario: Boot sound on unsupported browser
- GIVEN the browser does not support Web Audio API (AudioContext unavailable)
- WHEN the welcome screen is displayed
- THEN no error is thrown
- AND the welcome screen functions normally without sound

### Requirement: Welcome Screen Interaction

The system SHALL transition from the welcome screen to the existing start overlay when the user presses Enter, Space, or clicks/taps anywhere on the screen.

#### Scenario: User presses Enter to proceed
- GIVEN the welcome screen is displayed
- WHEN the user presses the Enter key
- THEN the welcome screen begins its exit transition animation
- AND after the transition completes, the start overlay is displayed

#### Scenario: User presses Space to proceed
- GIVEN the welcome screen is displayed
- WHEN the user presses the Space key
- THEN the welcome screen begins its exit transition animation

#### Scenario: User clicks to proceed
- GIVEN the welcome screen is displayed
- WHEN the user clicks or taps anywhere on the welcome screen
- THEN the welcome screen begins its exit transition animation

### Requirement: CRT Power-Off Transition

The system SHALL animate the exit from the welcome screen using a CRT-style shutdown effect: the screen content shrinks vertically to a horizontal bright line, then fades out.

#### Scenario: CRT shutdown animation plays
- GIVEN the user triggers the welcome screen exit
- WHEN the transition animation starts
- THEN the screen content compresses vertically toward the center
- AND a bright horizontal line appears at the center of compression
- AND the line fades out over approximately 400ms
- AND after the animation completes, the start overlay fades in

#### Scenario: Start overlay appears after transition
- GIVEN the CRT shutdown animation has completed
- WHEN the animation finishes
- THEN the welcome screen DOM element is hidden (`display: none` or removed)
- AND the existing start overlay appears with its current functionality intact
