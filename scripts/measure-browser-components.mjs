import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:4173';
const TTS_TEXT = 'Hello from KittenTTS. This is a latency check.';
const TTS_MODEL = 'onnx-community/KittenTTS-Nano-v0.8-ONNX';
const TTS_RUNTIMES = ['cpu', 'gpu'];

function fmt(ms) {
  return `${ms.toFixed(0)} ms`;
}

function findEvent(events, needle) {
  return events.find((event) => event.text.includes(needle));
}

async function setupPage() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const ctx = await browser.newContext();
  await ctx.route('**/*', async (route) => {
    const response = await route.fetch();
    const headers = {
      ...response.headers(),
      'cross-origin-opener-policy': 'same-origin',
      'cross-origin-embedder-policy': 'require-corp',
    };
    await route.fulfill({ response, headers });
  });
  const page = await ctx.newPage();
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  return { browser, ctx, page };
}

async function installStatusTimeline(page) {
  await page.evaluate(() => {
    const statusEl = document.getElementById('status');
    window.__ttsTimeline = [];
    const push = () => {
      const text = String(statusEl?.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text) return;
      const prev = window.__ttsTimeline[window.__ttsTimeline.length - 1];
      if (prev?.text === text) return;
      window.__ttsTimeline.push({ text, t: performance.now() });
    };
    push();
    new MutationObserver(push).observe(statusEl, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  });
}

async function resetStatusTimeline(page) {
  await page.evaluate(() => {
    window.__ttsTimeline = [];
  });
}

async function getStatusTimeline(page) {
  return page.evaluate(() => window.__ttsTimeline || []);
}

function summarizeTtsRun(label, runtime, startedAt, events) {
  const loadingModel = findEvent(events, 'Loading model');
  const modelReady = findEvent(events, 'Model ready');
  const synth = findEvent(events, 'Synthesizing in background worker');
  const firstChunk = findEvent(events, 'Streaming audio… chunk 1');
  const done = findEvent(events, 'Done!');

  return {
    label,
    runtime,
    providerText: modelReady?.text ?? 'n/a',
    totalMs: done ? done.t - startedAt : null,
    modelLoadMs: loadingModel && modelReady ? modelReady.t - loadingModel.t : 0,
    synthToFirstChunkMs: synth && firstChunk ? firstChunk.t - synth.t : null,
    clickToFirstChunkMs: firstChunk ? firstChunk.t - startedAt : null,
    tailMs: firstChunk && done ? done.t - firstChunk.t : null,
    events,
  };
}

async function measureTtsRuntime(page, runtime) {
  await page.locator('#runtime-select').selectOption(runtime, { force: true });
  await page.locator('#model-select').selectOption(TTS_MODEL);
  await page.locator('#text-input').fill(TTS_TEXT);
  const streamToggle = page.locator('#direct-stream-toggle');
  if (!(await streamToggle.isChecked())) await streamToggle.check();

  const run = async (label) => {
    await resetStatusTimeline(page);
    const startedAt = await page.evaluate(() => performance.now());
    await page.locator('#generate-btn').click();
    try {
      await page.waitForFunction(
        () => {
          const status = document.getElementById('status')?.textContent || '';
          return status.includes('Done!') || status.includes('Error:');
        },
        null,
        { timeout: 8 * 60 * 1000 }
      );
    } catch (error) {
      const status = await page.locator('#status').innerText().catch(() => 'n/a');
      const events = await getStatusTimeline(page);
      throw new Error(`${label} timed out. Final status: ${status}. Timeline: ${events.map((e) => e.text).join(' -> ') || 'empty'}`);
    }
    const events = await getStatusTimeline(page);
    return summarizeTtsRun(label, runtime, startedAt, events);
  };

  return {
    cold: await run(`${runtime.toUpperCase()} cold`),
    warm: await run(`${runtime.toUpperCase()} warm`),
  };
}

const { browser, ctx, page } = await setupPage();

try {
  await installStatusTimeline(page);

  console.log('== Browser TTS ==');
  for (const runtime of TTS_RUNTIMES) {
    const { cold, warm } = await measureTtsRuntime(page, runtime);
    for (const run of [cold, warm]) {
      console.log(`\n${run.label}`);
      console.log(`  provider:              ${run.providerText}`);
      console.log(`  total click->done:     ${run.totalMs == null ? 'n/a' : fmt(run.totalMs)}`);
      console.log(`  model load:            ${run.modelLoadMs == null ? 'n/a' : fmt(run.modelLoadMs)}`);
      console.log(`  click->first chunk:    ${run.clickToFirstChunkMs == null ? 'n/a' : fmt(run.clickToFirstChunkMs)}`);
      console.log(`  synth->first chunk:    ${run.synthToFirstChunkMs == null ? 'n/a' : fmt(run.synthToFirstChunkMs)}`);
      console.log(`  first chunk->done:     ${run.tailMs == null ? 'n/a' : fmt(run.tailMs)}`);
    }
  }
} finally {
  await ctx.unrouteAll({ behavior: 'ignoreErrors' });
  await browser.close();
}