import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Lets the UI read ../sample_report.json from the repo root.
  server: { fs: { allow: [".."] } },
});
