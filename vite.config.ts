import { defineConfig } from "vite";
export default defineConfig(({ mode }) => ({
  base: "./",
  build: { outDir: mode === "test" ? "test-dist" : "dist" },
}));
