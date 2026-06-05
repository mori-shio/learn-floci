import { defineConfig } from "vite";

export default defineConfig({
  base: "/learn-floci/",
  build: {
    outDir: "dist",
    emptyOutDir: false,
    rollupOptions: {
      input: "sw/index.ts",
      output: {
        entryFileNames: "sw.js",
        inlineDynamicImports: true,
        format: "iife",
      },
    },
  },
});
