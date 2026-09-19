/* ===========================================================
   ERRFpanel — background music player
   HTMLAudioElement + play/pause + volume + persisted position.
   The actual music file will be provided later: drop it into
   static/audio/ and update MUSIC_SRC / MUSIC_ID below.
   No autoplay-policy bypasses: if the browser blocks playback,
   we wait for the first user interaction, then resume.
   =========================================================== */

const ERRFMusic = (() => {
  // ---- configurable music source (replace when the file is ready) ----
  const MUSIC_SRC = "/static/audio/background.mp3";
  const MUSIC_ID = "errf-bgm-v2";    // bump when the file changes (invalidates old positions)

  const LS_TIME = "errf_music_time";
  const LS_VOL = "errf_music_vol";
  const LS_PLAYING = "errf_music_playing";
  const LS_SRC = "errf_music_src";
  const SAVE_INTERVAL_MS = 5000;

  let audio = null;
  let toggleBtn = null;
  let volInput = null;
  let volPct = null;
  let timeEl = null;
  let saveTimer = null;
  let gestureArmed = false;

  function clamp01(v) {
    v = parseFloat(v);
    if (!isFinite(v)) return null;
    return Math.min(1, Math.max(0, v));
  }

  function fmtTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    sec = Math.floor(sec);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ":" + String(s).padStart(2, "0");
  }

  function syncVolPct() {
    if (!volPct || !audio) return;
    volPct.textContent = Math.round(audio.volume * 100) + "%";
  }

  function hasSource() {
    return !!(MUSIC_SRC && MUSIC_SRC.trim());
  }

  function readState() {
    try {
      const sameSrc = localStorage.getItem(LS_SRC) === MUSIC_ID;
      const t = sameSrc ? parseFloat(localStorage.getItem(LS_TIME)) : NaN;
      const vol = clamp01(localStorage.getItem(LS_VOL));
      return {
        time: sameSrc && isFinite(t) && t >= 0 ? t : 0,
        volume: vol === null ? 0.7 : vol,
        playing: localStorage.getItem(LS_PLAYING) !== "off",
      };
    } catch (e) {
      // storage blocked — same defaults, playback continues without persistence
      return { time: 0, volume: 0.7, playing: true };
    }
  }

  function persist() {
    if (!audio) return;
    try {
      localStorage.setItem(LS_SRC, MUSIC_ID);
      localStorage.setItem(LS_VOL, String(audio.volume));
      if (isFinite(audio.currentTime)) {
        localStorage.setItem(LS_TIME, String(audio.currentTime));
      }
    } catch (e) { /* storage unavailable — play on without persistence */ }
  }

  function markPlaying(on) {
    try { localStorage.setItem(LS_PLAYING, on ? "on" : "off"); } catch (e) {}
  }

  function syncUI() {
    if (!toggleBtn || !audio) return;
    const paused = audio.paused;
    const label = window.STANNG
      ? (paused ? STANNG.t("music_play") : STANNG.t("music_pause"))
      : (paused ? "Play" : "Pause");
    toggleBtn.setAttribute("title", label);
    toggleBtn.setAttribute("aria-label", label);
    toggleBtn.classList.toggle("is-paused", paused);
    toggleBtn.innerHTML = paused
      ? '<svg><use href="#icon-play"/></svg>'
      : '<svg><use href="#icon-pause"/></svg>';
  }

  function tryPlay() {
    if (!audio || !hasSource()) return Promise.resolve(false);
    try {
      const p = audio.play();
      if (p && typeof p.catch === "function") {
        return p.then(() => true).catch(() => false);
      }
      return Promise.resolve(true);
    } catch (e) {
      return Promise.resolve(false);
    }
  }

  function armGestureFallback() {
    if (gestureArmed || !hasSource()) return;
    gestureArmed = true;
    const onGesture = () => {
      tryPlay().then((ok) => {
        if (ok) {
          window.removeEventListener("pointerdown", onGesture);
          window.removeEventListener("keydown", onGesture);
          window.removeEventListener("touchend", onGesture);
          gestureArmed = false;
        }
      });
    };
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);
    window.addEventListener("touchend", onGesture);
  }

  function startSaveTimer() {
    stopSaveTimer();
    saveTimer = setInterval(persist, SAVE_INTERVAL_MS);
  }
  function stopSaveTimer() {
    if (saveTimer) { clearInterval(saveTimer); saveTimer = null; }
  }

  function init() {
    audio = document.getElementById("bgMusic");
    toggleBtn = document.getElementById("musicToggle");
    volInput = document.getElementById("musicVolume");
    volPct = document.getElementById("musicVolumePct");
    timeEl = document.getElementById("musicTime");
    if (!audio || !toggleBtn) return;

    const state = readState();

    if (!hasSource()) {
      toggleBtn.disabled = true;
      toggleBtn.style.opacity = "0.45";
      const hint = window.STANNG ? STANNG.t("music_no_source") : "Music file not configured yet";
      toggleBtn.setAttribute("title", hint);
      if (timeEl) timeEl.textContent = "0:00";
      if (volInput) volInput.value = Math.round(state.volume * 100);
      if (volPct) volPct.textContent = Math.round(state.volume * 100) + "%";
      return;
    }

    audio.src = MUSIC_SRC;
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = state.volume;

    const applySavedTime = () => {
      try {
        if (state.time > 0 && isFinite(audio.duration) && audio.duration > 0) {
          audio.currentTime = Math.min(state.time, Math.max(0, audio.duration - 1));
        } else if (state.time > 0) {
          audio.currentTime = state.time;
        }
      } catch (e) { /* invalid seek (source changed?) — start from 0 */ }
    };
    // Restore order: state/source/currentTime first, play() only afterwards,
    // and only if the player was playing before the reload.
    const resumePlayback = () => {
      if (state.playing) {
        tryPlay().then((ok) => { if (!ok) armGestureFallback(); });
      }
    };
    if (audio.readyState >= 1) { applySavedTime(); resumePlayback(); }
    else audio.addEventListener("loadedmetadata", () => { applySavedTime(); resumePlayback(); }, { once: true });

    if (volInput) {
      volInput.value = Math.round(state.volume * 100);
      volInput.setAttribute("aria-label", "volume");
      volInput.addEventListener("input", () => {
        const v = clamp01(volInput.value / 100);
        if (v !== null) {
          audio.volume = v;
          syncVolPct();
          persist();
        }
      });
    }
    syncVolPct();

    toggleBtn.addEventListener("click", () => {
      if (audio.paused) {
        tryPlay().then((ok) => { if (!ok) armGestureFallback(); });
      } else {
        audio.pause();
      }
    });

    audio.addEventListener("play", () => { markPlaying(true); startSaveTimer(); syncUI(); });
    audio.addEventListener("pause", () => { markPlaying(false); persist(); stopSaveTimer(); syncUI(); });
    audio.addEventListener("volumechange", () => { syncVolPct(); persist(); });
    audio.addEventListener("timeupdate", () => {
      if (timeEl) timeEl.textContent = fmtTime(audio.currentTime);
    });

    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", () => { if (document.hidden) persist(); });

    syncUI();
  }

  return { init, tryPlay };
})();

document.addEventListener("DOMContentLoaded", () => ERRFMusic.init());
