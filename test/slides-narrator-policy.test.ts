import { strict as assert } from 'assert';
import { test } from 'node:test';
import {
  evaluateInterimHardInterrupt,
  NARRATOR_INTERRUPT_PRESETS,
  resolveNarratorPreset,
  shouldStartTurnFromFinal,
  transcriptMetrics,
} from '../src/slides-narrator-policy.js';

const balanced = NARRATOR_INTERRUPT_PRESETS.balanced;
const conservative = NARRATOR_INTERRUPT_PRESETS.conservative;
const demo = NARRATOR_INTERRUPT_PRESETS.demo;

test('resolveNarratorPreset defaults unknown keys to balanced', () => {
  assert.equal(resolveNarratorPreset('nope').id, 'balanced');
  assert.equal(resolveNarratorPreset('demo').id, 'demo');
});

test('transcriptMetrics strips fillers for word count', () => {
  const m = transcriptMetrics('um hello there', balanced);
  assert.equal(m.wordCount, 2);
  assert.ok(m.charCount >= 10);
});

test('evaluateInterimHardInterrupt balanced requires 2 words or long single token', () => {
  assert.equal(evaluateInterimHardInterrupt('hi', balanced), false);
  assert.equal(evaluateInterimHardInterrupt('hello you', balanced), true);
  assert.equal(evaluateInterimHardInterrupt('stop', balanced), false);
  assert.equal(evaluateInterimHardInterrupt('interruption', balanced), true);
});

test('evaluateInterimHardInterrupt conservative is stricter', () => {
  assert.equal(evaluateInterimHardInterrupt('hello you', conservative), false);
  assert.equal(evaluateInterimHardInterrupt('one two three', conservative), true);
});

test('evaluateInterimHardInterrupt demo allows shorter single-word barge-in', () => {
  assert.equal(evaluateInterimHardInterrupt('stop', demo), true);
});

test('shouldStartTurnFromFinal allows allowlisted shorts', () => {
  assert.equal(shouldStartTurnFromFinal('ok', conservative), true);
  assert.equal(shouldStartTurnFromFinal('a', conservative), false);
});
