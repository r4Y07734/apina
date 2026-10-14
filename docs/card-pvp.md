# Offensive Card PvP: cards, icons, and multiplayer

Open `/play/card-pvp.html` from the site. Bot matches run entirely in the browser and need no account or backend. Friend matches use the small Cloudflare Worker included in `backend/card-pvp`.

## Choose a character

The lobby offers eight cosmetic characters with illustrated portraits. Choose one before starting a bot match or creating/joining a friend room. Every character has the same health, energy and deck rules. The bot receives a random portrait. Online character choices are stored with the match and shown to both players, including after reconnecting; older rooms use the default portrait. The picker is locked while waiting in a room. Character selection does not change the card catalog or activate reserved slots.

The portraits use faceted low-poly artwork with larger faces and distinct clothing. The original `portraits.png` remains available for rollback. The choices live in `dist/card-pvp/characters.js`; the portrait atlas is `dist/card-pvp/characters/portraits-low-poly.png`. A restore tag, `card-pvp-before-character-selection-2026-10-14`, preserves the version before character selection.

## Edit your 75 card slots

Edit `dist/card-pvp/cards.json`. It contains 75 editable slots. Only the **first 50 entries** are active and can be dealt or played. Slots **51–75 are inactive placeholders** for future cards; editing them does not activate them. You can replace names, descriptions, icons, costs, and abilities. Keep the `id` of each slot stable and keep exactly 75 entries. Each player gets a separately shuffled deck containing the first 50 slots. Change `RULES.activeCards` in `rules.js` if you later want a different active count, then redeploy both frontend and backend.

```json
{
  "id": "card-01",
  "name": "Your card name",
  "description": "Your description, shown on the card.",
  "cost": 3,
  "icon": "icons/venom.svg",
  "accent": "poison",
  "effects": [
    { "type": "damage", "target": "opponent", "amount": 4 },
    { "type": "poison", "target": "opponent", "amount": 2, "rounds": 3 },
    { "type": "heal", "target": "self", "amount": 2 }
  ]
}
```

Each card supports 1–8 effects. Effects run in the order you list them, and victory is checked after the whole card resolves. Descriptions are your display copy; `effects` determine actual behavior.

| Effect | Example | What it does |
| --- | --- | --- |
| Damage | `{"type":"damage","target":"opponent","amount":6}` | Deal damage. Use `self` for a sacrifice or penalty. |
| Heal | `{"type":"heal","target":"self","amount":7}` | Restore health up to the health cap. Can also heal your opponent. |
| Energy | `{"type":"energy","target":"self","amount":2}` | Give energy. A negative amount removes energy. Either target works. |
| Steal | `{"type":"steal","target":"opponent","amount":2}` | Take energy **from the target**, giving it to the other player. Use `self` to give your energy to your opponent. |
| Poison | `{"type":"poison","target":"opponent","amount":2,"rounds":3}` | Deal 2 damage at the beginning of the target's next 3 turns. Separate poison effects stack. |

Costs are integers 0–10. Effect amounts are integers 1–100, except `energy`, which also accepts negative amounts down to −100. Poison duration is 1–10 target turns. Choose an `accent` of `damage`, `heal`, `energy`, `poison`, or `mixed`; this controls the card's visual styling.

Default match rules are in `dist/card-pvp/rules.js`: 40 health, 3 starting energy, 10 energy cap, 3 energy restored each turn, 5 starting cards, and a 5-card hand limit. At the start of later turns, poison resolves first, then energy is restored and one card is drawn. A full hand does not consume a deck card. When a deck runs out, its discard pile is reshuffled. Both players reaching zero health from the same card results in a draw.

After changing the JSON, reload the bot game to check it. The game validates the catalog and displays a useful error for invalid entries. Redeploy both Pages and the Worker for multiplayer changes. Running rooms preserve their original card catalog until they expire, so card changes affect new matches. For significant rule changes, deploy while no matches are running.

## Use icons from a big pack

Card action scenes, targeting, reduced motion and the saved restore point are described in [Card animations and restore point](card-animations.md).

Download a trusted SVG from [Lucide](https://lucide.dev/icons/), [Tabler Icons](https://tabler.io/icons), or [Game-icons.net](https://game-icons.net/). Save it under `dist/card-pvp/icons/` and set a card's `icon` to a local path, such as `"icons/swords.svg"`. You can use different SVGs for every slot without changing JavaScript or installing an icon library. Icons stay on your own Pages site, so no external icon service is needed.

The `heart` accent is accepted as an alias for `heal`, and `attack` for `damage`. Whole-number strings in effect amounts are normalized at runtime without rewriting the JSON. Descriptions remain display copy and do not override effects.

The built-in icon names are `sword`, `heart`, `bolt`, `flask`, `arrows`, `spark`, and `shield`. Missing image files fall back to a built-in icon. Dark SVG fills work well on the light cards; an SVG displayed as an image cannot inherit the page's `currentColor`. Follow each icon pack's license. Lucide and Tabler use permissive licenses; Game-icons.net usually requires attribution, including the icon's artist.

## Run locally

Serve the static site from the repository root:

```sh
python3 -m http.server 8000 --directory dist
```

Open `http://localhost:8000/play/card-pvp.html`. To test friends mode, start the Worker in a second terminal with Node 22.12+ or Node 24:

```sh
cd backend/card-pvp
npm ci
npm run dev
```

In the game's **Play a friend** panel, enter `http://localhost:8787` as the server address. Create a room in one browser tab, then join its six-character room code in a second tab. Each tab has its own session and only receives its own cards. The backend defaults allow the site on `localhost` or `127.0.0.1`, ports 8000 and 8080.

The npm scripts use `run-wrangler.mjs` to keep Wrangler's config, login session, logs, and local runtime data in the ignored `backend/card-pvp/.wrangler/` directory. This works in cloud workspaces with a read-only home directory, without changing `HOME`. Explicit `XDG_CONFIG_HOME`, `WRANGLER_LOG_PATH`, `WRANGLER_SEND_METRICS`, and Cloudflare authentication environment variables are preserved. If you want to reuse an existing Wrangler login in a custom config directory, set `XDG_CONFIG_HOME` to that directory for the login and deploy commands. Otherwise use `npm run login` once for this project's persistent local login. Do not commit `.wrangler/`; it can contain credentials.

Validation commands, from `backend/card-pvp`:

```sh
npm test
npm run check
# With npm run dev running in another terminal:
npm run test:integration
```

The integration check runs two real WebSocket clients through Wrangler's local Worker runtime and verifies hand privacy, turn authorization, reconnects, duplicate-socket replacement, and concession.

## Deploy for free on Cloudflare

The frontend goes on **Cloudflare Pages**; real multiplayer needs server-side state as well. The included Worker uses one **SQLite Durable Object** per room, with hibernatable WebSockets. SQLite Durable Objects are available on Cloudflare's Workers Free plan. You do not need a VPS, a separate database service, or a paid Workers plan for a small game within the free limits.

1. Deploy this repository to Pages. Select **None** as the framework, leave the build command empty, and use **`dist`** as the output directory. Make sure the Git branch is the branch containing this game.
2. Note your exact Pages origin, for example `https://apina.pages.dev`. If you use a custom domain, note its origin too.
3. Edit `backend/card-pvp/wrangler.toml` and replace `ALLOWED_ORIGINS` with those exact origins, separated by commas. Include `https://`, omit trailing slashes, and keep local origins only if you want local testing against production. Pages preview deployments need their exact preview origin added to this list; there are no wildcard origins.
4. From `backend/card-pvp`, run:

   ```sh
   npm ci
   npm run login
   npm run deploy
   ```

   Wrangler opens Cloudflare's login flow. Keep the account on **Workers Free**. Its deployment output gives an HTTPS URL such as `https://apina-card-pvp.your-subdomain.workers.dev`. If the Worker name conflicts in your account, change `name` in `wrangler.toml`. The supplied `new_sqlite_classes` migration creates the free-plan-compatible storage binding.
5. Put that URL in `dist/card-pvp/config.js`:

   ```js
   export const multiplayerServer = 'https://apina-card-pvp.your-subdomain.workers.dev';
   ```

6. Redeploy Pages. Open the game in two browsers and create/join a room. Players no longer need to enter a server address. A custom domain or Pages URL must be on the Worker's origin list before browsers can connect.

If Pages already hosts the site, keep its existing `dist` output settings. The backend is a separate Worker deployment, so Pages itself does not need any Functions or secrets. No Cloudflare account deployment is performed by adding these files; the login and publish steps are yours to run.

Cloudflare's documented Free-plan limits at implementation time include 100,000 Worker requests/day, 100,000 Durable Object requests/day, 13,000 GB-seconds of Durable Object duration/day, 100,000 SQLite rows written/day, and 5 GB of stored SQLite data. Incoming Durable Object WebSocket messages have a 20:1 billing request ratio. Hibernation avoids keeping a room actively running while waiting between moves. Usage above a Free-plan limit fails until its reset rather than automatically upgrading the account. These are quotas, so free hosting is suitable for modest usage, not an unlimited traffic guarantee. Review [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) and [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) before launching widely.

## Multiplayer behavior and retention

The server shuffles the decks, validates turn order, checks that a played card is in that player's hand and affordable, and applies effects from its own catalog. Clients send a card ID or an end/concede/rematch action, with the current match ID. The opponent's hand identities, both deck orders, reconnect tokens, and internal random state are never included in a public game snapshot.

Room codes are invite codes. An unguessable, separate token identifies each player; do not share a reconnect token. The browser keeps its token in that tab's `sessionStorage`, permitting a reload to reconnect. Opening a second connection with the same token replaces the previous connection. There are no accounts or public matchmaking, and bots run locally.

A secure random coin flip chooses the starting player in each online match. Turns last up to **30 seconds**; running out of time automatically ends the turn and starts the opponent’s turn. Normal poison, energy and draw rules apply when that turn starts. A disconnected player has **90 seconds** to reconnect before forfeiting. If both players remain disconnected, the player whose turn it is forfeits. Playing a card does not reset the turn timer. The server uses Durable Object alarms for these deadlines and cleanup, allowing it to hibernate between actions.

Server room data includes player names, reconnect tokens, match state, the last 32 activity-log entries, and the room's card catalog. Waiting rooms expire **30 minutes after creation**. Active rooms expire at most **24 hours after creation or the most recent rematch**. Finished rooms are retained for **10 minutes after the match ends**, or until the earlier 24-hour limit. Expiry closes connections and deletes the room's stored application data. Cloudflare's own platform logging and infrastructure retention are governed by Cloudflare. A Worker redeploy can briefly disconnect WebSockets; reconnect restores persisted room state within the grace period.

## API

| Request | Body | Result |
| --- | --- | --- |
| `POST /rooms` | `{"name":"Aino"}` | `201 {"room":"ABCDEF","token":"…"}` |
| `POST /rooms/ABCDEF/join` | `{"name":"Elias"}` | `201 {"room":"ABCDEF","token":"…"}` |
| `GET /rooms/ABCDEF/socket?token=…` | WebSocket upgrade | Player-specific realtime state |
| `GET /health` | — | `{"ok":true,"service":"apina-card-pvp"}` |

Use `Content-Type: application/json` for POST bodies. Names are 1–24 characters. Browser HTTP requests and WebSocket upgrades must use an allowed origin. JSON bodies and socket actions are capped at 1 KB; socket actions are capped at 15 per 5 seconds per connection.

The socket accepts `{"type":"play","cardId":"card-01"}`, `{"type":"end"}`, or `{"type":"concede"}`. It sends `{"type":"waiting","room":"ABCDEF","connected":[true,false],"deadline":null}` until a guest joins, then `{"type":"state","state":{…},"room":"ABCDEF","connected":[true,true],"deadline":1234567890000,"notice":null}`. `deadline` is the turn's Unix timestamp in milliseconds; a finished game has `null`. Errors use `{"type":"error","error":"Wait for your turn."}`. Automatic turn changes and disconnect forfeits also include a human-readable `notice` in the state packet.

Played cards are public. Each opponent card appears as a large floating card over their side of the arena for about three seconds. Consecutive plays are queued so each reveal gets time on screen. The battle is compact on laptop screens; match activity opens in a dialog instead of adding scrolling to the page. Public play history survives reconnects; unplayed cards and deck order stay private. This rules update expires rooms created under the previous deck rules; start a new match after deploying.

## Rematch with friends

After a friend match ends, either player can request a rematch from the result dialog or the board. The other player sees **Accept rematch**. Both players must accept and be connected; a single request never restarts the game. Rematches keep the same room, reconnect tokens, names, character choices and room card catalog. Health, energy, poison, decks and played-card history reset, and a fresh random coin flip chooses the starter. Finished rooms still expire after 10 minutes if no rematch starts.

State packets include `matchId` (starting at 1) and `rematch` (two boolean votes in player order). Send `{"type":"rematch","matchId":1}` to request or accept. The server increments `matchId` when the rematch starts and rejects actions carrying an older match ID. Saved browser sessions remain available after a match ends so players can reconnect for a rematch; leaving the room clears the session.

## Give an effect a percentage chance

Add an optional `chance` to any individual effect. Use a number from **0 to 100**; decimal percentages work too. Omitting it means **100%**. Each effect rolls independently when the card is played, in both bot and online matches. Online rolls use secure randomness on the server. Poison rolls once when applied; a successful poison then ticks for its normal duration. Failed effects still spend the card and its energy cost. Card details show the percentage, and the activity log records effects that did not trigger.

```json
"effects": [
  { "type": "damage", "target": "opponent", "amount": 6 },
  { "type": "poison", "target": "opponent", "amount": 2, "rounds": 3, "chance": 25 },
  { "type": "heal", "target": "self", "amount": 4, "chance": 50 }
]
```

Here damage always happens, poison has a 25% chance, and healing independently has a 50% chance. Deploy the frontend and backend after editing the catalog; create a new room to use the updated effects.
