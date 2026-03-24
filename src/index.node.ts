/**
 * Node.js-specific entry point.
 * Same API as index.ts but explicit — future Node-only optimizations go here.
 */
export { NodeKittenTTS as KittenTTS } from './kitten-tts.node.ts';
export { RawAudio, encodeWav } from './audio.ts';
export { TextCleaner } from './text-cleaner.ts';
export { TextPreprocessor } from './preprocess.ts';
export { phonemizeJs as phonemize, phonemizeJs, phonemizeNode } from './phonemizer.node.ts';
export { loadNpz } from './npz-loader.ts';
export { downloadModel, MODELS } from './model-loader.ts';
