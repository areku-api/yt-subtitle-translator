(() => {
  if (window.__ytSubTranslateLoaded) return;
  window.__ytSubTranslateLoaded = true;

  const OVERLAY_ID = "yt-sub-translate-overlay";
  const HINT_ID = "yt-sub-translate-hint";

  let settings = {
    enabled: true,
    targetLang: "th",
    sourceLang: "auto",
    showOriginal: true,
    fontSize: 18,
  };

  let lastSource = "";
  let lastTranslated = "";
  let pendingText = "";
  let translating = false;
  let debounceTimer = null;
  let observer = null;
  let playerRoot = null;

  function isWatchPage() {
    return location.pathname === "/watch" || location.pathname.startsWith("/live/");
  }

  function getPlayer() {
    return (
      document.querySelector("#movie_player") ||
      document.querySelector(".html5-video-player")
    );
  }

  function readCaptionText() {
    const segments = document.querySelectorAll(
      ".ytp-caption-segment, .caption-visual-line .ytp-caption-segment"
    );
    if (!segments.length) {
      const windowEl = document.querySelector(
        ".ytp-caption-window-container, .caption-window"
      );
      return (windowEl?.innerText || "").trim();
    }
    return [...segments]
      .map((el) => el.textContent || "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function ensureOverlay() {
    const player = getPlayer();
    if (!player) return null;

    if (playerRoot !== player) {
      playerRoot = player;
      document.getElementById(OVERLAY_ID)?.remove();
    }

    let overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = OVERLAY_ID;
      overlay.innerHTML = `
        <div class="ytst-line ytst-original" hidden></div>
        <div class="ytst-line ytst-translated"></div>
      `;
      player.appendChild(overlay);
    }

    overlay.style.setProperty("--ytst-font-size", `${settings.fontSize}px`);
    return overlay;
  }

  function setOverlay(original, translated) {
    const overlay = ensureOverlay();
    if (!overlay) return;

    const origEl = overlay.querySelector(".ytst-original");
    const trEl = overlay.querySelector(".ytst-translated");

    if (settings.showOriginal) {
      origEl.hidden = false;
      origEl.textContent = original || "";
    } else {
      origEl.hidden = true;
      origEl.textContent = "";
    }

    trEl.textContent = translated || "";
    overlay.hidden = !settings.enabled || (!original && !translated);
  }

  function showHint(show) {
    let hint = document.getElementById(HINT_ID);
    if (!show) {
      hint?.remove();
      return;
    }
    const player = getPlayer();
    if (!player || !settings.enabled) return;
    if (!hint) {
      hint = document.createElement("div");
      hint.id = HINT_ID;
      hint.textContent =
        "Enable YouTube CC (subtitles) — this extension translates live captions.";
      player.appendChild(hint);
    }
  }

  async function loadSettings() {
    settings = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
    applyEnabledUi();
  }

  function applyEnabledUi() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) overlay.hidden = !settings.enabled;
    if (!settings.enabled) showHint(false);
  }

  async function translateLine(text) {
    if (!text || !settings.enabled) return;

    if (text === lastSource && lastTranslated) {
      setOverlay(text, lastTranslated);
      return;
    }

    translating = true;
    try {
      const res = await chrome.runtime.sendMessage({
        type: "TRANSLATE",
        text,
        sourceLang: settings.sourceLang,
        targetLang: settings.targetLang,
      });

      if (!res?.ok) {
        setOverlay(text, `⚠ ${res?.error || "translate failed"}`);
        return;
      }

      lastSource = text;
      lastTranslated = res.translated || text;
      setOverlay(text, lastTranslated);
    } catch (err) {
      setOverlay(text, `⚠ ${err?.message || "translate failed"}`);
    } finally {
      translating = false;
      if (pendingText && pendingText !== text) {
        const next = pendingText;
        pendingText = "";
        queueTranslate(next);
      }
    }
  }

  function queueTranslate(text) {
    if (!settings.enabled) return;
    pendingText = text;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const t = pendingText;
      pendingText = "";
      if (!translating) translateLine(t);
      else pendingText = t;
    }, 120);
  }

  function onCaptionMaybeChanged() {
    if (!settings.enabled || !isWatchPage()) return;

    const text = readCaptionText();
    if (!text) {
      // Captions off or gap between lines
      if (!lastSource) showHint(true);
      return;
    }

    showHint(false);
    if (text !== lastSource) queueTranslate(text);
    else setOverlay(text, lastTranslated);
  }

  function bindObserver() {
    observer?.disconnect();

    const root =
      document.querySelector(".ytp-caption-window-container") ||
      document.querySelector("#movie_player") ||
      document.body;

    observer = new MutationObserver(() => onCaptionMaybeChanged());
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  function boot() {
    if (!isWatchPage()) {
      document.getElementById(OVERLAY_ID)?.remove();
      showHint(false);
      return;
    }
    ensureOverlay();
    bindObserver();
    onCaptionMaybeChanged();
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const [key, { newValue }] of Object.entries(changes)) {
      settings[key] = newValue;
    }
    applyEnabledUi();
    if (lastSource) {
      // Re-translate if language changed
      if (changes.targetLang || changes.sourceLang) {
        lastTranslated = "";
        queueTranslate(lastSource);
      } else {
        setOverlay(lastSource, lastTranslated);
      }
    }
  });

  // YouTube SPA navigation
  let lastHref = location.href;
  const navTick = setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      lastSource = "";
      lastTranslated = "";
      boot();
    }
  }, 800);

  window.addEventListener("yt-navigate-finish", boot, true);

  loadSettings().then(boot);

  // Keep interval from being optimized away in some builds
  window.__ytSubTranslateNavTick = navTick;
})();
