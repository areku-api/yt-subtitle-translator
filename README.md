# YT Realtime Subtitle Translate

Chrome extension — translate YouTube captions **in real time** and show dual subtitles (original + translated) on the player.

## How it works

1. You turn on YouTube **CC** (captions)
2. Content script watches `.ytp-caption-segment` via `MutationObserver`
3. Each new line is sent to the service worker
4. Worker calls Google Translate (`translate.googleapis.com`, unofficial client)
5. Overlay renders under the video

```
YouTube CC DOM  →  content.js  →  background.js (translate + cache)  →  overlay
```

## Install

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select this folder
4. Open a YouTube watch page → enable **CC** → open extension popup → pick target language (default: Thai)

## Settings

| Setting | Default | Notes |
|---------|---------|--------|
| Enable translation | on | Master switch |
| Target language | `th` | Thai |
| Source language | `auto` | Auto detect |
| Show original | on | Dual line overlay |
| Font size | 18 | Overlay text size |

## Limits / honesty

- Needs YouTube captions enabled (auto-generated or manual)
- Uses an **unofficial** Translate endpoint — fine for personal use; may rate-limit or break
- Not ideal for publishing to the Web Store without your own translate backend / API key proxy
- SPA navigation: observer re-binds on URL change

## Upgrade path (harder / better)

1. Proxy translations through your backend (DeepL / Google Cloud Translation)
2. Parse `timedtext` tracks for lower latency / less DOM dependency
3. Bidirectional cache + batch short lines
4. Optional: hide native CC and show only translation

## Repo layout

| File | Role |
|------|------|
| `manifest.json` | MV3 |
| `background.js` | Translate + settings + cache |
| `content.js` / `content.css` | Caption observer + overlay |
| `popup.*` | Settings UI |
