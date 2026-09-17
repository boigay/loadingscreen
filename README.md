<h1 align='center'>[ESX] Loading Screen</a></h1><p align='center'><b><a href='https://discord.esx-framework.org/'>Discord</a> - <a href='https://esx-framework.org/'>Website</a> - <a href='https://docs.esx-framework.org/legacy/installation'>Documentation</a></b></h5>

A loading screen that plays a YouTube playlist behind a field of falling dots,
with a real progress bar driven by the game's own load events.

## Setup

Everything lives in [`web/config.js`](web/config.js). Edit it, then `restart
loadingscreen` (or just reconnect).

### Playing your own videos

Drop links into `videos`. A full link, a share link or the bare ID all work:

```js
videos: [
    { url: 'https://www.youtube.com/watch?v=XXXXXXXXXXX' },
    { url: 'https://youtu.be/YYYYYYYYYYY?t=45' },          // starts 45s in
    { url: 'ZZZZZZZZZZZ', start: 12, title: 'Fallback name' }
],
```

They play in order (or shuffled, with `shuffle: true`) and the list loops. The
title in the now-playing card comes from YouTube itself — `title` is only shown
in the moment before that arrives.

Leave `videos` empty and the screen falls back to its animated background, with
a note on screen telling you where to add them.

Useful neighbours:

| Option | Does |
| --- | --- |
| `showVideo: false` | Audio only — keeps the animated background |
| `videoOpacity` | How far the video is dimmed behind the text (0–1) |
| `startMuted` / `volume` | Starting sound. Players' own changes are remembered |
| `showControls: false` | Hides the now-playing card entirely |
| `allowSkip: false` | Keeps the card, drops the prev/next buttons |

### Sound

Players get play/pause, skip, mute and a volume slider, plus `M`, `Space` and
the arrow keys. Their volume and mute choice are saved and reused next time
they connect.

Videos always *start* muted for a fraction of a second and are unmuted
immediately after, because unmuted autoplay is the one thing a browser will
refuse outright. If that unmute is refused too, the screen keeps playing muted
and tells the player to press `M` rather than silently losing the audio.

Videos that are private, deleted, or blocked from embedding are skipped
automatically.

### Rain

The falling dots, under `rain`:

| Option | Does |
| --- | --- |
| `count` | How many dots at once. The one to lower on weak machines |
| `speed` | `1` normal, `0.5` drifting, `2` downpour |
| `trail` | `0` bare dots, `1` long comet tails |
| `wind` | Sideways drift |
| `accentChance` | How many dots pick up your accent color |
| `colors` | The palette for everything else |

Set `enabled: false` to turn them off.

### Branding

`serverName`, `tagline` and `accent` are the whole theme — `accent` recolours
the progress bar, the percentage, the tip card and the accent dots together.
The logo is `web/logo.png`; replace the file, or set `showLogo: false`.

## Legal

esx_loadingscreen - Loading in style!

Copyright (C) 2020-2024 ESX Framework

This program Is free software: you can redistribute it And/Or modify it under the terms Of the GNU General Public License As published by the Free Software Foundation, either version 3 Of the License, Or (at your option) any later version.

This program Is distributed In the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty Of MERCHANTABILITY Or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License For more details.

You should have received a copy Of the GNU General Public License along with this program. If Not, see <http://www.gnu.org/licenses/>.
