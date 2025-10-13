import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'AgentTracer',
      formats: ['es'],
      fileName: 'index'
    },
    rollupOptions: {
      external: ['@langchain/core'],
      output: {
        preserveModules: false
      }
    },
    sourcemap: true,
    target: 'esnext'
  },
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html']
    }
  }
});