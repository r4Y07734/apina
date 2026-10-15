# Recoil Riot

A laptop-first, top-down pixel arena shooter for 2–8 people. Open `/play/recoil-riot.html`. Practice runs entirely in the browser; online rooms run authoritative combat in a Cloudflare Durable Object. Rooms fill to four combatants with bots; joining friends replace bots. Eight humans can join a room. First to 15 knockouts or the highest score after three minutes wins. Ties use the current scoreboard order. New rounds start automatically after eight seconds.

## Make changes here

| File | Responsibility |
| --- | --- |
| `dist/recoil-riot/weapons.js` | Names, descriptions, damage, recoil, projectile behavior, magazines, reloads, colors. Shared by browser and server. |
| `dist/recoil-riot/maps.js` | Cover, spawn points, health pickups, arena dimensions, player colors. |
| `dist/recoil-riot/simulation.js` | Rules, physics, bots, collision, damage, rounds, input sanitization. Shared by browser and server. |
| `dist/recoil-riot/renderer.js` | Hand-drawn pixel sprites, map tiles, weapon art, particles, camera kick. |
| `dist/recoil-riot/app.js` | Controls, lobby, room invites, audio, UI and networking. |
| `dist/recoil-riot/style.css` | Layout, colors, typography and responsive styling. |
| `dist/play/recoil-riot.html` | Page content and UI structure. |
| `dist/recoil-riot/config.js` | Public multiplayer endpoint. |
| `backend/recoil-riot/worker.js` | Room WebSockets, server ticks, client limits, bot filling. |

The six weapons are a recoil shotgun, banana squirt gun, explosive ketchup, bouncing rubber ducks, confetti, and a boxing glove launcher. Each weapon has a separate magazine so switching cannot refill ammo. Add weapon behavior in `simulation.js` and art in `renderer.js`; update the sidebar copy/icons in `app.js` when adding a new type. No bundler is required for the frontend. Keep weapon and simulation files shared so clients and server agree.

## Local development

From the repository root:

```sh
python3 -m http.server 8000 --directory dist
node --test tests/recoil-riot.test.mjs
cd backend/recoil-riot
npm ci
npm run dev
```

Use `http://localhost:8000/play/recoil-riot.html?server=http://localhost:8788` for local multiplayer. Create a room in one window and join its invite from a second window. The custom server query parameter works only on localhost. Public visitors cannot redirect the client to a different server with an invite URL.

## Cloudflare deployment

The live site uses the existing `apinaapp` **Worker with static assets**, despite the older README mentioning Pages. The repository's root `wrangler.toml` records that setup. Deploy the multiplayer Worker first, then deploy the static site from the repository root:

```sh
cd backend/recoil-riot
npm ci
npm run check
npm run deploy
cd ../..
backend/recoil-riot/node_modules/.bin/wrangler deploy
```

Use an environment-provided `CLOUDFLARE_API_TOKEN` and account authorization; never commit credentials. Set the returned multiplayer URL in `dist/recoil-riot/config.js` if the Cloudflare account changes. Update `ALLOWED_ORIGINS` in the multiplayer Wrangler config for new domains. Deploy the multiplayer Worker again after changing shared weapons, maps, or simulation rules.

## Runtime behavior and limits

- Server runs at 30 ticks/second and sends state at 15 snapshots/second. Clients send input only; the server owns motion, shots, cooldowns, ammo, health, knockouts, and results.
- Active connected rooms use a Durable Object interval and are billable according to the account's Cloudflare plan. Closing the final connection stops the timer and clears the room. No database, accounts, analytics, or persistent match history.
- Rooms and scores are ephemeral. Worker restarts/deployments reset matches; disconnected players can join again as a new player with the same room code. There is no reconnection identity or ranked progression.
- A room code is an invitation, not an authentication boundary. Anyone with the code can join. The server checks browser origins and limits input size/rate; it does not claim comprehensive anti-cheat or abuse protection.
- Clicking away pauses local practice and stops online movement; online matches continue. Input silence stops movement after 300 ms, with idle sockets closed after two minutes.
- Fonts load from Google Fonts with local fallbacks. All game art is original code-drawn pixel art. Sound starts muted and is synthesized locally after a user gesture.

Browser regression script: `tests/recoil-riot-browser.cjs` (requires Playwright and its Chromium installation). Use `RIOT_BASE_URL` to target local or deployed frontend. The multiplayer smoke script lives in `backend/recoil-riot/test-online.mjs`.
