import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // Scope to the testable logic. Construction/wiring glue that is ONLY exercisable
      // with live keys (env parsing, the Supabase client factory, the Upstash limiter)
      // stays out — it is covered by the key-gated integration tests. The payments/auth
      // business logic and route handlers are now unit/integration tested, so they're in.
      include: [
        "src/domain/**",
        "src/core/**",
        "src/usecases/**",
        "src/services/llm.ts",
        "src/services/elevenlabs.ts",
        "src/services/memoryCache.ts",
        "src/services/auth.ts",
        "src/services/billingRepo.ts",
        "src/services/rateLimit.ts",
        "src/services/payments/**",
        "src/app/api/billing/**",
        "src/app/api/session/**",
      ],
      exclude: ["src/**/*.test.ts"],
    },
  },
});
