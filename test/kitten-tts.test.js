import { strict as assert } from 'assert';
import { test } from 'node:test';
import { KittenTTS } from '../src/kitten-tts.js';

// Minimal mock instance to test pure helper methods without loading a model
const tts = new KittenTTS(null, {}, {});

test('_ensurePunctuation adds comma when no trailing punctuation', () => {
  assert.equal(tts._ensurePunctuation('hello'), 'hello,');
});

test('_ensurePunctuation preserves existing trailing punctuation', () => {
  assert.equal(tts._ensurePunctuation('hello.'), 'hello.');
  assert.equal(tts._ensurePunctuation('hello!'), 'hello!');
  assert.equal(tts._ensurePunctuation('hello?'), 'hello?');
  assert.equal(tts._ensurePunctuation('hello,'), 'hello,');
});

test('_ensurePunctuation handles empty string', () => {
  assert.equal(tts._ensurePunctuation(''), '');
});

test('_chunkText splits on sentence-ending punctuation', () => {
  const chunks = tts._chunkText('Hello world. How are you? Fine!');
  assert.ok(chunks.length >= 2, `expected multiple chunks, got ${chunks.length}: ${JSON.stringify(chunks)}`);
});

test('_chunkText each chunk ends with punctuation', () => {
  const chunks = tts._chunkText('Hello world. How are you?');
  const valid = ['.', '!', '?', ',', ';', ':'];
  for (const chunk of chunks) {
    const last = chunk[chunk.length - 1];
    assert.ok(valid.includes(last), `chunk "${chunk}" should end with punctuation, ends with "${last}"`);
  }
});

test('_chunkText returns empty array for blank input', () => {
  assert.deepEqual(tts._chunkText(''), []);
  assert.deepEqual(tts._chunkText('   '), []);
});

test('_chunkText handles single sentence without delimiter', () => {
  const chunks = tts._chunkText('Just a sentence');
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0], 'Just a sentence,');
});
