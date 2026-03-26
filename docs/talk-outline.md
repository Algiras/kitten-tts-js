# Talk outline — kitten-tts-js

**Working title (for abstract / meetup listing):** kitten-tts: real-time TTS (text-to-speech) on (almost) anything  
**Speaker:** Algimantas Krasauskas · AI Engineer, Wix · [GitHub](https://github.com/Algiras) · [LinkedIn](https://www.linkedin.com/in/asimplek/)

---

## Slide 1 — Title & you

**On slide**

- **Title:** kitten-tts: real-time TTS on (almost) anything
- **Lede:** Algimantas Krasauskas · AI Engineer · Wix — kitten-tts-js, **Kiki** (AI assistant) in the loop for this deck
- 🐙 https://github.com/Algiras · 💼 https://www.linkedin.com/in/asimplek/

**Say**

- Open on the **title** (what the room is here for), then “Thanks for having me,” name, role, Wix; point at the 🐙 / 💼 lines if useful — don’t read URLs robotically unless someone asks.
- **kitten-tts-js** repo URLs stay on **thank you** and **Q&A** slides, not here.

**Notes**

- The **headline is the talk**, not your name — name and links are supporting context.

---

## Slide 2 — What we’ll talk about (plan)

**On slide**

- What is TTS (text-to-speech)?
- What is **KittenTTS**? — models, voices, Hugging Face (HF — model hub) weights
- **Why kitten-tts-js** — providers, runtimes, why JavaScript (JS)
- How it was built — agents; Whisper (OpenAI STT family), waveform (audio signal), browser evals
- Where it runs — Node.js vs browser, requirements (CPU, WASM, WebGPU)
- What else you might use — other stacks, providers, tradeoffs
- What’s next → **Q&A** (questions & answers)

**Say**

- 30–45 seconds: you’re grounding the arc so “why JS” lands after TTS + KittenTTS are defined; **per-slide “On this slide” glossary** (right column in `slides-lab`) defines terms at first use — no separate abbreviations slide.
- Optional: “I’ll show a short demo when we get to the port” — or stay quiet and surprise them.

**Notes**

- Demo + **live / GitHub / npm** links fit naturally after **slide 5** (why kitten-tts-js) or on **Q&A / thank you**.

---

## Slide 3 — What is TTS?

**On slide**

- TTS = text → waveform you hear; **neural** = ML-trained vs classical / rule-based
- Pipeline: text → linguistic features (pronunciation / prosody) → acoustic model (sound predictor) → waveform
- `speechSynthesis` = built-in **Web Speech API** TTS in the tab; no WAV (waveform file) pipeline; hard to **A/B** (compare setups) for *your* stack

**Say**

- Set vocabulary for non-speech folks; keep it one minute.
- Contrast: built-in TTS is great for accessibility and quick UI; **neural** TTS is for when you need repeatable output, export, or the same stack in Node and web.

**Demo hook (optional)**

- Defer A/B clip until after **why kitten-tts-js** (slide 5): same sentence — `speechSynthesis` vs this port.

---

## Slide 4 — What is KittenTTS?

**On slide**

- [KittenTTS](https://github.com/KittenML/KittenTTS) by [KittenML / Stellon Labs](https://github.com/KittenML) — reference implementation (Python)
- Architecture: **StyleTTS2-style** — same neural TTS research lineage; **ONNX** exports are what the JS port runs (not the Python training loop)
- **Models / tiers** — nano, micro, mini (size ↔ quality tradeoff; all “small” vs cloud TTS)
- **Provider of record:** weights and voice embeddings live under **[KittenML on Hugging Face](https://huggingface.co/KittenML)** — that’s the upstream “source of truth”
- **Voices** (same set in the port): Bella, Jasper, Luna, Bruno, Rosie, Hugo, Kiki, Leo

**Say**

- Separate **research + checkpoints** (KittenML) from **how you load them** in JS (next slide: `KittenML/…` vs `onnx-community/…` repacks for the browser).
- kitten-tts-js is a **runtime port**, not a new TTS architecture.
- One line on license / Apache-2.0 if the room cares.

---

## Slide 5 — Why kitten-tts-js?

**On slide**

*What it is*

- Unofficial **TypeScript/JavaScript** port of KittenTTS — [Algiras/kitten-tts-js](https://github.com/Algiras/kitten-tts-js) · `npm install kitten-tts-js`
- **ONNX Runtime** in-process: Node **CPU** · browser **WASM** (+ SIMD / threads where enabled) · **WebGPU** when available
- **Streaming:** async generator, sentence-by-sentence · **caching** (Node cache dir + browser Cache API) after first download

*Models & providers (the practical split)*

- **Node:** load from **`KittenML/…`** Hugging Face IDs (e.g. int8 nano) — **CPU** execution in the supported runtime layer
- **Browser (WASM):** community **ONNX repacks** under **`onnx-community/KittenTTS-…-ONNX`** — Nano, Micro, Mini tiers for CPU/WASM
- **Browser (WebGPU):** **Nano ONNX only** today — ORT WebGPU doesn’t cover the int8 ops path used by Micro/Mini the same way; WASM fallback remains

*Why JavaScript*

- **Fast iteration** — one language for lib, demo, and tests
- **Streaming / UX** — earlier first chunk; fits chat and voice UIs
- **Deployment** — same code in CLI, static pages, workers
- **Ecosystem** — npm, no Python service in the loop for *your* app

**Say**

- “Same voices and research as KittenTTS; I wanted it to run **where my stack already lives**.”
- Name the two “addresses” people actually paste: **`KittenML/…`** on the server side vs **`onnx-community/…`** when you need a browser-shaped ONNX bundle.
- Honest tradeoff: the Python project is the reference; JS buys **distribution and integration**, not always beating every cloud API on raw quality.

**Demo hook (optional)**

- Short live or recorded clip here; or: [Live demo](https://algiras.github.io/kitten-tts-js) · [GitHub](https://github.com/Algiras/kitten-tts-js) · [npm](https://www.npmjs.com/package/kitten-tts-js)

---

## Slide 6 — How it was built (process)

**On slide**

- **Agents + editor:** Cursor, Composer, Claude Code — spec → code → fix loops
- **STT eval:** Whisper (or similar) on **synthetic WAV** — transcript vs **reference** text; normalize and diff; optional WER
- **Signal eval:** Waveform / level **gates** (silence, peak, RMS) on fixed prompts so bad exports fail without ear-testing
- **Web confidence:** Playwright or browser-agent runs — real **WASM / WebAudio** path, not “green in Node” only
- **Tooling:** Repo **whisper-tts-eval** skill — Claude / Cursor `/tts-eval` and `/whisper-eval` for the same loop

**Say**

- Story beat: “I didn’t trust ‘sounds fine’ — I wanted comparable strings and signals across commits.”
- **Next slide** is the full-screen loop diagram only — one spoken sentence there, then let the graphic carry it.

---

## Slide 7 — Build / eval loop (diagram)

**On slide**

- **Mermaid diagram:** change → WAV out → STT + level gates → pass? → ship or iterate

**Say**

- One sentence on the cycle; do not read node labels as a list unless the room asks.

---

## Slide 8 — Where it runs — requirements

**On slide**

- **Node.js** — supported release line from the repo; **CPU** runtime (thread count configurable). First run **downloads** the chosen HF model; then cached.
- **Browser** — modern evergreen; **secure context** (HTTPS or localhost) for sensible audio + model fetch behavior
- **WASM path** — SIMD / multi-threading when the embedding page and ORT build allow it (otherwise slower but still works)
- **WebGPU** — needs a capable browser + GPU stack; **not** all models: **Nano ONNX only** for GPU; Micro/Mini stay WASM on the web
- **Network / disk** — model bytes are not bundled in `npm` the same way as a tiny library; plan for **tens of MB** per tier and **offline** only after cache warms

**Say**

- Summarize the **support matrix** in one sentence: Node + KittenML IDs + CPU; browser + onnx-community ONNX + WASM for all three tiers; GPU only Nano.
- Optional: `diagnose:node-runtime` from the README if the audience is implementers.

---

## Slide 9 — Landscape — other models, providers, requirements

**On slide**

| Option | Model / provider shape | Typical requirements |
|--------|-------------------------|----------------------|
| **Web Speech API** | OS / browser voices, not your ONNX file | None beyond the browser; weakest control & consistency |
| **kokoro-js** / small **ONNX-in-JS** TTS | Own checkpoints + ORT Web; compare **size, license, voice count** | Same class as kitten-tts-js: fetch, cache, WASM/WebGPU story |
| **Cloud TTS** (ElevenLabs, Google, Azure, **OpenAI**, …) | **Their** hosted model; **API key + billing** | Network always on; data leaves your infra; often best raw quality |
| **Self-host server** (**Piper**, Coqui-era tools, custom ONNX server) | You ship **binary + model files** or a **container** | Ops overhead; not “static GitHub Pages only” |
| **Upstream Python KittenTTS** | **KittenML** checkpoints; Python env | GPU/CPU as upstream docs; different deployment than JS |

**Say**

- One axis: **who hosts the model** (you vs vendor vs user’s browser cache).
- Other axis: **requirements** — API key & egress vs disk & RAM vs WebGPU/WASM availability.
- Position kitten-tts-js: **self-hosted weights, small footprint, JS-native**, great when you want Kitten voices **without** a Python service — not “always replace cloud TTS.”

---

## Slide 10 — What’s next?

**On slide**

- **Document** Whisper + waveform evals end-to-end — thresholds, fixtures, CI hooks
- Stronger **listen-back / scoring** in this deck lab (transcript vs intent, not only waveforms)
- Docs and examples for **worker** layout and **streaming** UX patterns
- **Golden WAV + transcript baselines in CI** — fail PRs when STT or level checks drift
- Community: issues/PRs on [Algiras/kitten-tts-js](https://github.com/Algiras/kitten-tts-js)

**Say**

- Bridge to Q&A: eval story is “measure transcripts and waveforms, then lock golden files in CI”; one line on contributors; optional `?debug=1` on the slides lab if you showed it.

---

## Slide 11 — Q&A

**On slide**

- **Questions?**
- Optional: name, handle, or email; **repo + demo URLs** (repeat here so latecomers see them)

**Say**

- Stay at the Q&A slide while you answer; keeps the room focused and gives latecomers the links.
- If nobody speaks: offer seed prompts (e.g. “**which HF ID in Node vs browser?**” / “**WebGPU vs WASM** for my model?” / “**cloud vs self-host** for production?”).

**Notes**

- Reserve **as needed** time here; shorten slide 10 (roadmap) or earlier blocks if the slot is tight.

---

## Slide 12 — Thank you

**On slide**

- **Thank you**
- kitten-tts-js · [github.com/Algiras/kitten-tts-js](https://github.com/Algiras/kitten-tts-js)
- Thanks again to [KittenML / KittenTTS](https://github.com/KittenML/KittenTTS) for models and voices

**Say**

- Short, warm close; optional “stick around if you want to try the demo.”

---

## Flow (high level)

1. **Title & you** → 2. **Plan** → 3. **What is TTS** → 4. **What is KittenTTS** *(models / HF)* → 5. **Why kitten-tts-js** *(providers + why JS)* → 6. **How built** → 7. **Eval-loop diagram** → 8. **Where + requirements** → 9. **Landscape** *(others’ models & providers)* → 10. **What’s next** → 11. **Q&A** → 12. **Thank you**

## Timing sketch (adjust to slot)

| Block | Minutes |
|-------|---------|
| Title (1) + plan (2) | 2–3 |
| What is TTS (3) + KittenTTS (4) | 4–5 |
| Why kitten-tts-js (5) — incl. optional demo | 4–6 |
| Build story (6) + eval-loop diagram (7) | 4–5 |
| Requirements / runtimes (8) + landscape (9) | 4–6 |
| Roadmap (slide 10) | 2–3 |
| **Q&A (slide 11)** | *as needed* |
| **Thank you (slide 12)** | under 1 min (or hold while people leave) |

---

## Checklist before talk

- [ ] Demo offline fallback (or tethered tab) if live site is slow
- [ ] **Full URLs** on slide 5 (optional), **Q&A (11)**, and/or **thank you (12)** — not required on slide 1
- [ ] **Attribution** slide or footer: KittenML / Stellon Labs + Hugging Face model cards (+ **onnx-community** if you show browser IDs)
- [ ] **Support matrix** (Node CPU / browser WASM / WebGPU Nano-only) matches current README — skim before the talk
- [ ] **Plan slide** (2) matches the deck order you actually built
- [ ] **Q&A slide** (11) ready before questions; **thank you** (12) last in the deck
- [ ] Spell-check: Compose → **Composer** (Cursor) if that’s what you used
