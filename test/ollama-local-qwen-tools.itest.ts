/**
 * Local Ollama: Qwen (or OLLAMA_LOCAL_MODEL) with `think: false` and native `tool_calls`,
 * using the same `chat()` path as slides-ollama.js.
 *
 * Opt-in (avoids CI / laptops without Ollama):
 *   OLLAMA_LOCAL_ITEST=1 npm run test:integration
 *
 * Optional env (from repo `.env` via loadRepoEnv):
 *   OLLAMA_LOCAL_URL      default http://127.0.0.1:11434
 *   OLLAMA_LOCAL_MODEL    default qwen3.5:4b
 *
 * Prereq: `ollama serve` and `ollama pull <model>` (tags must match Ollama’s listing).
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { loadRepoEnv } from './load-repo-env.js';
import type { ChatMsg } from '../src/slides-ollama-assistant.js';

loadRepoEnv();

test(
  'Local Ollama: no thinking + go_to_slide tool call (slides-ollama-assistant)',
  { timeout: 180_000 },
  async (t) => {
    if (process.env.OLLAMA_LOCAL_ITEST !== '1') {
      t.skip(
        'Set OLLAMA_LOCAL_ITEST=1 with local Ollama running and the model pulled',
      );
      return;
    }

    const base =
      process.env.OLLAMA_LOCAL_URL?.replace(/\/+$/, '') ||
      'http://127.0.0.1:11434';
    const model =
      process.env.OLLAMA_LOCAL_MODEL?.trim() || 'qwen3.5:4b';

    const { connect, disconnect, chat, getModel } = await import(
      '../src/slides-ollama-assistant.js'
    );

    let sawGoToSlide = false;

    try {
      await connect(base, model, () => {});
      assert.equal(getModel(), model);

      const messages: ChatMsg[] = [
        {
          role: 'system',
          content:
            'You are a slides copresenter with tools. When the user asks to jump to a slide, you MUST call go_to_slide once with argument slide_number (a number). After the tool returns, reply with one short sentence to the presenter. Do not call tools again in that reply.',
        },
        {
          role: 'user',
          content:
            'Use the go_to_slide tool to jump to slide 2. The slide_number argument must be 2.',
        },
      ];

      const answer = await chat({
        messages,
        think: false,
        maxTokens: 220,
        temperature: 0.1,
        onToolCall: async (call) => {
          assert.equal(call.function.name, 'go_to_slide');
          const raw = call.function.arguments;
          const obj: Record<string, unknown> =
            typeof raw === 'string'
              ? (JSON.parse(raw) as Record<string, unknown>)
              : (raw as Record<string, unknown>);
          const n = Number(obj.slide_number);
          assert.ok(Number.isFinite(n), 'go_to_slide.slide_number should be a number');
          assert.equal(n, 2, 'expected slide_number 2 for this prompt');
          sawGoToSlide = true;
          return JSON.stringify({ ok: true, slide_number: n });
        },
      });

      assert.ok(sawGoToSlide, 'expected the model to invoke go_to_slide');
      assert.ok(
        typeof answer === 'string' && answer.trim().length > 2,
        'expected a non-empty final assistant message after the tool round',
      );

      const a = answer.trim();
      assert.ok(
        !/<think>[\s\S]*?<\/think>/i.test(a),
        'final text should not contain think blocks (thinking should be off)',
      );
      assert.ok(
        !/redacted_reasoning/i.test(a),
        'final text should not contain redacted_reasoning markup',
      );
      assert.ok(!/<\|[^|]+\|>/.test(a), 'final text should not contain <|...|> special tokens');
    } finally {
      disconnect();
    }
  },
);
