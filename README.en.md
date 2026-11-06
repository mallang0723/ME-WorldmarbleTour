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

## Install (tested with Marinara Engine 2.5.2)

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
3. **Import**: choose the GitHub installer extension or manual folder/file
   import method below.
4. **Approve**: press the power icon → the **full page access** high-risk
   dialog → **"Run this exact code"**. (The extension needs this permission
   to draw its button and game board. The dialog reappears whenever the file
   changes — that is by design.)

## Install from GitHub

Tested with **Marinara Engine 2.5.2**. This version has no GitHub import item
under **Settings → Addons → External Extensions**. After enabling external
extension imports above, install a GitHub installer extension such as
[**ME.Fetchy**](https://github.com/FigCake/ME.Fetchy), then enter the following
in **the installer extension's input field**:

```text
mallang0723/ME-WorldmarbleTour/extension
```

This identifies the repository folder containing both `manifest.json` and
`extension.js`. The manifest uses `marinara.personal-extension`, with format
version `1` and extension version `1.0.2`. Its `jsPath` is the relative path
`extension.js`, and the extension name remains `월드마블투어`.

Review the imported code, approve **full page access** (`full_page_access`),
and enable the extension. This is the existing permission used to draw the
game board, call page APIs, and save games in the browser; no additional
permissions are requested.

### Manual folder/file import

To install without a helper extension, download and extract the repository,
then use the folder/file import under **Settings → Addons → External Extensions**.
For folder import, select `extension/`. For file import, select both
`manifest.json` and `extension.js` inside it. Review the code, then approve
and enable it as described in step 4 above.

**Manual ZIP import** also remains available. Import `marinara-worldmarble-tour.zip`
from the [**Releases page**](../../releases/latest), or create a ZIP with
`manifest.json` and `extension.js` together at its root.

See [CHANGELOG.md](./CHANGELOG.md) for release notes.

## How to play

1. Open any chat (any character works — the extension is generic and does
   not depend on a specific card).
2. Tap the **🎲 button** at the bottom-right, above the composer. Drag with
   a mouse or touch to move it; its position is saved per device/browser.
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
