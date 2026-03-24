/**
 * BaseKittenTTS — shared runtime logic for all KittenTTS variants.
 *
 * The three concrete classes (KittenTTS, BrowserKittenTTS, NodeKittenTTS) differ
 * only in how they acquire an ORT session (dynamic vs static import) and which
 * phonemizer function they call. Everything else lives here.
 */

import { loadNpz, type NpzResult } from './npz-loader.ts';
import { TextCleaner, basic_english_tokenize } from './text-cleaner.ts';
import { TextPreprocessor } from './preprocess.ts';
import { RawAudio } from './audio.ts';

export const SAMPLE_RATE = 24000;
export const AUDIO_TRIM = 5000;
export const MAX_CHUNK_CHARS = 400;

export const DEFAULT_VOICE_ALIASES: Record<string, string> = {
  Bella: 'expr-voice-2-f',
  Jasper: 'expr-voice-2-m',
  Luna: 'expr-voice-3-f',
  Bruno: 'expr-voice-3-m',
  Rosie: 'expr-voice-4-f',
  Hugo: 'expr-voice-4-m',
  Kiki: 'expr-voice-5-f',
  Leo: 'expr-voice-5-m',
};
export const DEFAULT_VOICE = 'Leo';

// ─── Minimal ORT interfaces ───────────────────────────────────────────────────
// Compatible with both onnxruntime-web and onnxruntime-node.

export interface OrtTensor {
  data: Float32Array;
}

export interface OrtSession {
  run(feeds: Record<string, OrtTensor>): Promise<Record<string, OrtTensor>>;
  release?(): Promise<void>;
}

export interface OrtModule {
  InferenceSession: {
    create(model: ArrayBuffer, options?: Record<string, unknown>): Promise<OrtSession>;
  };
  Tensor: new (type: string, data: BigInt64Array | Float32Array, dims: readonly number[]) => OrtTensor;
  env: {
    wasm: {
      wasmPaths?: string;
      numThreads: number;
      simd: boolean;
    };
  };
}

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface ModelConfig {
  sample_rate?: number;
  voice_aliases?: Record<string, string>;
  speed_priors?: Record<string, number>;
}

export interface RuntimeMeta {
  runtimeActual?: string;
  executionProviders?: string[];
}

export interface GenerateOptions {
  voice?: string;
  speed?: number;
  clean?: boolean;
}

interface PreparedInputs {
  input_ids: number[];
  style: Float32Array;
  styleDim: number;
  speed: number;
}

// ─── Base class ───────────────────────────────────────────────────────────────

export abstract class BaseKittenTTS {
  protected _session: OrtSession | null;
  protected _ort: OrtModule | undefined;
  protected _voices: NpzResult;
  protected _config: ModelConfig;
  private _cleaner: TextCleaner;
  private _preprocessor: TextPreprocessor;

  readonly _runtime: string;
  readonly _executionProviders: string[];
  readonly sampleRate: number;
  readonly voiceAliases: Record<string, string>;
  readonly speedPriors: Record<string, number>;
  readonly availableVoices: string[];

  constructor(
    session: OrtSession | null,
    voices: NpzResult,
    config: ModelConfig,
    ort?: OrtModule,
    runtimeMeta: RuntimeMeta = {}
  ) {
    this._session = session;
    this._ort = ort;
    this._voices = voices;
    this._config = config;
    this._runtime = runtimeMeta.runtimeActual || 'auto';
    this._executionProviders = runtimeMeta.executionProviders || [];
    this._cleaner = new TextCleaner();
    this._preprocessor = new TextPreprocessor({ remove_punctuation: false });

    this.sampleRate = config.sample_rate || SAMPLE_RATE;
    this.voiceAliases = { ...DEFAULT_VOICE_ALIASES, ...(config.voice_aliases || {}) };
    this.speedPriors = config.speed_priors || {};
    this.availableVoices = Object.keys(this._voices);
  }

  protected abstract _phonemize(text: string): Promise<string>;

  // ─── Public API ─────────────────────────────────────────────────────────────

  list_voices(): string[] {
    return Object.keys(this.voiceAliases);
  }

  async generate(text: string, opts: GenerateOptions = {}): Promise<RawAudio> {
    const { voice = DEFAULT_VOICE, speed = 1.0, clean = true } = opts;
    const chunks = this._chunkText(text);
    const audioChunks: Float32Array[] = [];

    for (const chunk of chunks) {
      const inputs = await this._prepareInputs(chunk, voice, speed, clean);
      audioChunks.push(await this._runInference(inputs));
    }

    const combined = new Float32Array(audioChunks.reduce((n, a) => n + a.length, 0));
    let offset = 0;
    for (const chunk of audioChunks) { combined.set(chunk, offset); offset += chunk.length; }
    return new RawAudio(combined, SAMPLE_RATE);
  }

  async *stream(text: string, opts: GenerateOptions = {}): AsyncGenerator<{ text: string; audio: RawAudio }> {
    const { voice = DEFAULT_VOICE, speed = 1.0, clean = true } = opts;
    for (const chunk of this._chunkText(text)) {
      const inputs = await this._prepareInputs(chunk, voice, speed, clean);
      yield { text: chunk, audio: new RawAudio(await this._runInference(inputs), SAMPLE_RATE) };
    }
  }

  async release(): Promise<void> {
    if (this._session?.release) {
      try { await this._session.release(); }
      catch (err) { console.warn('[kitten-tts] Failed to release ONNX session:', err); }
    }
  }

  // ─── Internal helpers ────────────────────────────────────────────────────────

  _ensurePunctuation(text: string): string {
    const t = text.trim();
    if (!t) return t;
    return /[.!?,;:]$/.test(t) ? t : t + ',';
  }

  _chunkText(text: string): string[] {
    const chunks: string[] = [];
    for (const s of text.split(/[.!?]+/)) {
      const sentence = s.trim();
      if (!sentence) continue;
      if (sentence.length <= MAX_CHUNK_CHARS) {
        chunks.push(this._ensurePunctuation(sentence));
        continue;
      }
      let tempChunk = '';
      for (const word of sentence.split(/\s+/)) {
        if (tempChunk.length + word.length + 1 <= MAX_CHUNK_CHARS) {
          tempChunk += tempChunk ? ` ${word}` : word;
        } else {
          if (tempChunk) chunks.push(this._ensurePunctuation(tempChunk.trim()));
          tempChunk = word;
        }
      }
      if (tempChunk) chunks.push(this._ensurePunctuation(tempChunk.trim()));
    }
    return chunks;
  }

  private async _prepareInputs(chunk: string, voiceName: string, speed: number, clean: boolean): Promise<PreparedInputs> {
    const processedText = clean ? this._preprocessor.process(chunk) : chunk;
    let phonemes = await this._phonemize(processedText);
    phonemes = basic_english_tokenize(phonemes).join(' ');
    const tokenIds = this._cleaner.clean(phonemes);

    if (this.voiceAliases[voiceName]) voiceName = this.voiceAliases[voiceName];
    if (!this._voices[voiceName]) {
      throw new Error(`Voice '${voiceName}' not found. Available: ${this.availableVoices.join(', ')}`);
    }
    const { data: voiceData, shape: [numStyles, styleDim] } = this._voices[voiceName];
    if (this.speedPriors[voiceName]) speed *= this.speedPriors[voiceName];
    const refId = Math.min(tokenIds.length, numStyles - 1);
    const style = voiceData.slice(refId * styleDim, (refId + 1) * styleDim);

    return { input_ids: tokenIds, style, styleDim, speed };
  }

  private async _runInference({ input_ids, style, styleDim, speed }: PreparedInputs): Promise<Float32Array> {
    const ort = this._ort!;
    const seqLen = input_ids.length;

    const results = await this._session!.run({
      input_ids: new ort.Tensor('int64', BigInt64Array.from(input_ids.map(BigInt)), [1, seqLen]),
      style:     new ort.Tensor('float32', new Float32Array(style), [1, styleDim]),
      speed:     new ort.Tensor('float32', new Float32Array([speed]), [1]),
    });

    const audioData = results[Object.keys(results)[0]].data;
    return new Float32Array(audioData.slice(0, Math.max(0, audioData.length - AUDIO_TRIM)));
  }
}

export { loadNpz };
