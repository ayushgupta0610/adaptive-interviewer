import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/domain/**", "src/core/**", "src/usecases/**", "src/services/**"],
      exclude: ["src/**/*.test.ts", "src/**/index.ts"],
    },
  },
});
