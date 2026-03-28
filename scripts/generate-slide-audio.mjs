/**
 * Pre-generate narration audio for every slide in the deck.
 * Output: docs/audio/slide-{0..N}.wav
 *
 * Run: node --experimental-strip-types scripts/generate-slide-audio.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { KittenTTS } from '../src/index.node.ts';
import { deck } from '../src/slides-deck-data.ts';

const MODEL_ID = 'KittenML/kitten-tts-nano-0.8';
const VOICE = 'Jasper';
const SPEED = 1.0;

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(root, 'docs', 'audio');

function buildNarrationText(slide) {
  if (slide.presenterScript) return slide.presenterScript;
  const parts = [
    `Slide: ${slide.title}.`,
    slide.lede || '',
    slide.notes ? `Speaker notes: ${slide.notes}` : '',
  ].filter(Boolean);
  return parts.join('\n\n');
}

async function main() {
  await mkdir(outDir, { recursive: true });

  console.log(`Loading model ${MODEL_ID}…`);
  const tts = await KittenTTS.from_pretrained(MODEL_ID);

  for (let i = 0; i < deck.length; i++) {
    const text = buildNarrationText(deck[i]);
    if (!text.trim()) {
      console.log(`  [${i}/${deck.length}] "${deck[i].title}" — skipped (no text)`);
      continue;
    }
    console.log(`  [${i + 1}/${deck.length}] "${deck[i].title}" (${text.length} chars)…`);
    const audio = await tts.generate(text, { voice: VOICE, speed: SPEED });
    const outPath = join(outDir, `slide-${i}.wav`);
    await audio.save(outPath);
    console.log(`    → ${outPath}`);
  }

  await tts.release();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
