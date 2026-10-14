const cache = new Map();
const MAX_CACHE = 300;

const DEFAULTS = {
  enabled: true,
  targetLang: "th",
  sourceLang: "auto",
  showOriginal: true,
  fontSize: 18,
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(DEFAULTS, (cfg) => {
    chrome.storage.sync.set({ ...DEFAULTS, ...cfg });
  });
});

function cacheKey(text, source, target) {
  return `${source}|${target}|${text}`;
}

function trimCache() {
  if (cache.size <= MAX_CACHE) return;
  const drop = cache.size - MAX_CACHE;
  const keys = cache.keys();
  for (let i = 0; i < drop; i++) {
    const k = keys.next().value;
    if (k != null) cache.delete(k);
  }
}

async function translateText(text, sourceLang, targetLang) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";

  const key = cacheKey(cleaned, sourceLang, targetLang);
  if (cache.has(key)) return cache.get(key);

  // Unofficial Google Translate endpoint (hobby use; may rate-limit or change)
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", sourceLang || "auto");
  url.searchParams.set("tl", targetLang || "th");
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", cleaned);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Translate HTTP ${res.status}`);
  }

  const data = await res.json();
  const translated = (data?.[0] || [])
    .map((part) => part?.[0] || "")
    .join("")
    .trim();

  cache.set(key, translated);
  trimCache();
  return translated;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "GET_SETTINGS") {
    chrome.storage.sync.get(DEFAULTS, sendResponse);
    return true;
  }

  if (msg?.type === "SET_SETTINGS") {
    chrome.storage.sync.set(msg.settings || {}, () => sendResponse({ ok: true }));
    return true;
  }

  if (msg?.type === "TRANSLATE") {
    translateText(msg.text, msg.sourceLang, msg.targetLang)
      .then((translated) => sendResponse({ ok: true, translated }))
      .catch((err) =>
        sendResponse({ ok: false, error: err?.message || "Translate failed" })
      );
    return true;
  }
});
