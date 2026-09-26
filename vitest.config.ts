import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Route tests mock external services but still import modules that validate
// public configuration. Supply harmless test-only values when none are set.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Live tests (*.live.test.ts) are excluded by the glob below and skip themselves
    // unless run through `npm run test:smoke`; see the note in that file.
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts", "src/app/api/**/*.ts"],
    },
  },
});
