import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The web UI is prebuilt into dist/web and served by `mosage dev`.
// For UI development, run `mosage dev --port 5281 --no-open` in a book
// workspace and `npm run dev:web` here — /api is proxied to it.
export default defineConfig({
  root: 'web',
  base: './',
  plugins: [react()],
  build: {
    outDir: '../dist/web',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
  },
  server: {
    port: 5282,
    proxy: {
      '/api': 'http://127.0.0.1:5281',
      '/files': 'http://127.0.0.1:5281',
    },
  },
});
