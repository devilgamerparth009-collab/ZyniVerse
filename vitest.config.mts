import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["src/__tests__/setup.ts"],
    // Several suites import the Next/Prisma/AniList graph on demand. On a busy
    // workstation a cold transform can exceed 15s, which produced spurious
    // timeouts in otherwise-passing contract tests. 30s covers a cold cache
    // without letting a genuinely hung route pass.
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: "v8",
      include: ["src/lib/*.ts"],
      exclude: ["src/lib/anilist.ts", "src/lib/prisma.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
