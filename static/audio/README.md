# ERRFpanel background music

The active music file is `background.mp3` in this folder, wired via
`MUSIC_SRC = "/static/audio/background.mp3"` in `static/js/music.js`.

1. Copy your audio file here, e.g. `background.mp3` (`.mp3` / `.ogg` recommended).
2. Open `static/js/music.js` and set:
   - `MUSIC_SRC = "/static/audio/background.mp3"`
   - `MUSIC_ID = "errf-bgm-v2"` (bump the ID every time the file changes —
     this discards stale saved playback positions from the previous file).
3. Reload the panel. The player appears in the top bar (desktop) and as a
   floating dock (mobile / auth pages).

Behavior: play/pause + volume, position + volume persisted in
`localStorage` (`errf_music_*`), autoplay attempted on load with a
browser-safe first-interaction fallback. No autoplay-policy bypasses.
