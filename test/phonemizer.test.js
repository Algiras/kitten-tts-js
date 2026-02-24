import { strict as assert } from 'assert';
import { test } from 'node:test';
import { phonemize } from '../src/phonemizer.js';

test('phonemize returns non-empty IPA for a simple word', async () => {
  const result = await phonemize('hello');
  assert.ok(result.length > 0, `expected IPA output, got: "${result}"`);
});

test('phonemize passes punctuation through unchanged', async () => {
  const result = await phonemize('hello, world');
  assert.ok(result.includes(','), `comma should be preserved, got: "${result}"`);
});

test('phonemize handles a full sentence', async () => {
  const result = await phonemize('The quick brown fox.');
  assert.ok(result.length > 0, `expected output, got: "${result}"`);
});

test('phonemize handles empty string', async () => {
  const result = await phonemize('');
  assert.equal(result, '');
});
