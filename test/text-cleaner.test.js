import { strict as assert } from 'assert';
import { test } from 'node:test';
import { TextCleaner, textToIds } from '../src/text-cleaner.js';

test('TextCleaner pads output with [0, ..., 10, 0]', () => {
  const cleaner = new TextCleaner();
  const ids = cleaner.clean('hello');
  assert.equal(ids[0], 0, 'starts with pad (0)');
  assert.equal(ids[ids.length - 1], 0, 'ends with pad (0)');
  assert.equal(ids[ids.length - 2], 10, 'second-to-last is 10');
});

test('TextCleaner produces non-empty output for ASCII text', () => {
  const cleaner = new TextCleaner();
  const ids = cleaner.clean('Hello world');
  assert.ok(ids.length > 3, 'should have tokens beyond just padding');
});

test('textToIds drops unknown characters silently', () => {
  const ids = textToIds('\x00\x01\xFF');
  assert.equal(ids.length, 0, 'unknown chars produce no tokens');
});

test('TextCleaner vocabSize is positive', () => {
  const cleaner = new TextCleaner();
  assert.ok(cleaner.vocabSize >= 188, `vocab should have at least 188 symbols, got ${cleaner.vocabSize}`);
});

test('TextCleaner symbols array starts with pad $', () => {
  const cleaner = new TextCleaner();
  assert.equal(cleaner.symbols[0], '$');
});
