import { strict as assert } from 'assert';
import { test } from 'node:test';
import { KittenTTS } from '../src/index.node.ts';

test('node runtime keeps js phonemizer flow', async () => {
  const tts = await KittenTTS.from_pretrained('KittenML/kitten-tts-nano-0.8');
  assert.equal(tts.runtimeRequested, 'auto');
  assert.equal(tts.runtime, 'cpu');
  assert.deepEqual(tts.executionProviders, ['cpu']);
});

test('node runtime accepts explicit cpu mode', async () => {
  const tts = await KittenTTS.from_pretrained('KittenML/kitten-tts-nano-0.8', { runtime: 'cpu' });
  assert.equal(tts.runtimeRequested, 'cpu');
  assert.equal(tts.runtime, 'cpu');
  assert.deepEqual(tts.executionProviders, ['cpu']);
});

test('node runtime rejects removed coreml mode clearly', async () => {
  await assert.rejects(
    () => KittenTTS.from_pretrained('KittenML/kitten-tts-nano-0.8', { runtime: 'coreml' as 'cpu' }),
    /Unsupported runtime mode/
  );
});

test('node runtime rejects removed mlx alias clearly', async () => {
  await assert.rejects(
    () => KittenTTS.from_pretrained('KittenML/kitten-tts-nano-0.8', { runtime: 'mlx' as 'cpu' }),
    /Unsupported runtime mode/
  );
});

test('node runtime rejects removed gpu mode clearly', async () => {
  await assert.rejects(
    () => KittenTTS.from_pretrained('KittenML/kitten-tts-nano-0.8', { runtime: 'gpu' as 'cpu' }),
    /Unsupported runtime mode/
  );
});

test('legacy rust phonemizer option fails clearly', async () => {
  await assert.rejects(
    () => KittenTTS.from_pretrained('KittenML/kitten-tts-nano-0.8', { phonemizer: 'rust' }),
    /Rust phonemizer support has been removed/
  );
});

test('invalid runtime mode fails clearly', async () => {
  await assert.rejects(
    () => KittenTTS.from_pretrained('KittenML/kitten-tts-nano-0.8', { runtime: 'wat' as 'cpu' }),
    /Unsupported runtime mode/
  );
});

test('node execution provider override rejects non-cpu providers', async () => {
  await assert.rejects(
    () => KittenTTS.from_pretrained('KittenML/kitten-tts-nano-0.8', { nodeExecutionProviders: ['coreml'] }),
    /Unsupported Node execution provider override/
  );
});
