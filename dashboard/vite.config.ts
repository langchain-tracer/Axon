import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// In dev, proxy API + SSE to the backend (single port 4000). In production the
// backend serves the built dashboard, so these requests are same-origin.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    proxy: {
      '/api': { target: 'http://127.0.0.1:4000', changeOrigin: true },
      '/v1': { target: 'http://127.0.0.1:4000', changeOrigin: true },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'esnext',
  },
});
