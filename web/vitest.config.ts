import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    passWithNoTests: true,
    testTimeout: 60000,
    coverage: { provider: "v8", include: ["src/lib/dsp/**/*.ts"], exclude: ["src/lib/dsp/__tests__/**"] },
  },
});
