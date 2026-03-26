/**
 * Hits Ollama Cloud (or OLLAMA_API_BASE_URL) with the same TS adapter as slides-ollama.js.
 * Put `OLLAMA_API_KEY=...` in repo-root `.env`, then: npm run test:integration
 *
 * Local Qwen + tool calling (opt-in): see `ollama-local-qwen-tools.itest.ts` and `OLLAMA_LOCAL_ITEST=1`.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { loadRepoEnv } from './load-repo-env.js';

loadRepoEnv();

test('Ollama Cloud reachable with Bearer key (slides-ollama-assistant.ts)', async (t) => {
  const key = process.env.OLLAMA_API_KEY?.trim();
  if (!key) {
    t.skip('Add OLLAMA_API_KEY to .env to run this integration test');
    return;
  }

  const {
    connect,
    disconnect,
    setOllamaRequestHeaders,
    getBaseUrl,
    isConnected,
  } = await import('../src/slides-ollama-assistant.js');

  setOllamaRequestHeaders({ Authorization: `Bearer ${key}` });
  const base =
    process.env.OLLAMA_API_BASE_URL?.replace(/\/+$/, '') || 'https://ollama.com';
  const model = process.env.OLLAMA_CLOUD_MODEL?.trim() || undefined;

  try {
    const { models } = await connect(base, model, () => {});
    assert.ok(Array.isArray(models));
    assert.ok(models.length > 0, 'expected at least one model from /api/tags');
    assert.equal(getBaseUrl(), base);
    assert.equal(isConnected(), true);
  } finally {
    disconnect();
    setOllamaRequestHeaders({});
  }
});
