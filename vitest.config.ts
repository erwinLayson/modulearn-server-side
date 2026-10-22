import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        include: ["src/tests/**/*.test.ts"],
        setupFiles: ["src/tests/setup.ts"],
        // One shared database: run test files one at a time.
        fileParallelism: false,
        testTimeout: 30_000,
        hookTimeout: 60_000,
        // `.env.development` targets host.docker.internal in some environments.
        // A process-level HOST still wins; otherwise fall back to localhost.
        env: {
            HOST: process.env.HOST ?? "localhost",
        },
        coverage: {
            provider: "v8",
            reportsDirectory: "coverage",
            include: [
                "src/service/**/*.ts",
                "src/middleware/**/*.ts",
                "src/helper/**/*.ts",
                "src/model/**/*.ts",
            ],
            exclude: ["src/tests/**"],
        },
    },
});
