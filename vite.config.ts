/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// This file runs under Node; declare the one global we use rather than
// pulling in @types/node for a single line.
declare const process: { env: Record<string, string | undefined> };

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.PORT) || 4000,
  },
  // The engine's workers import modules, so they build as ES modules.
  worker: { format: "es" },
  test: {
    exclude: ["node_modules/**"],
  },
});
