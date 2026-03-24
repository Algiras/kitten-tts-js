/**
 * Vite config for the GitHub Pages / browser demo bundle.
 * Produces docs/bundle.js — a fully-self-contained ESM file that the
 * Web Worker (docs/worker.js) imports at runtime.
 */
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.browser.ts'),
      formats: ['es'],
      fileName: () => 'bundle.js',
    },
    rollupOptions: {
      // Only exclude onnxruntime-node and bare node: builtins —
      // everything else (onnxruntime-web, jszip, etc.) gets bundled.
      external: [
        'onnxruntime-node',
        /^node:/,
        'fs', 'path', 'os', 'stream', 'url', 'crypto', 'module',
      ],
    },
    outDir: 'docs',
    emptyOutDir: false,  // preserve index.html, worker.js, wasm files, etc.
    sourcemap: false,
    minify: false,
  },
});
