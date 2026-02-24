#!/usr/bin/env node
/**
 * Post-build script: inlines bundle.js into docs/index.html to produce
 * docs/index-standalone.html which works when opened directly via file://
 * (Chrome blocks dynamic import() on file:// but allows inline <script type="module">).
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const docsDir = join(rootDir, 'docs');

const bundleJs = readFileSync(join(docsDir, 'bundle.js'), 'utf8');
let html = readFileSync(join(docsDir, 'index.html'), 'utf8');

// Strip the ESM export statement and expose KittenTTS as a window global
// so the enclosing module script can pick it up.
const inlineBundle = bundleJs.replace(
    /^export\s*\{[^}]+\}\s*;?\s*$/m,
    'self.__KittenTTS = KittenTTS;' // 'self' instead of 'window' for Worker compatibility
);

let workerJs = readFileSync(join(docsDir, 'worker.js'), 'utf8');

// The standalone worker needs the bundle logic inside of it since it can't import() via file://
const standaloneWorker = `
// === INLINED BUNDLE.JS ===
${inlineBundle}
// === END BUNDLE.JS ===

${workerJs}
`;

// Inject the worker blob builder into the HTML
html = html.replace(
    '<script type="module">',
    `<script type="module">
// === INLINE WORKER BLOB ===
const workerCode = ${JSON.stringify(standaloneWorker)};
const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
window.__WORKER_BLOB_URL = URL.createObjectURL(workerBlob);
</script>

<script type="module">`
);

writeFileSync(join(docsDir, 'index-standalone.html'), html);
console.log('✓ Created docs/index-standalone.html (open directly in browser — no server needed)');
