/**
 * Synthesize a fixed eval clip with kitten-tts-js (Node) for cross-check vs upstream Python.
 * Output: artifacts/tts-eval/js.wav
 *
 * Run: node --experimental-strip-types scripts/tts-eval-synthesize-js.mjs
 */
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { KittenTTS } from '../src/index.node.ts';

const MODEL_ID = 'KittenML/kitten-tts-nano-0.8';
const TEXT = 'This high-quality TTS model runs without a GPU.';
const VOICE = 'Jasper';
const SPEED = 1.0;
const CLEAN = false;

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, 'artifacts', 'tts-eval');
const outPath = join(outDir, 'js.wav');

async function main() {
  await mkdir(outDir, { recursive: true });
  const tts = await KittenTTS.from_pretrained(MODEL_ID);
  const audio = await tts.generate(TEXT, { voice: VOICE, speed: SPEED, clean: CLEAN });
  await audio.save(outPath);
  await tts.release();
  console.log('[tts-eval] JS:', { MODEL_ID, TEXT, VOICE, SPEED, CLEAN, outPath });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
