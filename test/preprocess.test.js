import { strict as assert } from 'assert';
import { test } from 'node:test';
import { TextPreprocessor } from '../src/preprocess.js';

const p = new TextPreprocessor({ lowercase: false });

test('expands integers', () => {
  assert.equal(p.process('I have 3 cats'), 'I have three cats');
});

test('expands large numbers', () => {
  assert.ok(p.process('1000').includes('thousand'));
});

test('expands currency', () => {
  const out = p.process('$5');
  assert.ok(out.includes('five') && out.includes('dollar'), `got: ${out}`);
});

test('expands percentages', () => {
  const out = p.process('50%');
  assert.ok(out.includes('fifty') && out.includes('percent'), `got: ${out}`);
});

test('expands ordinals', () => {
  const out = p.process('1st place');
  assert.ok(out.includes('first'), `got: ${out}`);
});

test('removes HTML tags', () => {
  assert.equal(p.process('<b>hello</b>').trim(), 'hello');
});

test('removes URLs', () => {
  const out = p.process('visit https://example.com today');
  assert.ok(!out.includes('http'), `got: ${out}`);
});

test('normalizes whitespace', () => {
  assert.equal(p.process('hello   world'), 'hello world');
});
