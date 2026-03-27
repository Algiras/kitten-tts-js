---
name: kitten-tts-browser
description: >-
  Verifies kitten-tts-js in real browsers: serve docs, exercise WASM/WebGPU ORT
  paths, worker TTS, and slides lab — via Playwright or a browser agent (e.g.
  Cursor browser MCP). Triggers: browser test TTS, Playwright, slides lab,
  WASM ORT Web, docs demo, WebGPU Nano, worker.js, fullscreen slides, secure
  context, SharedArrayBuffer, cross-browser smoke.
---

# Browser verification (kitten-tts-js)

Node-only tests miss **ORT Web**, **fetch + Cache API**, **WebAudio**, and **fullscreen / mic** flows. Prefer at least one **real Chromium** pass before trusting a change.

## Serve static docs

From repo root:

```bash
npm run build:pages
npm run serve:docs
```

Default is often **http://127.0.0.1:3000** — use **HTTPS or localhost** patterns the README calls out for audio and model fetch.

**Entry points**

| URL (typical) | What to exercise |
|---------------|------------------|
| `/` or `/index.html` | Main demo, worker, streaming toggles |
| `/slides.html` | Slides lab: presenter UI, optional `?debug=1`, narrator / PTT |

Adjust path if your static server mounts `docs/` as root.

## What to check (smoke)

1. **Page load** — No console errors from ORT WASM init; models list or voice selector populated after build.
2. **One synthesis** — Enter short text, generate/play; confirm non-silent audio or visible waveform/status.
3. **Worker path** — If the page uses `worker.js`, confirm network 200 and no worker exception (console + UI state).
4. **Slides lab** — Navigate slides; optional fullscreen; if testing narrator, **user gesture** may be required for audio (click “Load Narrator” / read slide first).

## Playwright (headless-friendly)

- Use **`--host 127.0.0.1`** and the same port as `serve:docs`.
- Prefer **Chromium** first (best-tested for ORT Web in this stack).
- Timeouts: first model download can be **tens of seconds** — don’t use tiny default timeouts for “first run”.
- If tests need **threads/SAB**, launch with flags and headers the ORT / README matrix documents (or test the non-threaded path explicitly).

## Browser agent / MCP (e.g. Cursor)

- **Snapshot** the page before clicking; **scroll into view** for controls at the bottom of long demos.
- **Native `alert` / `confirm`** may not block automation — still avoid relying on dialogs for critical flow.
- **Fullscreen + iframes**: interact only with the top-level stage you can reach; iframes may be opaque to the agent.

## Common failures

| Symptom | Likely cause |
|---------|----------------|
| WASM fails to init | Wrong MIME for `.wasm`, missing `docs/*.wasm` after build, or bad path |
| Silent output | Autoplay policy — click UI first; or GPU/WASM backend mismatch (Nano WebGPU vs WASM tiers) |
| Model fetch blocked | Not **secure context**; CORS; offline before cache warm |
| Crashes on threads | COOP/COEP or browser build without desired WASM features — test degraded path |

## Output

Report: URL, browser, pass/fail per step, **console errors** (first lines), and whether audio played or only UI succeeded.
