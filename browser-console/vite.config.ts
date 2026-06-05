import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        sw: "sw/index.ts",
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === "sw") return "sw.js";
          return "assets/[name]-[hash].js";
        },
      },
    },
  },
});
