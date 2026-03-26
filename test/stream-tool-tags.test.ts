import { strict as assert } from 'assert';
import { test } from 'node:test';
import {
  extractToolsInnerBlocks,
  isKnownSlideTool,
  parseAttrString,
  parseToolsInner,
  SLIDE_TOOL_NAMES,
  SLIDE_TOOL_RUN_ORDER,
  slideToolCallSortKey,
  stableToolCallFingerprint,
  stripToolBlocksForSpeech,
} from '../src/stream-tool-tags.js';

test('stripToolBlocksForSpeech removes complete blocks', () => {
  const s = 'Hello <tools><tool name="x" /></tools> world';
  assert.equal(stripToolBlocksForSpeech(s), 'Hello  world');
});

test('stripToolBlocksForSpeech hides unclosed tools opener', () => {
  const s = 'Hi <tools><tool name="x"';
  assert.equal(stripToolBlocksForSpeech(s), 'Hi ');
});

test('extractToolsInnerBlocks preserves order', () => {
  const raw = 'a<tools>one</tools>b<tools>two</tools>';
  assert.deepEqual(extractToolsInnerBlocks(raw), ['one', 'two']);
});

test('parseAttrString handles double quotes', () => {
  assert.deepEqual(parseAttrString('name="go_to_slide" slide_number="4"'), {
    name: 'go_to_slide',
    slide_number: '4',
  });
});

test('parseToolsInner self-closing and body diagram', () => {
  const inner = `<tool name="go_to_slide" slide_number="2" />
<tool name="highlight_text" text="latency" />`;
  const calls = parseToolsInner(inner);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].function.name, 'go_to_slide');
  assert.equal(calls[0].function.arguments.slide_number, 2);
  assert.equal(calls[1].function.name, 'highlight_text');
  assert.equal(calls[1].function.arguments.text, 'latency');
});

test('parseToolsInner diagram tool self-closing', () => {
  const inner = '<tool name="diagram_live_stack" />';
  const [c] = parseToolsInner(inner);
  assert.equal(c.function.name, 'diagram_live_stack');
  assert.deepEqual(c.function.arguments, {});
});

test('isKnownSlideTool is case-insensitive', () => {
  assert.equal(isKnownSlideTool('Go_To_Slide'), true);
  assert.equal(isKnownSlideTool('SET_VOICE'), true);
  assert.equal(isKnownSlideTool('FIREWORKS'), true);
  assert.equal(isKnownSlideTool('DIAGRAM_LIVE_STACK'), true);
  assert.equal(isKnownSlideTool('show_diagram_preset'), false);
  assert.equal(isKnownSlideTool('made_up_tool'), false);
});

test('slideToolCallSortKey is case-insensitive and orders relative to show_overlay vs diagrams', () => {
  assert.equal(slideToolCallSortKey('GO_TO_SLIDE'), 0);
  assert.equal(slideToolCallSortKey('  set_voice  '), 1);
  assert.ok(slideToolCallSortKey('show_overlay') < slideToolCallSortKey('diagram_live_stack'));
  assert.equal(slideToolCallSortKey('unknown_tool_xyz'), 100);
});

test('SLIDE_TOOL_RUN_ORDER entries are exactly the known slide tool set', () => {
  const fromOrder = new Set(SLIDE_TOOL_RUN_ORDER);
  assert.equal(fromOrder.size, SLIDE_TOOL_RUN_ORDER.length, 'no duplicate tool names in run order');
  assert.equal(fromOrder.size, SLIDE_TOOL_NAMES.size);
  for (const name of SLIDE_TOOL_RUN_ORDER) {
    assert.equal(SLIDE_TOOL_NAMES.has(name), true, `${name} in run order but not in SLIDE_TOOL_NAMES`);
  }
  for (const name of SLIDE_TOOL_NAMES) {
    assert.equal(fromOrder.has(name), true, `${name} in SLIDE_TOOL_NAMES but missing from run order`);
  }
});

test('parseToolsInner recovers after unclosed tool body', () => {
  const inner = '<tool name="diagram_reinforcement_loop">no closing tag<tool name="fireworks" duration_seconds="3" />';
  const calls = parseToolsInner(inner);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].function.name, 'fireworks');
});

test('stableToolCallFingerprint ignores arg key order', () => {
  const a = stableToolCallFingerprint({
    function: { name: 'go_to_slide', arguments: { slide_number: 2, extra: 'x' } },
  });
  const b = stableToolCallFingerprint({
    function: { name: 'go_to_slide', arguments: { extra: 'x', slide_number: 2 } },
  });
  assert.equal(a, b);
});
