import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    target: "esnext",
    outDir: "dist",
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es"],
      fileName: "index"
    },
    rollupOptions: {
      external: ["express", "ws", "cors", "http", "url", "path"]
    },
    sourcemap: true
  },
  test: {
    globals: true,
    environment: "node"
  }
});
