import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: './',
  build: { rollupOptions: { output: { manualChunks: { three: ['three'] } } } },
  server: { fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] } }
});
