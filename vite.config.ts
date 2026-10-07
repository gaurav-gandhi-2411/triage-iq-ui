import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Test-only: has no effect on `vite build` output.
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    env: {
      VITE_API_BASE_URL: "http://api.test",
      // Forwarded so the contract test can switch to live mode (see Eval.contract.test.tsx).
      CORE_CONTRACT_LIVE: process.env.CORE_CONTRACT_LIVE ?? "",
    },
  },
});
