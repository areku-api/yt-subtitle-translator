const enabled = document.getElementById("enabled");
const targetLang = document.getElementById("targetLang");
const sourceLang = document.getElementById("sourceLang");
const showOriginal = document.getElementById("showOriginal");
const fontSize = document.getElementById("fontSize");

function save(partial) {
  chrome.runtime.sendMessage({ type: "SET_SETTINGS", settings: partial });
}

chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (cfg) => {
  if (!cfg) return;
  enabled.checked = Boolean(cfg.enabled);
  targetLang.value = cfg.targetLang || "th";
  sourceLang.value = cfg.sourceLang || "auto";
  showOriginal.checked = Boolean(cfg.showOriginal);
  fontSize.value = String(cfg.fontSize || 18);
});

enabled.addEventListener("change", () => save({ enabled: enabled.checked }));
targetLang.addEventListener("change", () =>
  save({ targetLang: targetLang.value })
);
sourceLang.addEventListener("change", () =>
  save({ sourceLang: sourceLang.value })
);
showOriginal.addEventListener("change", () =>
  save({ showOriginal: showOriginal.checked })
);
fontSize.addEventListener("input", () =>
  save({ fontSize: Number(fontSize.value) })
);
