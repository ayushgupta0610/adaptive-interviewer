import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // Scope to the testable logic. The excluded service files are construction/
      // wiring glue (env parsing, DI factories, the Supabase client) that is only
      // exercisable with live keys — covered by the key-gated integration tests.
      include: ["src/domain/**", "src/core/**", "src/usecases/**", "src/services/llm.ts", "src/services/elevenlabs.ts", "src/services/memoryCache.ts"],
      exclude: ["src/**/*.test.ts"],
    },
  },
});
