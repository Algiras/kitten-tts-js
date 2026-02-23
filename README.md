# 🐱 kitten-tts-js

> JavaScript/TypeScript port of [KittenTTS](https://github.com/KittenML/KittenTTS) — ultra-lightweight neural TTS via ONNX. Works in Node.js, browser (WebAssembly), and any JS environment. Zero Python dependency.

**[Live Demo →](https://algiras.github.io/kitten-tts-js)**

> **Based on [KittenTTS](https://github.com/KittenML/KittenTTS) by [KittenML / Stellon Labs](https://github.com/KittenML)**
> — original Python library: [github.com/KittenML/KittenTTS](https://github.com/KittenML/KittenTTS)
> — original models & voices: [huggingface.co/KittenML](https://huggingface.co/KittenML)
>
> All credit for the models, architecture, and voice embeddings goes to them.
> Licensed under [Apache 2.0](./LICENSE). See [NOTICE](./NOTICE) for full attribution.

> ⚠️ **Disclaimer:** This is an **unofficial** community port made by a hobbyist who needed KittenTTS in JavaScript.
> It is **not** affiliated with, endorsed by, or supported by KittenML or Stellon Labs.
> For the official Python library and model updates please visit the links above.

---

## Features

- **Ultra-lightweight** — nano model is ~25 MB
- **Runs anywhere** — Node.js (CPU), browser (WASM/WebGPU), Cloudflare Workers
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

const tts = await KittenTTS.from_pretrained('KittenML/kitten-tts-nano-0.8');

console.log(tts.list_voices());
// → ['Bella', 'Jasper', 'Luna', 'Bruno', 'Rosie', 'Hugo', 'Kiki', 'Leo']

const audio = await tts.generate('Hello from KittenTTS!', { voice: 'Bella' });
await audio.save('output.wav');
```

### Browser

```html
<script type="module">
  import { KittenTTS } from 'https://esm.sh/kitten-tts-js';

  const tts = await KittenTTS.from_pretrained('KittenML/kitten-tts-nano-0.8');
  const audio = await tts.generate('Hello!', { voice: 'Luna' });

  const audioCtx = new AudioContext();
  const source = audioCtx.createBufferSource();
  source.buffer = audio.toAudioBuffer(audioCtx);
  source.connect(audioCtx.destination);
  source.start();
</script>
```

### Streaming (sentence-by-sentence)

```js
for await (const { text, audio } of tts.stream(longText, { voice: 'Leo' })) {
  console.log(`Chunk: "${text}" → ${audio.duration.toFixed(1)}s`);
  await audio.save(`chunk-${i++}.wav`);
}
```

---

## API

### `KittenTTS.from_pretrained(modelId?, opts?)`

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `modelId` | `string` | `'KittenML/kitten-tts-nano-0.8'` | HuggingFace repo ID |
| `opts.dtype` | `'fp32'\|'fp16'\|'q8'\|'q4'` | `'fp32'` | Precision hint |
| `opts.cacheDir` | `string` | `~/.cache/kitten-tts` | Override cache dir (Node) |

### `tts.generate(text, opts?)`

Returns `Promise<RawAudio>`.

| Opt | Default | Description |
|-----|---------|-------------|
| `voice` | `'Leo'` | Voice name |
| `speed` | `1.0` | Speed multiplier (0.5–2.0) |
| `clean` | `true` | Run text preprocessor |

### `tts.stream(text, opts?)`

Returns `AsyncGenerator<{ text: string, audio: RawAudio }>` — one chunk per sentence.

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
| `KittenML/kitten-tts-nano-0.8` | ~25 MB | ★★★ | ★★☆ |
| `KittenML/kitten-tts-micro-0.8` | ~40 MB | ★★☆ | ★★★ |
| `KittenML/kitten-tts-mini-0.8` | ~80 MB | ★☆☆ | ★★★ |

---

## Available Voices

| Friendly Name | Internal Key | Gender |
|---------------|-------------|--------|
| Bella | `expr-voice-2-f` | Female |
| Jasper | `expr-voice-2-m` | Male |
| Luna | `expr-voice-3-f` | Female |
| Bruno | `expr-voice-3-m` | Male |
| Rosie | `expr-voice-4-f` | Female |
| Hugo | `expr-voice-4-m` | Male |
| Kiki | `expr-voice-5-f` | Female |
| Leo | `expr-voice-5-m` | Male |

---

## Run the examples

```bash
npm install
node examples/node-example.mjs
# → output.wav created
```

Browser: open `examples/browser-example.html` in Chrome (via a local HTTP server, e.g. `npx serve .`).

---

## Architecture

```
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

MIT
