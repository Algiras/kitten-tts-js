/**
 * Bundles in-browser Transformers.js copresenter adapter for docs/slides.html.
 */
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/slides-web-llm-assistant.ts'),
      formats: ['es'],
      fileName: () => 'slides-web-llm.js',
    },
    rollupOptions: {
      external: [],
    },
    outDir: 'docs',
    emptyOutDir: false,
    sourcemap: false,
    minify: false,
  },
});
