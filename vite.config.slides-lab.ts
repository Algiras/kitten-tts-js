/**
 * Bundles the slides presenter (deck, speaker notes, KittenTTS) for docs/slides.html.
 */
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/slides-lab.ts'),
      formats: ['es'],
      fileName: () => 'slides-lab.js',
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
