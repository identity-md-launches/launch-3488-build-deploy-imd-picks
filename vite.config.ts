import { defineConfig } from "vite";

// Static export for IPFS / gateway subpaths: every asset URL is relative.
export default defineConfig({
  base: "./",
  esbuild: { jsx: "automatic" },
  build: { outDir: "dist", assetsDir: "assets", sourcemap: false, chunkSizeWarningLimit: 900 },
});
