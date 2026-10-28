import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    passWithNoTests: true,
    testTimeout: 60000,
    coverage: {
      provider: "v8",
      include: ["src/lib/dsp/**/*.ts"],
      exclude: ["src/lib/dsp/__tests__/**"],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 },
    },
  },
});
