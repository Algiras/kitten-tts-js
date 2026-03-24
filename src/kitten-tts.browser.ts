import { downloadModel } from './model-loader.ts';
import { loadNpz, type NpzResult } from './npz-loader.ts';
import { TextCleaner, basic_english_tokenize } from './text-cleaner.ts';
import { TextPreprocessor } from './preprocess.ts';
import { phonemize } from './phonemizer.ts';
import { RawAudio } from './audio.ts';
import * as ort from 'onnxruntime-web';

const SAMPLE_RATE = 24000;
const AUDIO_TRIM = 5000;
const MAX_CHUNK_CHARS = 400;

const DEFAULT_VOICE_ALIASES: Record<string, string> = {
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

interface ModelConfig {
  sample_rate?: number;
  voice_aliases?: Record<string, string>;
  speed_priors?: Record<string, number>;
}

interface BrowserSessionMeta {
  runtimeRequested?: string;
  runtimeActual?: string;
  executionProviders?: string[];
  fallbackError?: Error | null;
}

export interface BrowserFromPretrainedOptions {
  dtype?: string;
  cacheDir?: string;
  runtime?: 'auto' | 'cpu' | 'gpu' | 'wasm';
  wasmThreads?: number;
  wasmSimd?: boolean;
  browserExecutionProviders?: Array<'wasm' | 'webgpu'>;
}

interface PreparedInputs {
  input_ids: number[];
  style: Float32Array;
  styleDim: number;
  speed: number;
}

function resolveBrowserWasmThreads(opts: BrowserFromPretrainedOptions = {}): number {
  if (Number.isInteger(opts.wasmThreads) && opts.wasmThreads! > 0) return opts.wasmThreads!;
  // SharedArrayBuffer (required for WASM threads) is only available when the page
  // is cross-origin isolated (COOP + COEP headers). Without it, ORT's pthread_create
  // will fail with a cryptic error. Fall back to single-threaded execution.
  if (typeof crossOriginIsolated !== 'undefined' && !crossOriginIsolated) return 1;
  if (typeof navigator !== 'undefined' && Number.isInteger(navigator.hardwareConcurrency) && navigator.hardwareConcurrency > 0) {
    return Math.min(navigator.hardwareConcurrency, 8);
  }
  return 4;
}

function resolveBrowserExecutionProviders(runtime = 'auto', opts: BrowserFromPretrainedOptions = {}): string[] {
  if (Array.isArray(opts.browserExecutionProviders) && opts.browserExecutionProviders.length > 0) {
    return opts.browserExecutionProviders;
  }
  if (runtime === 'gpu') return ['webgpu'];
  if (runtime === 'cpu' || runtime === 'wasm' || runtime === 'auto') return ['wasm'];
  return ['wasm'];
}

async function createBrowserSession(
  modelBuffer: ArrayBuffer,
  runtimeRequested: string,
  opts: BrowserFromPretrainedOptions
): Promise<{ session: ort.InferenceSession; runtimeActual: 'cpu' | 'gpu'; executionProviders: string[]; fallbackError?: Error }> {
  const executionProviders = resolveBrowserExecutionProviders(runtimeRequested, opts);
  try {
    const session = await ort.InferenceSession.create(modelBuffer, { executionProviders });
    return {
      session,
      runtimeActual: executionProviders.includes('webgpu') ? 'gpu' : 'cpu',
      executionProviders,
    };
  } catch (error) {
    if (runtimeRequested === 'auto') {
      const fallbackProviders = ['wasm'];
      const session = await ort.InferenceSession.create(modelBuffer, { executionProviders: fallbackProviders });
      return {
        session,
        runtimeActual: 'cpu',
        executionProviders: fallbackProviders,
        fallbackError: error as Error,
      };
    }
    throw error;
  }
}

export class BrowserKittenTTS {
  private _session: ort.InferenceSession;
  private _voices: NpzResult;
  private _config: ModelConfig;
  private _fallbackError: Error | null;
  readonly _runtimeRequested: string;
  readonly _runtime: string;
  readonly _executionProviders: string[];
  private _cleaner: TextCleaner;
  private _preprocessor: TextPreprocessor;

  readonly runtimeRequested: string;
  readonly runtime: string;
  readonly executionProviders: string[];
  readonly sampleRate: number;
  readonly voiceAliases: Record<string, string>;
  readonly speedPriors: Record<string, number>;
  readonly availableVoices: string[];

  constructor(session: ort.InferenceSession, voices: NpzResult, config: ModelConfig, meta: BrowserSessionMeta = {}) {
    this._session = session;
    this._voices = voices;
    this._config = config;
    this._runtimeRequested = meta.runtimeRequested || 'auto';
    this._runtime = meta.runtimeActual || 'cpu';
    this._executionProviders = meta.executionProviders || ['wasm'];
    this._fallbackError = meta.fallbackError || null;
    this._cleaner = new TextCleaner();
    this._preprocessor = new TextPreprocessor({ remove_punctuation: false });
    this.runtimeRequested = this._runtimeRequested;
    this.runtime = this._runtime;
    this.executionProviders = this._executionProviders;
    this.sampleRate = config.sample_rate || SAMPLE_RATE;
    this.voiceAliases = { ...DEFAULT_VOICE_ALIASES, ...(config.voice_aliases || {}) };
    this.speedPriors = config.speed_priors || {};
    this.availableVoices = Object.keys(this._voices);
  }

  static async from_pretrained(
    modelId = 'KittenML/kitten-tts-nano-0.8',
    opts: BrowserFromPretrainedOptions = {}
  ): Promise<BrowserKittenTTS> {
    if (opts.runtime && !['auto', 'cpu', 'gpu', 'wasm'].includes(opts.runtime)) {
      throw new Error(`Unsupported runtime mode: ${opts.runtime}`);
    }

    const { modelBuffer, voicesBuffer, config } = await downloadModel(modelId, opts as unknown as Record<string, unknown>);
    if (!ort.env.wasm.wasmPaths) {
      // Use location.href (reliable in both main thread and workers) rather than
      // import.meta.url, which Rolldown may replace with a data URL in lib mode.
      const base = (typeof globalThis.location !== 'undefined' && globalThis.location?.href)
        ? new URL('.', globalThis.location.href).href
        : 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.2/dist/';
      ort.env.wasm.wasmPaths = base;
    }
    ort.env.wasm.numThreads = resolveBrowserWasmThreads(opts);
    ort.env.wasm.simd = opts.wasmSimd !== false;

    const runtimeRequested = opts.runtime || 'auto';
    const { session, runtimeActual, executionProviders, fallbackError } = await createBrowserSession(modelBuffer, runtimeRequested, opts);
    const voices = await loadNpz(voicesBuffer);

    if (fallbackError) {
      console.warn(`[kitten-tts] Requested browser runtime "${runtimeRequested}" failed; using WASM fallback.`, fallbackError?.message || fallbackError);
    }

    return new BrowserKittenTTS(session, voices, config as ModelConfig, {
      runtimeRequested,
      runtimeActual,
      executionProviders,
      fallbackError,
    });
  }

  list_voices(): string[] {
    return Object.keys(this.voiceAliases);
  }

  async generate(text: string, opts: { voice?: string; speed?: number; clean?: boolean } = {}): Promise<RawAudio> {
    const { voice = DEFAULT_VOICE, speed = 1.0, clean = false } = opts;
    const chunks = this._chunkText(text);
    const audioChunks: Float32Array[] = [];
    for (const chunk of chunks) {
      const inputs = await this._prepareInputs(chunk, voice, speed, clean);
      const chunkAudio = await this._runInference(inputs);
      audioChunks.push(chunkAudio);
    }
    const totalLen = audioChunks.reduce((s, a) => s + a.length, 0);
    const combined = new Float32Array(totalLen);
    let offset = 0;
    for (const chunk of audioChunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    return new RawAudio(combined, SAMPLE_RATE);
  }

  async *stream(text: string, opts: { voice?: string; speed?: number; clean?: boolean } = {}): AsyncGenerator<{ text: string; audio: RawAudio }> {
    const { voice = DEFAULT_VOICE, speed = 1.0, clean = false } = opts;
    const chunks = this._chunkText(text);
    for (const chunk of chunks) {
      const inputs = await this._prepareInputs(chunk, voice, speed, clean);
      const chunkAudio = await this._runInference(inputs);
      yield { text: chunk, audio: new RawAudio(chunkAudio, SAMPLE_RATE) };
    }
  }

  async release(): Promise<void> {
    if (this._session && typeof this._session.release === 'function') {
      await this._session.release();
    }
  }

  private _ensurePunctuation(text: string): string {
    let t = text.trim();
    if (!t) return t;
    const last = t[t.length - 1];
    if (!['.', '!', '?', ',', ';', ':'].includes(last)) t += ',';
    return t;
  }

  private _chunkText(text: string): string[] {
    const sentences = text.split(/[.!?]+/);
    const chunks: string[] = [];
    for (const s of sentences) {
      const sentence = s.trim();
      if (!sentence) continue;
      if (sentence.length <= MAX_CHUNK_CHARS) {
        chunks.push(this._ensurePunctuation(sentence));
      } else {
        const words = sentence.split(/\s+/);
        let tempChunk = '';
        for (const word of words) {
          if (tempChunk.length + word.length + 1 <= MAX_CHUNK_CHARS) {
            tempChunk += tempChunk ? ` ${word}` : word;
          } else {
            if (tempChunk) chunks.push(this._ensurePunctuation(tempChunk.trim()));
            tempChunk = word;
          }
        }
        if (tempChunk) chunks.push(this._ensurePunctuation(tempChunk.trim()));
      }
    }
    return chunks;
  }

  private async _prepareInputs(chunk: string, voiceName: string, speed: number, clean: boolean): Promise<PreparedInputs> {
    const processedText = clean ? this._preprocessor.process(chunk) : chunk;
    let phonemes = await phonemize(processedText);
    phonemes = basic_english_tokenize(phonemes).join(' ');
    const tokenIds = this._cleaner.clean(phonemes);
    if (this.voiceAliases[voiceName]) voiceName = this.voiceAliases[voiceName];
    if (!this._voices[voiceName]) {
      throw new Error(`Voice '${voiceName}' not found. Available: ${this.availableVoices.join(', ')}`);
    }
    const voiceEntry = this._voices[voiceName];
    const voiceData = voiceEntry.data;
    const [numStyles, styleDim] = voiceEntry.shape;
    if (this.speedPriors[voiceName]) speed = speed * this.speedPriors[voiceName];
    const refId = Math.min(chunk.length, numStyles - 1);
    const style = voiceData.slice(refId * styleDim, (refId + 1) * styleDim);
    return { input_ids: tokenIds, style, styleDim, speed };
  }

  private async _runInference({ input_ids, style, styleDim, speed }: PreparedInputs): Promise<Float32Array> {
    const seqLen = input_ids.length;
    const inputIdsTensor = new ort.Tensor('int64', BigInt64Array.from(input_ids.map(BigInt)), [1, seqLen]);
    const styleTensor = new ort.Tensor('float32', new Float32Array(style), [1, styleDim]);
    const speedTensor = new ort.Tensor('float32', new Float32Array([speed]), [1]);
    const results = await this._session.run({
      input_ids: inputIdsTensor,
      style: styleTensor,
      speed: speedTensor,
    });
    const outputKey = Object.keys(results)[0];
    const audioData = results[outputKey].data as Float32Array;
    const trimmed = audioData.slice(0, Math.max(0, audioData.length - AUDIO_TRIM));
    return new Float32Array(trimmed);
  }
}
