import { strict as assert } from 'assert';
import { test } from 'node:test';
import {
  extractToolCallDeltasFromStreamChunk,
  listReadyToolCallsFromSlots,
  mergeOllamaToolDeltas,
  normalizeOllamaToolCallDeltas,
} from '../src/slides-ollama-assistant.js';

test('normalizeOllamaToolCallDeltas handles single object', () => {
  const one = { function: { name: 'fireworks', arguments: {} } };
  const out = normalizeOllamaToolCallDeltas(one);
  assert.equal(out.length, 1);
  assert.equal(out[0].function?.name, 'fireworks');
});

test('extractToolCallDeltasFromStreamChunk reads message.tool_calls', () => {
  const parsed = {
    model: 'x',
    message: {
      role: 'assistant',
      tool_calls: [{ function: { name: 'go_to_slide', arguments: { slide_number: 2 } } }],
    },
    done: false,
  };
  const d = extractToolCallDeltasFromStreamChunk(parsed);
  assert.equal(d.length, 1);
  assert.equal(d[0].function?.name, 'go_to_slide');
});

test('extractToolCallDeltasFromStreamChunk falls back to top-level tool_calls', () => {
  const parsed = {
    tool_calls: [{ index: 1, function: { name: 'fireworks', arguments: '{}' } }],
    done: true,
  };
  const d = extractToolCallDeltasFromStreamChunk(parsed);
  assert.equal(d.length, 1);
  assert.equal(d[0].index, 1);
});

test('merge uses function.index when top-level index missing', () => {
  const slots = new Map<number, { name: string; argsStr: string }>();
  mergeOllamaToolDeltas(slots, [
    { function: { index: 2, name: 'highlight_text', arguments: { text: 'latency' } } },
  ]);
  const ready = listReadyToolCallsFromSlots(slots);
  assert.equal(ready.length, 1);
  assert.equal(ready[0].function.name, 'highlight_text');
  assert.equal(ready[0].function.arguments.text, 'latency');
});

test('merge concatenates string arguments (OpenAI-style stream fragments)', () => {
  const slots = new Map<number, { name: string; argsStr: string }>();
  mergeOllamaToolDeltas(slots, [
    { index: 0, function: { name: 'go_to_slide', arguments: '{"slide_nu' } },
    { index: 0, function: { name: 'go_to_slide', arguments: 'mber":3}' } },
  ]);
  const ready = listReadyToolCallsFromSlots(slots);
  assert.equal(ready.length, 1);
  assert.equal(ready[0].function.arguments.slide_number, 3);
});

test('merge applies name-only then arguments-only deltas', () => {
  const slots = new Map<number, { name: string; argsStr: string }>();
  mergeOllamaToolDeltas(slots, [{ index: 0, function: { name: 'diagram_live_stack' } }]);
  mergeOllamaToolDeltas(slots, [{ index: 0, function: { arguments: {} } }]);
  const ready = listReadyToolCallsFromSlots(slots);
  assert.equal(ready.length, 1);
  assert.equal(ready[0].function.name, 'diagram_live_stack');
  assert.deepEqual(ready[0].function.arguments, {});
});
