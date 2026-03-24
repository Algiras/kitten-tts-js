import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'index.browser': resolve(__dirname, 'src/index.browser.ts'),
        'index.node': resolve(__dirname, 'src/index.node.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: [
        'onnxruntime-web',
        'onnxruntime-node',
        '@huggingface/hub',
        'jszip',
        'phonemizer',
        'wav-encoder',
        'fs',
        'path',
        'os',
        'stream',
        'url',
        'crypto',
        'module',
        /^node:/,
      ],
    },
    outDir: 'dist',
    sourcemap: true,
    minify: false,
  },
  plugins: [
    dts({
      include: ['src/**/*.ts'],
      outDir: 'dist',
      insertTypesEntry: true,
    }),
  ],
});
