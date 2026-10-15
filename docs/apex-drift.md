# Apex Drift

The supplied single-file racing game lives at `dist/play/apex-drift.html`. It runs entirely in the browser, with no external assets, libraries or backend. It retains three tracks, seven AI rivals, configurable laps/difficulty/car colors, tyre-grip physics, handbrake drifting, engine audio and race results.

The apina integration adds homepage catalog/search/favorites, navigation, pause/mute/fullscreen buttons, touch driving controls and responsive overlays. The catalog cover in `dist/assets/apex-drift.png` is a frame captured from the game itself. Existing featured games are unchanged.

Lap records stay in memory by default. Enabling “Remember lap records on this device” uses the shared `apina-score-preference` setting and stores per-track records in `apina-apex-records`. Turning off score storage from any standard game page or clearing scores on the GDPR page also deletes these records. No lap records leave the browser.

Run `node tests/apex-drift-browser.mjs` from the repository root for browser checks. It starts its own local server and checks race setup, driving/drifting, recovery, pause/mute, touch input, favorites, optional records, deletion and homepage launch. Chromium and Playwright must be installed; `CHROMIUM_PATH` can select a different Chromium binary. Set `APEX_CAPTURE_ART=1` to regenerate the catalog cover during that check.
