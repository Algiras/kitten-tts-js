/**
 * KittenTTS — main class.
 *
 * Usage:
 *   const tts = await KittenTTS.from_pretrained('KittenML/kitten-tts-nano-0.8');
 *   const audio = await tts.generate('Hello world', { voice: 'Bella' });
 *   await audio.save('output.wav');
 */

import { downloadModel } from './model-loader.js';
import { loadNpz } from './npz-loader.js';
import { TextCleaner } from './text-cleaner.js';
import { TextPreprocessor } from './preprocess.js';
import { phonemize } from './phonemizer.js';
import { RawAudio } from './audio.js';

const SAMPLE_RATE = 24000;
const AUDIO_TRIM = 5000;  // trim last N samples from model output
const MAX_CHUNK_CHARS = 400;

/** Voice aliases: friendly name → internal NPZ key */
const DEFAULT_VOICE_ALIASES = {
  Bella: 'expr-voice-2-f',
  Jasper: 'expr-voice-2-m',
  Luna: 'expr-voice-3-f',
  Bruno: 'expr-voice-3-m',
  Rosie: 'expr-voice-4-f',
  Hugo: 'expr-voice-4-m',
  Kiki: 'expr-voice-5-f',
  Leo: 'expr-voice-5-m',
};
const DEFAULT_VOICE = 'Leo';

export class KittenTTS {
  /** @private */
  constructor(session, voices, voiceAliases, speedPriors) {
    this._session = session;     // ONNX InferenceSession
    this._voices = voices;       // { [key]: { data: Float32Array, shape: [N, dim] } }
    this._voiceAliases = voiceAliases;
    this._speedPriors = speedPriors || {};
    this._cleaner = new TextCleaner();
    this._preprocessor = new TextPreprocessor();
  }

  /**
   * Load model from HuggingFace Hub.
   *
   * @param {string} [modelId='KittenML/kitten-tts-nano-0.8']
   * @param {{ dtype?: string, cacheDir?: string }} [opts]
   * @returns {Promise<KittenTTS>}
   */
  static async from_pretrained(modelId = 'KittenML/kitten-tts-nano-0.8', opts = {}) {
    const { modelBuffer, voicesBuffer, config } = await downloadModel(modelId, opts);

    // Load ONNX runtime (Node vs browser via conditional exports)
    let ort;
    try {
      ort = await import('onnxruntime-node');
    } catch {
      ort = await import('onnxruntime-web');
      // Tell onnxruntime-web where its .wasm files live.
      // In the GitHub Pages build the files are copied next to bundle.js.
      // Fall back to the jsDelivr CDN if running from a custom origin.
      if (!ort.env.wasm.wasmPaths) {
        try {
          // Resolve relative to the current script's location
          const scriptBase = new URL('.', import.meta.url).href;
          ort.env.wasm.wasmPaths = scriptBase;
        } catch {
          ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20/dist/';
        }
      }
    }

    const session = await ort.InferenceSession.create(modelBuffer);
    const voices = await loadNpz(voicesBuffer);

    const voiceAliases = { ...DEFAULT_VOICE_ALIASES, ...(config.voice_aliases || {}) };
    const speedPriors = config.speed_priors || {};

    return new KittenTTS(session, voices, voiceAliases, speedPriors);
  }

  /**
   * List available friendly voice names.
   * @returns {string[]}
   */
  list_voices() {
    return Object.keys(this._voiceAliases);
  }

  /**
   * Generate audio for the given text.
   *
   * @param {string} text
   * @param {{ voice?: string, speed?: number, clean?: boolean }} [opts]
   * @returns {Promise<RawAudio>}
   */
  async generate(text, opts = {}) {
    const { voice = DEFAULT_VOICE, speed = 1.0, clean = true } = opts;
    const chunks = this._chunkText(text);

    const audioChunks = [];
    for (const chunk of chunks) {
      const inputs = await this._prepareInputs(chunk, voice, speed, clean);
      const chunkAudio = await this._runInference(inputs);
      audioChunks.push(chunkAudio);
    }

    // Concatenate all chunks
    const totalLen = audioChunks.reduce((s, a) => s + a.length, 0);
    const combined = new Float32Array(totalLen);
    let offset = 0;
    for (const chunk of audioChunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    return new RawAudio(combined, SAMPLE_RATE);
  }

  /**
   * Stream audio chunk-by-chunk (one per sentence).
   *
   * @param {string} text
   * @param {{ voice?: string, speed?: number, clean?: boolean }} [opts]
   * @yields {{ text: string, audio: RawAudio }}
   */
  async *stream(text, opts = {}) {
    const { voice = DEFAULT_VOICE, speed = 1.0, clean = true } = opts;
    const chunks = this._chunkText(text);

    for (const chunk of chunks) {
      const inputs = await this._prepareInputs(chunk, voice, speed, clean);
      const chunkAudio = await this._runInference(inputs);
      yield { text: chunk, audio: new RawAudio(chunkAudio, SAMPLE_RATE) };
    }
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  /**
   * Split text into sentence chunks ≤ MAX_CHUNK_CHARS.
   * @param {string} text
   * @returns {string[]}
   */
  _chunkText(text) {
    // Split on sentence boundaries
    const sentences = text.split(/(?<=[.!?])\s+/);
    const chunks = [];
    let current = '';

    for (const sentence of sentences) {
      if (current.length + sentence.length > MAX_CHUNK_CHARS && current.length > 0) {
        chunks.push(current.trim());
        current = sentence;
      } else {
        current = current ? `${current} ${sentence}` : sentence;
      }
    }
    if (current.trim()) chunks.push(current.trim());

    // Ensure each chunk ends with punctuation
    return chunks.map(c => /[.!?]$/.test(c) ? c : c + '.');
  }

  /**
   * Preprocess text, phonemize, and build ONNX input tensors.
   * @private
   */
  async _prepareInputs(chunk, voiceName, speed, clean) {
    // 1. Preprocess
    const processedText = clean ? this._preprocessor.process(chunk) : chunk;

    // 2. Phonemize
    const phonemes = await phonemize(processedText);

    // 3. Tokenize → IDs with padding
    const tokenIds = this._cleaner.clean(phonemes);

    // 4. Look up voice
    const internalKey = this._voiceAliases[voiceName] || voiceName;
    if (!this._voices[internalKey]) {
      const available = Object.keys(this._voices).join(', ');
      throw new Error(`Voice '${voiceName}' (key: '${internalKey}') not found. Available: ${available}`);
    }
    const voiceEntry = this._voices[internalKey];
    const voiceData = voiceEntry.data;
    const [numStyles, styleDim] = voiceEntry.shape;

    // ref_id = min(text_len, N-1)
    const refId = Math.min(tokenIds.length, numStyles - 1);
    const style = voiceData.slice(refId * styleDim, (refId + 1) * styleDim);

    // 5. Pass speed directly (matching Python lib behaviour; speed_priors are not applied)
    return {
      input_ids: tokenIds,
      style,
      styleDim,
      speed,
    };
  }

  /**
   * Run ONNX inference and return trimmed audio samples.
   * @private
   */
  async _runInference({ input_ids, style, styleDim, speed }) {
    let ort;
    try {
      ort = await import('onnxruntime-node');
    } catch {
      ort = await import('onnxruntime-web');
    }
    // (wasmPaths already set in from_pretrained)

    const seqLen = input_ids.length;
    const inputIdsTensor = new ort.Tensor('int64',
      BigInt64Array.from(input_ids.map(BigInt)),
      [1, seqLen]);

    const styleTensor = new ort.Tensor('float32',
      new Float32Array(style),
      [1, styleDim]);

    const speedTensor = new ort.Tensor('float32',
      new Float32Array([speed]),
      [1]);

    const feeds = {
      input_ids: inputIdsTensor,
      style: styleTensor,
      speed: speedTensor,
    };

    const results = await this._session.run(feeds);

    // Output key is usually 'audio' or first key
    const outputKey = Object.keys(results)[0];
    const audioData = results[outputKey].data; // Float32Array (flat)

    // Trim last AUDIO_TRIM samples
    const trimmed = audioData.slice(0, Math.max(0, audioData.length - AUDIO_TRIM));
    return new Float32Array(trimmed);
  }
}
