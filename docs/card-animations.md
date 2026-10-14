# Card animations and restore point

Before animations were added, the complete working version was saved on GitHub:

- Branch: [`backup/card-pvp-before-animations-2026-10-14`](https://github.com/r4Y07734/apina/tree/backup/card-pvp-before-animations-2026-10-14).
- Tag: `card-pvp-before-animations-2026-10-14`.
- Commit: `4ac33600528902e9b3d8a7cfaa1b26c5c71015e5`.

This snapshot includes the 50 card icons, the five-card hand limit, 30-second online turns, turn warnings, grey inactive hands, and the rest of the site. It was pushed before the animation work started.

## Restore the card game

Use the saved tag to restore the card game's files in a new commit. This keeps Git history and unrelated games intact:

```sh
git fetch origin
git restore --source=card-pvp-before-animations-2026-10-14 --staged --worktree -- dist/card-pvp dist/play/card-pvp.html
git commit -m "Restore card game before animations"
git push origin HEAD:main
```

Run this from a clean checkout containing the published animation changes. Cloudflare's frontend deployment will publish the restored version. The animation update does not change the multiplayer Worker, game rules, or card JSON, so restoring this update needs no backend deployment. To restore the entire website to the snapshot as well, restore `.` instead of just the two card-game paths, then commit and publish it in the same way.

## Animation behavior

Each of the 50 stable card IDs has a scene in `dist/card-pvp/animation-profiles.js`. The canvas artwork lives in `animation-renderer.js`; `animations.js` handles playback. Custom card IDs receive an effect-based fallback.

Targets are resolved from the card's effects. Missiles follow damage targets, water and healing props follow their affected player, and energy theft travels from the source to the recipient. Separate visual cues show additional damage, healing, energy and poison effects on mixed cards. Changes to names or descriptions do not affect targeting.

Scenes stay inside the arena and allow normal game input. Online turn timers keep running. Quick successive plays queue their animations at a faster playback rate. Opening or resuming a room loads existing history without replaying it; new plays received after reconnect are animated. Leaving the match cancels pending scenes. The result dialog waits for the final scene.

The browser's reduced-motion preference replaces moving scenes with brief static action cues. No audio, additional downloads, or backend service are needed.

Run the profile and targeting checks alongside the gameplay tests:

```sh
node --test tests/card-animation-profiles.test.mjs tests/card-animation-targets.test.mjs tests/card-pvp-rules.test.mjs backend/card-pvp/test/worker.test.mjs
```
