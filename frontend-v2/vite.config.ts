/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    proxy: { "/api": "http://localhost:8000" },
  },
  preview: {
    port: 5174,
    strictPort: true,
    proxy: { "/api": "http://localhost:8000" },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
