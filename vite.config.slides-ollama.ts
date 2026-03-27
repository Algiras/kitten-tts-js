/**
 * Bundles Ollama adapter for docs/slides.html copresenter brain (localhost API).
 */
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/slides-ollama-assistant.ts'),
      formats: ['es'],
      fileName: () => 'slides-ollama.js',
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
