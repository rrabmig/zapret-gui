import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { aliases } from "./aliases";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: "./",
  resolve: { alias: aliases },
  build: {
    outDir: mode === "fixtures" ? "dist-fixtures" : "dist",
    target: "es2022",
    sourcemap: false,
    minify: true,
    cssCodeSplit: true,
  },
}));
