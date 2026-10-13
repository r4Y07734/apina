# Bridgeworks

Bridgeworks is a single-player bridge construction game with 20 crossings in river valleys, canyons, harbours and alpine terrain. It runs directly from the static `dist` directory on Cloudflare Pages. There is no server, package installation or build command for this game.

## Build and test

Choose a material, click a yellow fixed anchor or an existing joint, then click a grid point to connect it. Continue from the new joint or press Escape to cancel the current connection. Drag a free joint to move it. The erase tool removes members; Undo also restores a cleared bridge.

Build a continuous road between the banks, then brace the joints with triangles. Timber is economical; steel carries larger forces; cables carry tension and go slack under compression. Material prices and maximum lengths are shown in tooltips. Later levels provide piers, cable anchors, heavier convoys and shipping clearances. Every level is selectable from the Levels menu.

Test sends the vehicles across the bridge. Pause or change simulation speed, and enable Stress to see which members need support. A vehicle must reach the other bank for the crossing to count. Return to building after a failure to refine the original bridge. Ratings reward economical bridges; all vehicles must cross to complete a level.

Keyboard: 1 road, 2 timber, 3 steel, 4 cable, E erase; Ctrl/Cmd+Z undo and Shift+Ctrl/Cmd+Z redo; Escape cancels a connection. With the construction canvas focused, arrow keys move the grid cursor and Enter places a connection. Space starts a test or pauses/resumes it. Mouse and touch use the same construction tools.

“Remember progress on this device” is optional and off by default. It stores designs, completed levels and the last selected level in `apina-bridge-progress`. Disabling it deletes that entry. Storage is local to the browser; bridges are not uploaded.

## Structural model

The simulation models pinned joints and axial members with material stiffness, gravity, bridge self-weight and moving vehicle axle loads. Tension and compression limits break overloaded members; longer compression members have lower buckling resistance. Cables act only in tension. Road deformation affects vehicle position, and vehicles fall if their supporting road breaks. Simulation runs at a fixed physics step for consistent outcomes across display refresh rates.

This is a structural game model rather than an engineering design tool: it does not reproduce full beam bending, foundations, wind, fatigue or real construction certification. Graphics exaggerate stress and failure feedback so structural problems are visible while playing.

Level definitions are in `dist/bridge-builder/levels.js`, material properties and simulation in `physics.js`, scenery in `renderer.js`, and editor behavior in `app.js`. Run `node --test tests/bridge-physics.test.mjs` to check complete crossings, reference designs, structural failures and simulation invariants after changing these files. Reference bridges are used by automated tests and are not loaded by the player interface.
