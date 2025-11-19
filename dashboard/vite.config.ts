import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    // port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://127.0.0.1:3000',
        ws: true
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'reactflow',
      'dagre',
      'zustand',
      'd3',
      'lucide-react',
      'recharts',
      'socket.io-client'
    ],
    esbuildOptions: {
      target: 'esnext'
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'esnext'
  },
//   test: {
//     globals: true,
//     environment: 'jsdom'
//   }
});