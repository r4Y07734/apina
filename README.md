# apina

A static browser-game collection. Serve the site from this checkout:

```sh
python3 -m http.server 8000 --directory dist
```

Cloudflare Pages uses `dist` as its output directory with no build command.

## Bridgeworks

Open `dist/play/bridge-builder.html` through the local server. The bridge builder includes 20 levels and runs entirely on Cloudflare Pages, with no backend or build step.

- [Controls, materials and structural simulation](docs/bridgeworks.md).
- Level definitions: `dist/bridge-builder/levels.js`.
- Optional progress and bridge designs stay in the browser on the player's device.

Run its physics regression checks:

```sh
node --test tests/bridge-physics.test.mjs
```

## Offensive Card PvP

Open `dist/play/card-pvp.html` through the local server. Practice against the bot or deploy the included Cloudflare Worker to play with a friend.

- [Edit the 75 card slots (50 active)](dist/card-pvp/cards.json): names, descriptions, energy costs, SVG icons, and combined effects.
- [Card editing, icon packs, and free multiplayer deployment](docs/card-pvp.md).
- [Multiplayer server](backend/card-pvp).

Run the shared gameplay checks from the repository root:

```sh
node --test tests/card-pvp-rules.test.mjs
```

Backend tests and deployment checks are documented in the guide. Live multiplayer requires deploying the Worker and setting its URL in `dist/card-pvp/config.js`; the bot works without it.
