/**
 * Node.js example — run with:
 *   node examples/node-example.mjs
 *
 * Requires: npm install (from project root)
 * Output: output.wav in current directory
 */

import { KittenTTS } from '../src/index.js';

async function main() {
  console.log('Loading KittenTTS model…');
  const tts = await KittenTTS.from_pretrained('KittenML/kitten-tts-nano-0.8');

  console.log('Available voices:', tts.list_voices());

  // Simple generation
  console.log('\n[1] Generating with voice Bella…');
  const audio = await tts.generate('Hello from KittenTTS! This is a JavaScript port of the ultra-lightweight TTS library.', {
    voice: 'Bella',
    speed: 1.0,
  });
  await audio.save('output.wav');
  console.log(`  Duration: ${audio.duration.toFixed(2)}s`);

  // Streaming example
  console.log('\n[2] Streaming multi-sentence text with voice Leo…');
  const longText = 'The quick brown fox jumps over the lazy dog. It was the best of times, it was the worst of times. To be or not to be, that is the question.';
  let chunkIdx = 0;
  for await (const { text, audio: chunkAudio } of tts.stream(longText, { voice: 'Leo' })) {
    console.log(`  Chunk ${++chunkIdx}: "${text}" → ${chunkAudio.duration.toFixed(2)}s`);
    await chunkAudio.save(`output-chunk-${chunkIdx}.wav`);
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
