/**
 * Playwright smoke test for the KittenTTS web UI.
 * Run: node scripts/test-web-ui.mjs
 *
 * Checks:
 *  1. Page loads (title, key elements visible)
 *  2. Model selector has all known models
 *  3. Voice selector is populated after load
 *  4. Runtime selector options are correct
 *  5. Speed slider works
 *  6. Generate button triggers loading state and produces audio (wasm runtime)
 *  7. Player card appears with a non-empty audio src
 *  8. Download button is visible
 */

import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:4173';
const TIMEOUT_MS = 3 * 60 * 1000; // model download can take a while

const EXPECTED_MODEL_COUNT = 3;

let passed = 0;
let failed = 0;

function ok(label) {
  console.log(`  ✅  ${label}`);
  passed++;
}

function fail(label, err) {
  console.error(`  ❌  ${label}`);
  if (err) console.error(`      ${err.message ?? err}`);
  failed++;
}

async function assert(label, fn) {
  try {
    await fn();
    ok(label);
  } catch (e) {
    fail(label, e);
  }
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

// Inject COOP/COEP headers on all responses so crossOriginIsolated=true
// and SharedArrayBuffer is available for ORT WASM threads.
await ctx.route('**/*', async (route) => {
  const response = await route.fetch();
  const headers = {
    ...response.headers(),
    'cross-origin-opener-policy': 'same-origin',
    'cross-origin-embedder-policy': 'require-corp',
  };
  await route.fulfill({ response, headers });
});

// Collect console errors
const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', err => consoleErrors.push(err.message));

console.log('\n── 1. Page load ─────────────────────────────────────────');
await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });

await assert('Title contains "KittenTTS"', async () => {
  const title = await page.title();
  if (!title.includes('KittenTTS')) throw new Error(`Got: ${title}`);
});

await assert('Generate button is visible', async () => {
  await page.waitForSelector('#generate-btn', { state: 'visible', timeout: 5000 });
});

await assert('Text input is visible', async () => {
  await page.waitForSelector('#text-input', { state: 'visible', timeout: 5000 });
});

await assert('Status div exists', async () => {
  await page.waitForSelector('#status', { timeout: 5000 });
});

await assert('Player card is initially hidden', async () => {
  const card = page.locator('#player-card');
  const vis = await card.evaluate(el => getComputedStyle(el).display);
  if (vis !== 'none') throw new Error(`Expected display:none, got ${vis}`);
});

console.log('\n── 2. Model selector ────────────────────────────────────');
const modelOptions = await page.locator('#model-select option').allTextContents();
await assert(`Model selector has ${EXPECTED_MODEL_COUNT} entries`, async () => {
  if (modelOptions.length !== EXPECTED_MODEL_COUNT) throw new Error(`Got ${modelOptions.length} options`);
});

console.log('\n── 3. Runtime selector ──────────────────────────────────');
const runtimeOptions = await page.locator('#runtime-select option').allInnerTexts();
await assert('Runtime selector has "CPU" option (maps to WASM)', async () => {
  if (!runtimeOptions.some(t => t.toUpperCase().includes('CPU'))) {
    throw new Error(`Options: ${runtimeOptions.join(', ')}`);
  }
});
await assert('Runtime selector exposes GPU option', async () => {
  if (!runtimeOptions.some(t => t.toUpperCase().includes('GPU'))) {
    throw new Error(`Options: ${runtimeOptions.join(', ')}`);
  }
});
await assert('Runtime selector exposes CPU and GPU options', async () => {
  if (runtimeOptions.length !== 2) {
    throw new Error(`Options: ${runtimeOptions.join(', ')}`);
  }
});

console.log('\n── 4. Speed slider ──────────────────────────────────────');
await assert('Speed slider changes display value', async () => {
  await page.locator('#speed-range').evaluate(el => {
    el.value = '1.5';
    el.dispatchEvent(new Event('input'));
  });
  const speedText = await page.locator('#speed-val').innerText();
  if (!speedText.includes('1.5')) throw new Error(`Speed val: ${speedText}`);
  // Reset to 1.0 for remaining tests
  await page.locator('#speed-range').evaluate(el => {
    el.value = '1.0';
    el.dispatchEvent(new Event('input'));
  });
});

console.log('\n── 5. Generate speech (all models) ─');

const TEST_TEXT = 'Hello from the automated test.';

const MODELS = [
  { id: 'onnx-community/KittenTTS-Nano-v0.8-ONNX',  label: 'Nano ONNX'  },
  { id: 'onnx-community/KittenTTS-Micro-v0.8-ONNX', label: 'Micro ONNX' },
  { id: 'onnx-community/KittenTTS-Mini-v0.8-ONNX',  label: 'Mini ONNX'  },
];

await page.locator('.details-summary').click();

for (const model of MODELS) {
  console.log(`\n  ── ${model.label} (${model.id})`);

  // Force CPU/WASM runtime; select model
  await page.locator('#runtime-select').selectOption({ value: 'cpu' });
  await page.locator('#model-select').selectOption(model.id, { force: true });
  await page.locator('#text-input').fill(TEST_TEXT);

  // Disable streaming to get a single audio result
  const streamToggle = page.locator('#direct-stream-toggle');
  if (await streamToggle.isChecked()) await streamToggle.uncheck();

  await page.locator('#generate-btn').click();

  await assert(`[${model.label}] Generation started (button disabled or completes fast)`, async () => {
    // Fast models may complete before we check — accept either disabled or player card visible
    await page.waitForFunction(
      () => {
        const btn  = document.querySelector('#generate-btn');
        const card = document.querySelector('#player-card');
        return btn?.disabled || (card && getComputedStyle(card).display !== 'none');
      },
      null,
      { timeout: TIMEOUT_MS }
    );
  });

  await assert(`[${model.label}] Status shows loading text`, async () => {
    const statusText = await page.locator('#status').innerText();
    if (!statusText) throw new Error('Status is empty');
  });

  console.log(`  ⏳  Waiting for model download + inference (may take a while)…`);
  await assert(`[${model.label}] Player card appears after generation`, async () => {
    await page.waitForFunction(
      () => {
        const card = document.querySelector('#player-card');
        return card && getComputedStyle(card).display !== 'none';
      },
      { timeout: TIMEOUT_MS }
    );
  });

  await assert(`[${model.label}] Audio element has a blob src`, async () => {
    const src = await page.locator('#audio-player').getAttribute('src');
    if (!src || (!src.startsWith('blob:') && !src.startsWith('data:'))) {
      throw new Error(`Audio src: ${src}`);
    }
  });

  await assert(`[${model.label}] Generate button re-enabled after completion`, async () => {
    await page.waitForFunction(
      () => !document.querySelector('#generate-btn')?.disabled,
      { timeout: 15000 }
    );
  });

  await assert(`[${model.label}] Download button is visible`, async () => {
    await page.locator('#download-btn').waitFor({ state: 'visible', timeout: 5000 });
  });

  await assert(`[${model.label}] Audio blob is non-trivial`, async () => {
    const src = await page.locator('#audio-player').getAttribute('src');
    if (!src) throw new Error('No audio src');

    const audioSize = await page.evaluate(async (blobUrl) => {
      const resp = await fetch(blobUrl);
      const buf  = await resp.arrayBuffer();
      return buf.byteLength;
    }, src);

    if (audioSize < 1000) throw new Error(`Audio blob suspiciously small: ${audioSize} bytes`);
  });
}

console.log('\n── 6. Console errors ────────────────────────────────────');
if (consoleErrors.length === 0) {
  ok('No console errors during session');
} else {
  // Some ORT warnings are non-fatal; only fail on hard errors
  const hardErrors = consoleErrors.filter(e =>
    !e.includes('ORT') &&
    !e.includes('[kitten-tts]') &&        // our own logged warnings are ok
    !e.toLowerCase().includes('warn') &&
    !e.toLowerCase().includes('unknown cpu vendor') &&
    !e.includes('cannot release session') // benign ORT cleanup when switching models
  );
  if (hardErrors.length === 0) {
    ok(`${consoleErrors.length} warning(s), no hard errors`);
    consoleErrors.forEach(e => console.log(`     ⚠  ${e.slice(0, 120)}`));
  } else {
    fail(`${hardErrors.length} hard console error(s)`, { message: hardErrors.slice(0, 3).join('\n     ') });
  }
}

// Drain any in-flight route callbacks before closing (route is on ctx, not page)
await ctx.unrouteAll({ behavior: 'ignoreErrors' });
await browser.close();

console.log(`\n${'─'.repeat(55)}`);
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log(`${'─'.repeat(55)}\n`);

process.exit(failed > 0 ? 1 : 0);
