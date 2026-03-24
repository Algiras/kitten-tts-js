/**
 * kitten-tts-js — TypeScript declarations
 */

export interface ModelOptions {
  /** Quantization / precision hint. Default: 'fp32' */
  dtype?: 'fp32' | 'fp16' | 'q8' | 'q4';
  /** Override local cache directory (Node.js only). Default: ~/.cache/kitten-tts */
  cacheDir?: string;
  /** Runtime mode selector. Node: auto/cpu. Browser: auto/cpu/gpu (wasm kept as legacy cpu alias). */
  runtime?: 'auto' | 'cpu' | 'gpu' | 'wasm';
  /** Node-only explicit execution provider list override. Only 'cpu' is supported. */
  nodeExecutionProviders?: string[];
  /** Browser-only explicit execution provider list override. */
  browserExecutionProviders?: Array<'wasm' | 'webgpu'>;
  /** Node intra-op thread count, or browser WASM threads when applicable. */
  numThreads?: number;
  /** Browser-only WASM thread override. */
  wasmThreads?: number;
  /** Browser-only WASM SIMD toggle. Default: true */
  wasmSimd?: boolean;
  /** Deprecated, retained for compatibility. Only 'js' is accepted. */
  phonemizer?: 'js';
}

export interface GenerateOptions {
  /**
   * Friendly voice name (e.g. 'Bella', 'Leo') or internal key (e.g. 'expr-voice-2-f').
   * Default: 'Leo'
   */
  voice?: string;
  /** Speed multiplier. Default: 1.0 */
  speed?: number;
  /** Run text preprocessor (number/currency/time expansion). Default: true */
  clean?: boolean;
}

export interface StreamChunk {
  /** The sentence text that was synthesized. */
  text: string;
  /** The synthesized audio for this sentence. */
  audio: RawAudio;
}

export declare class RawAudio {
  /** Raw PCM samples (mono Float32). */
  readonly data: Float32Array;
  /** Sampling rate in Hz (typically 24000). */
  readonly sampling_rate: number;

  constructor(data: Float32Array, sampling_rate: number);

  /** Encode to WAV bytes (16-bit PCM, mono). */
  toWav(): ArrayBuffer;

  /** Save WAV to a file path (Node.js only). */
  save(filePath: string): Promise<void>;

  /** Create a Blob for browser download/playback. */
  toBlob(): Blob;

  /** Create a Web Audio API AudioBuffer. */
  toAudioBuffer(audioContext: AudioContext): AudioBuffer;

  /** Duration in seconds. */
  readonly duration: number;
}

export declare class KittenTTS {
  /** Requested runtime after alias normalization. */
  readonly runtimeRequested: string;
  /** Actual runtime used after backend selection. */
  readonly runtime: string;
  /** Actual ONNX execution providers in use. */
  readonly executionProviders: string[];
  /**
   * Load a KittenTTS model from HuggingFace Hub.
   *
   * @param modelId HuggingFace repo ID. Default: 'KittenML/kitten-tts-nano-0.8'
   * @param opts    Download / dtype options.
   */
  /**
  * Default modelId: 'KittenML/kitten-tts-nano-0.8-int8'
  * Also available: 'KittenML/kitten-tts-nano-0.8-fp32', 'KittenML/kitten-tts-micro-0.8', 'KittenML/kitten-tts-mini-0.8',
  * 'onnx-community/KittenTTS-Nano-v0.8-ONNX', 'onnx-community/KittenTTS-Micro-v0.8-ONNX', 'onnx-community/KittenTTS-Mini-v0.8-ONNX'
   */
  static from_pretrained(
    modelId?: string,
    opts?: ModelOptions
  ): Promise<KittenTTS>;

  /** List available friendly voice names (e.g. ['Bella', 'Leo', …]). */
  list_voices(): string[];

  /**
   * Synthesize text to audio.
   *
   * @param text  Input text (plain or with numbers/punctuation).
   * @param opts  Voice, speed, and preprocessing options.
   */
  generate(text: string, opts?: GenerateOptions): Promise<RawAudio>;

  /**
   * Stream synthesized audio sentence-by-sentence.
   *
   * @param text  Input text.
   * @param opts  Voice, speed, and preprocessing options.
   */
  stream(text: string, opts?: GenerateOptions): AsyncGenerator<StreamChunk>;
}

export declare class TextCleaner {
  /** Convert a phoneme string to padded token IDs ready for the model. */
  clean(phonemes: string): number[];
  /** Full symbol list (for debugging). */
  readonly symbols: string[];
  /** Vocabulary size. */
  readonly vocabSize: number;
}

export declare class TextPreprocessor {
  /** Normalize text: expand numbers, currency, abbreviations, URLs, etc. */
  process(text: string): string;
}

/** Phonemize text using eSpeak-NG. */
export declare function phonemize(text: string): Promise<string>;
export declare function phonemizeJs(text: string): Promise<string>;
export declare function phonemizeNode(text: string): Promise<string>;

/** Load a .npz archive into a map of Float32Array tensors. */
export declare function loadNpz(
  npzBuffer: ArrayBuffer | Buffer
): Promise<Record<string, { data: Float32Array; shape: number[] }>>;

/** Download model files from HuggingFace Hub. */
export declare function downloadModel(
  repoId: string,
  opts?: ModelOptions
): Promise<{ modelBuffer: ArrayBuffer; voicesBuffer: ArrayBuffer; config: Record<string, unknown> }>;

/** Available model IDs. */
export declare const MODELS: Record<string, { label: string }>;
