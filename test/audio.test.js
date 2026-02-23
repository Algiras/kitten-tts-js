import { strict as assert } from 'assert';
import { test } from 'node:test';
import { RawAudio, encodeWav } from '../src/audio.js';

test('encodeWav produces a valid RIFF header', () => {
  const samples = new Float32Array([0, 0.5, -0.5, 1.0, -1.0]);
  const buf = encodeWav(samples, 24000);
  const bytes = new Uint8Array(buf);
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const wave = String.fromCharCode(...bytes.slice(8, 12));
  assert.equal(riff, 'RIFF');
  assert.equal(wave, 'WAVE');
});

test('encodeWav output size = 44 + samples*2', () => {
  const samples = new Float32Array(100);
  const buf = encodeWav(samples, 24000);
  assert.equal(buf.byteLength, 44 + 100 * 2);
});

test('RawAudio.duration is correct', () => {
  const audio = new RawAudio(new Float32Array(24000), 24000);
  assert.equal(audio.duration, 1.0);
});

test('RawAudio.toWav returns valid WAV', () => {
  const audio = new RawAudio(new Float32Array(10), 24000);
  const wav = audio.toWav();
  assert.ok(wav.byteLength > 44);
});

test('RawAudio.toBlob returns a Blob', () => {
  const audio = new RawAudio(new Float32Array(10), 24000);
  const blob = audio.toBlob();
  assert.ok(blob instanceof Blob);
  assert.equal(blob.type, 'audio/wav');
});
