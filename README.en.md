# World Marble Tour (Marinara extension)

*[한국어 안내는 여기](./README.md)*

A Marinara Engine client extension that lets you play "World Marble Tour" —
a two-player Monopoly-style board game — together with a character in your chat.

## Origin / Permission

The original is a JSX board game made for the riru.ai platform by a member
("yeobung-i") of the **AI Chat Yeoseonghyang Gallery** on dcinside. The
original creator granted permission to port it to Marinara **on the condition
of attribution**. The game design (board, rules, events) belongs to the
original creator.

Original post: https://gall.dcinside.com/mgallery/board/view/?id=aiotomechatting&no=10768

The original (JSX embedded in a character card) cannot run under Marinara's
content sanitization policy, so the rules engine and UI were re-implemented
from scratch as a client extension.

## Install (Marinara Engine 2.3.5 / staging)

> Ported to the 2.3.5 Personal Extensions system. Does not work on stable
> 2.3.4 or earlier. The old auto-deploy script is retired — the new system
> is built around humans approving an exact code hash, so the in-app import
> is the only proper path.

1. **`.env` gate**: add `ENABLE_EXTERNAL_EXTENSIONS=true` to the `.env` in
   your Marinara install folder, then restart.
> **🐳 Using Docker?** — edit `docker-compose.yml` instead of `.env`.
> Find the `environment:` line and add **one line** under it (match the
> indentation of its neighbors):
>
> ```yaml
>       - ENABLE_EXTERNAL_EXTENSIONS=true
> ```
>
> Save, then run `docker compose up -d`.
> If you access Marinara from another device's browser, also add
> `- ADMIN_SECRET=yoursecret` in the same place (needed to open the Danger Zone).
> To confirm it took effect:
>
> ```sh
> docker compose exec marinara env | grep ENABLE_EXTERNAL
> ```
>
> If the value prints, it's applied; if not, run `docker compose up -d` once more.

2. **In-app gate**: **Settings → Advanced → Danger Zone → Allow third-party
   extension imports**. *(On non-localhost setups — phone, remote — you must
   enter the server's `ADMIN_SECRET` to open the Danger Zone.)*
3. **Import**: **Settings → Addons → External Extensions** → import the `marinara-worldmarble-tour.zip` downloaded from the [**Releases page**](../../releases/latest) as-is (no need to unzip).
4. **Approve**: press the power icon → the **full page access** high-risk
   dialog → **"Run this exact code"**. (The extension needs this permission
   to draw its button and game board. The dialog reappears whenever the file
   changes — that is by design.)

## How to play

1. Open any chat (any character works — the extension is generic and does
   not depend on a specific card).
2. Click the **🎲 button** on the right side of the screen (drag to move).
3. Pick the character to play against and press "Start game".
4. Turn order is decided automatically. On your turn, press "🎲 Roll".
   The character's (NPC) turn runs automatically; the extension only asks
   the actual character to respond at genuinely subjective moments —
   buying, building, choosing a world-tour destination.

## Known limitations

- **Per-device state** — game state lives in `localStorage`, so you cannot
  continue a game on another browser or device.
- **No automatic chat refresh** — due to Marinara's internal caching,
  messages the extension sends may not appear immediately. Turn on the
  "auto-refresh every turn" toggle in the widget, or use the "🔄 refresh
  chat" button manually (default: off).
- Exactly 1 (you) vs 1 (character) only.

## License

The extension code is MIT-licensed. The game design (board, rules, events)
belongs to the original creator, credited above, who permitted this port
with attribution.
