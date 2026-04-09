import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
    pool: "forks",
    forks: {
      singleFork: true,
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: [
        "src/test/**",
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
        "src/**/*.d.ts",
        "src/**/types.ts",
        "src/**/types/**",
        "src/index.ts",
        "src/lib/seed.ts",
        "src/lib/rate-limit.ts",
      ],
      thresholds: {
        lines: 85,
        branches: 85,
        functions: 85,
        statements: 85,
      },
    },
  },
  resolve: {
    conditions: ["workspace"],
  },
});
