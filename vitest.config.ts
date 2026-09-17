import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const env = loadEnv("test", process.cwd(), "");
const testDatabaseUrl =
  env.DATABASE_TEST_URL === "" ? undefined : env.DATABASE_TEST_URL;

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Resetting a shared database requires sequential tests and files.
    fileParallelism: false,
    maxConcurrency: 1,
    env: {
      DATABASE_URL: testDatabaseUrl ?? env.DATABASE_URL ?? "",
      BETTER_AUTH_SECRET: "test-only-secret-not-for-deployment-0123456789",
      BETTER_AUTH_GITHUB_CLIENT_ID: "test-placeholder",
      BETTER_AUTH_GITHUB_CLIENT_SECRET: "test-placeholder",
      BETTER_AUTH_URL: "http://localhost:3000",
    },
    coverage: {
      provider: "v8",
      include: ["src/server/api/**/*.ts", "src/server/lib/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.spec.ts", "**/*.d.ts", "**/__tests__/**"],
      reporter: ["text", "html", "lcov"],
      reportOnFailure: true,
      thresholds: {
        100: true,
        perFile: true,
      },
    },
  },
});
