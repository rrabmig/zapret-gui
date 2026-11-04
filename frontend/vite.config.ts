import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: "./",
  build: {
    outDir: mode === "fixtures" ? "dist-fixtures" : "dist",
    target: "es2022",
    sourcemap: false,
    minify: true,
    cssCodeSplit: true,
  },
}));
