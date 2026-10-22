import dotenv from "dotenv";
import { afterAll, beforeAll, vi } from "vitest";
import { databasePool } from "../config/database.js";

// app.ts also calls dotenv.config(); this keeps both silent in test output.
process.env.DOTENV_CONFIG_QUIET = "true";

// Mirror the server bootstrap: base env first, then the environment file.
dotenv.config({ path: ".env", quiet: true });
dotenv.config({
    path: process.env.SYSTEM_STATUS === "production" ? ".env.production" : ".env.development",
    quiet: true,
});

for (const name of ["JWT_SECRET", "USER_DEFAULT_PASSWORD"]) {
    if (!process.env[name]) {
        throw new Error(
            `Missing required environment variable ${name}. Tests cannot run without it.`
        );
    }
}

// Expected 4xx responses are logged by ErrorHandler through console.warn.
// Silence only that channel; console.error (real 5xx failures) stays visible.
beforeAll(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
});

// Close the lazy pool so the test process can exit cleanly.
afterAll(async () => {
    await databasePool().end();
});
