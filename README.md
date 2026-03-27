# kitten-tts-js

> JavaScript/TypeScript port of [KittenTTS](https://github.com/KittenML/KittenTTS) — ultra-lightweight neural TTS via ONNX. Works in Node.js and modern browsers with no Python dependency.

[![npm version](https://img.shields.io/npm/v/kitten-tts-js)](https://www.npmjs.com/package/kitten-tts-js)
[![CI](https://github.com/Algiras/kitten-tts-js/actions/workflows/ci.yml/badge.svg)](https://github.com/Algiras/kitten-tts-js/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](./LICENSE)

**[Live Demo →](https://algiras.github.io/kitten-tts-js)** · **[npm →](https://www.npmjs.com/package/kitten-tts-js)** · **[GitHub →](https://github.com/Algiras/kitten-tts-js)**

> **Based on [KittenTTS](https://github.com/KittenML/KittenTTS) by [KittenML / Stellon Labs](https://github.com/KittenML)**
> — original Python library: [github.com/KittenML/KittenTTS](https://github.com/KittenML/KittenTTS)
> — original models & voices: [huggingface.co/KittenML](https://huggingface.co/KittenML)
>
> All credit for the models, architecture, and voice embeddings goes to them.
> Licensed under [Apache 2.0](./LICENSE). See [NOTICE](./NOTICE) for full attribution.

> **Disclaimer:** This is an **unofficial** community port made by a hobbyist who needed KittenTTS in JavaScript.
> It is **not** affiliated with, endorsed by, or supported by KittenML or Stellon Labs.

---

## Features

- **Ultra-lightweight** — nano model is ~25 MB
- **Node + browser support** — Node.js on CPU, browser on WASM, with WebGPU for Nano ONNX
- **8 voices** — Bella, Luna, Rosie, Kiki, Leo, Jasper, Bruno, Hugo
- **StyleTTS2-based** ONNX models from HuggingFace
- **Streaming support** — sentence-by-sentence async generator
- **TypeScript declarations** included
- **Automatic caching** — `~/.cache/kitten-tts/` in Node, Cache API in browser

---

## Install

```bash
npm install kitten-tts-js
```

---

## Quick Start

### Node.js

```js
import { KittenTTS } from 'kitten-tts-js';

const tts = await KittenTTS.from_pretrained('KittenML/kitten-tts-nano-0.8-int8');

console.log(tts.list_voices());
// → ['Bella', 'Jasper', 'Luna', 'Bruno', 'Rosie', 'Hugo', 'Kiki', 'Leo']

const audio = await tts.generate('Hello from KittenTTS!', { voice: 'Jasper' });
await audio.save('output.wav');
```

### Runtime Modes (Node/browser)

Use runtime modes to keep the full pipeline in JavaScript while selecting supported execution backends for each environment.

```js
import { KittenTTS } from 'kitten-tts-js';

// Node explicit CPU mode with controlled threads
const ttsCpu = await KittenTTS.from_pretrained('KittenML/kitten-tts-nano-0.8-int8', {
  runtime: 'cpu',
  numThreads: 4
});

// Browser CPU mode (WASM backend)
const ttsBrowser = await KittenTTS.from_pretrained('onnx-community/KittenTTS-Micro-v0.8-ONNX', {
  runtime: 'cpu',
  wasmThreads: 4,
  wasmSimd: true
});

// Browser GPU mode (WebGPU with automatic WASM fallback when unavailable)
const ttsBrowserGpu = await KittenTTS.from_pretrained('onnx-community/KittenTTS-Nano-v0.8-ONNX', {
  runtime: 'gpu'
});
```

Runtime notes:

- The library is supported in both Node.js and the browser.
- Browser CPU/WASM works across the ONNX Community Nano, Micro, and Mini exports.
- Browser GPU/WebGPU is currently Nano-only: `onnx-community/KittenTTS-Nano-v0.8-ONNX`.
- Across the ONNX Community browser exports, Nano, Micro, and Mini cover all three size tiers.
- Node runtime modes: `auto`, `cpu`.
- Browser runtime modes: `auto`, `cpu`, `gpu` (`wasm` is accepted as a legacy alias of `cpu`).
- Browser `gpu` uses the WebGPU execution provider and may fall back to WASM when unavailable.
- `onnx-community/KittenTTS-Nano-v0.8-ONNX` is the browser-friendly GPU/WASM model.
- `onnx-community/KittenTTS-Micro-v0.8-ONNX` and `onnx-community/KittenTTS-Mini-v0.8-ONNX` are CPU/WASM-only because their int8 ops are not supported by ORT WebGPU.
- Node is intentionally CPU-only in the current runtime layer because the prior CoreML path underperformed and was removed.

Runtime diagnostics:

- Run `npm run diagnose:node-runtime -- --runtime cpu --json` to see requested runtime, actual runtime, and execution providers on your machine.
- Run `npm run diagnose:node-runtime -- --models KittenML/kitten-tts-nano-0.8-int8,KittenML/kitten-tts-mini-0.8 --runtimes auto,cpu --no-generate --json` to sweep a small Node runtime matrix.

Support matrix:

| Environment | Runtime | Supported models |
|-------------|---------|------------------|
| Browser | CPU / WASM | Nano ONNX, Micro ONNX, Mini ONNX |
| Browser | GPU / WebGPU | Nano ONNX only |
| Node.js | CPU | KittenML models |

### Browser (inline)

```html
<script type="module">
  import { KittenTTS } from 'https://esm.sh/kitten-tts-js';

  const tts = await KittenTTS.from_pretrained('KittenML/kitten-tts-nano-0.8-int8');
  const audio = await tts.generate('Hello!', { voice: 'Luna' });

  const audioCtx = new AudioContext();
  const source = audioCtx.createBufferSource();
  source.buffer = audio.toAudioBuffer(audioCtx);
  source.connect(audioCtx.destination);
  source.start();
</script>
```

### Browser Interface (local UI)

Run the built-in web interface locally:

```bash
npm run browser
```

Then open:

```text
http://localhost:4173
```

If port `4173` is already occupied, the command now exits with an explicit error instead of silently picking a different port.

This serves [`docs/index.html`](./docs/index.html), where you can type text, pick voice/model, and generate speech directly in the browser.

The repo also includes [`docs/slides.html`](./docs/slides.html), a slides-plus-assistant lab that pairs a presentation stage with a walkie-talkie copresenter. It uses **KittenTTS** for speech output and **browser STT** for input. Under **Options → Copresenter** you can choose **Ollama (local)** — faster, small models like `qwen3.5:2b` or `llama3.2:1b` via [`slides-ollama.js`](./src/slides-ollama-assistant.ts) — or **Browser (HF)** — [Transformers.js](https://huggingface.co/docs/transformers.js) + quantized ONNX from Hugging Face (`slides-web-llm.js`, jsDelivr), no server. On `localhost`, the default backend is **Ollama**; elsewhere it defaults to **browser** (override with `?llm=ollama` or saved choice). Ollama enables native slide **tools** (highlights, `go_to_slide`, etc.). Press **Space** to talk, **Space** again to interrupt, **Esc** to exit.

Build the static assets, then serve `docs/` (port **3000**, with `/slides` → `slides.html` from [`docs/serve.json`](./docs/serve.json)):

```bash
npm run build:pages
npm run serve:docs
```

Open `http://localhost:3000/slides` or `http://localhost:3000/slides.html`. One-shot rebuild + serve: `npm run dev`.

If `npm install` fails (for example behind a restrictive registry), run `npm run install:retry` (retries against [npmmirror](https://npmmirror.com/)) or `npm run install:mirror`.

### Browser (Web Worker — recommended for production)

Running inference in a Worker keeps the UI thread responsive during the ~5–10 s model load and synthesis.

**`worker.js`**
```js
import { KittenTTS } from 'https://esm.sh/kitten-tts-js';
let tts;

self.onmessage = async ({ data }) => {
  if (data.type === 'load') {
    tts = await KittenTTS.from_pretrained(data.modelId);
    self.postMessage({ type: 'ready' });
  }
  if (data.type === 'generate') {
    const audio = await tts.generate(data.text, data.opts);
    const buf = new Float32Array(audio.data);
    self.postMessage({ type: 'audio', buf, sampleRate: audio.sampling_rate }, [buf.buffer]);
  }
};
```

**`main.js`**
```js
const worker = new Worker('./worker.js', { type: 'module' });
worker.postMessage({ type: 'load', modelId: 'KittenML/kitten-tts-nano-0.8-int8' });

worker.onmessage = ({ data }) => {
  if (data.type === 'ready') console.log('Model loaded!');
  if (data.type === 'audio') playFloat32(data.buf, data.sampleRate);
};

worker.postMessage({ type: 'generate', text: 'Hello world!', opts: { voice: 'Bruno' } });

function playFloat32(buf, sampleRate) {
  const audioCtx = new AudioContext({ sampleRate });
  const ab = audioCtx.createBuffer(1, buf.length, sampleRate);
  ab.copyToChannel(buf, 0);
  const src = audioCtx.createBufferSource();
  src.buffer = ab;
  src.connect(audioCtx.destination);
  src.start();
}
```

### Streaming (sentence-by-sentence)

```js
let i = 0;
for await (const { text, audio } of tts.stream(longText, { voice: 'Bruno' })) {
  console.log(`Chunk: "${text}" → ${audio.duration.toFixed(1)}s`);
  await audio.save(`chunk-${i++}.wav`);
}
```

---

## API

### `KittenTTS.from_pretrained(modelId?, opts?)`

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `modelId` | `string` | `'KittenML/kitten-tts-nano-0.8-int8'` | HuggingFace repo ID |
| `opts.cacheDir` | `string` | `~/.cache/kitten-tts` | Override cache dir (Node) |
| `opts.runtime` | `string` | `'auto'` | Runtime mode: Node `auto/cpu`, browser `auto/cpu/gpu` (`wasm` accepted as legacy `cpu`) |
| `opts.numThreads` | `number` | auto | Node intra-op threads |
| `opts.wasmThreads` | `number` | auto | Browser WASM threads |
| `opts.wasmSimd` | `boolean` | `true` | Browser WASM SIMD toggle |

### `tts.generate(text, opts?)`

Returns `Promise<RawAudio>`.

| Opt | Default | Description |
|-----|---------|-------------|
| `voice` | `'Leo'` | Voice name (see table below) |
| `speed` | `1.0` | Speed multiplier (0.5–2.0) |
| `clean` | `true` | Run text preprocessor (numbers, currency, etc.) |

### `tts.stream(text, opts?)`

Returns `AsyncGenerator<{ text: string, audio: RawAudio }>` — one chunk per sentence.

### `tts.list_voices()`

Returns `string[]` of available friendly voice names.

### `tts.release()`

Releases the underlying ONNX session to free WebAssembly memory. Useful when switching models in the browser.

### `RawAudio`

| Member | Description |
|--------|-------------|
| `.data` | `Float32Array` — raw PCM mono |
| `.sampling_rate` | `24000` |
| `.duration` | Duration in seconds |
| `.toWav()` | `ArrayBuffer` — 16-bit PCM WAV |
| `.save(path)` | Write WAV file (Node.js) |
| `.toBlob()` | `Blob` for browser download/playback |
| `.toAudioBuffer(ctx)` | Web Audio `AudioBuffer` |

---

## Available Models

| Model ID | Size | Speed | Quality |
|----------|------|-------|---------|
| `KittenML/kitten-tts-nano-0.8-int8` | ~24 MB | ★★★ | ★★☆ |
| `KittenML/kitten-tts-nano-0.8-fp32` | ~57 MB | ★★☆ | ★★☆ |
| `KittenML/kitten-tts-micro-0.8` | ~40 MB | ★★☆ | ★★★ |
| `KittenML/kitten-tts-mini-0.8` | ~80 MB | ★☆☆ | ★★★ |
| `onnx-community/KittenTTS-Nano-v0.8-ONNX` | ~60 MB | ★★☆ | ★★☆ |
| `onnx-community/KittenTTS-Micro-v0.8-ONNX` | ~45 MB | ★★☆ | ★★★ |
| `onnx-community/KittenTTS-Mini-v0.8-ONNX` | ~82 MB | ★☆☆ | ★★★ |

Browser runtime notes:
- `onnx-community/KittenTTS-Nano-v0.8-ONNX` supports both WebGPU and WASM.
- `onnx-community/KittenTTS-Micro-v0.8-ONNX` is WASM-only.
- `onnx-community/KittenTTS-Mini-v0.8-ONNX` is WASM-only.
- Node stays on CPU in the current runtime layer.

---

## Available Voices

| Friendly Name | Gender |
|---------------|--------|
| Bella | Female |
| Jasper | Male |
| Luna | Female |
| Bruno | Male |
| Rosie | Female |
| Hugo | Male |
| Kiki | Female |
| Leo | Male |

---

## Development

```bash
git clone https://github.com/Algiras/kitten-tts-js.git
cd kitten-tts-js
npm install
npm test              # run unit tests
npm run build:pages   # build browser bundle → docs/
```

### Benchmarks

Pre-generated benchmark reports and comparison artifacts are included below.

### Pre-generated audio permutations (no local run needed)

Reference guides and indexes:

- [kitten-node-permutations/index.json](./review-audio/kitten-node-permutations/index.json)

Benchmark reports:

- [speed-comparison.json](./review-audio/speed-comparison.json)

Kitten JS outputs:

- [js-nano-en.wav](./review-audio/js-nano-en.wav)
- [js-nano-lt.wav](./review-audio/js-nano-lt.wav)
- [js-micro-en.wav](./review-audio/js-micro-en.wav)
- [js-micro-lt.wav](./review-audio/js-micro-lt.wav)
- [js-mini-en.wav](./review-audio/js-mini-en.wav)
- [js-mini-lt.wav](./review-audio/js-mini-lt.wav)

Single-sample output:

- [kitten-tts-leo.wav](./review-audio/kitten-tts-leo.wav)

Original parity references:

- [original-kittentts-mini-en.wav](./review-audio/original-kittentts-mini-en.wav)
- [original-kittentts-mini-lt.wav](./review-audio/original-kittentts-mini-lt.wav)
- [original-example-output.wav](./review-audio/original-example-output.wav)

---

## Architecture

```text
src/
├── kitten-tts.js    Main class: from_pretrained, generate, stream
├── preprocess.js    Number/currency/time text normalization
├── text-cleaner.js  Phoneme → token IDs (IPA symbol table)
├── phonemizer.js    eSpeak-NG WASM phonemization
├── npz-loader.js    NumPy .npz binary parser
├── model-loader.js  HuggingFace Hub download + caching
├── audio.js         RawAudio class + WAV encoder
└── index.js         Public API re-exports
```

---

## License

[Apache 2.0](./LICENSE) — see [NOTICE](./NOTICE) for attribution to the original [KittenTTS](https://github.com/KittenML/KittenTTS) by KittenML / Stellon Labs.
