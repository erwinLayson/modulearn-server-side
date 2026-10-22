import express from "express";
import request from "supertest";
import type { Express } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ErrorHandler from "../../middleware/ErrorHandler.js";
import {
    BadRequestError,
    ConflictError,
    ForbiddenError,
    InternalServerError,
    NotFoundError,
    UnauthorizedError,
} from "../../helper/error.js";

const buildApp = (error: Error): Express => {
    const app = express();
    app.get("/boom", () => {
        throw error;
    });
    app.use(ErrorHandler);
    return app;
};

const errorResponse = async (error: Error) => {
    const res = await request(buildApp(error)).get("/boom");
    return res;
};

const mysqlError = (code: string, sqlMessage = "") => ({ code, sqlMessage });

describe("ErrorHandler", () => {
    beforeEach(() => {
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("returns the status and message of AppError subclasses", async () => {
        const cases = [
            [new BadRequestError("bad input"), 400],
            [new UnauthorizedError("no token"), 401],
            [new ForbiddenError("not allowed"), 403],
            [new NotFoundError("missing", 404), 404],
            [new ConflictError("duplicate"), 409],
        ] as const;

        for (const [error, status] of cases) {
            const res = await errorResponse(error);
            expect(res.status).toBe(status);
            expect(res.body).toEqual({ success: false, message: error.message });
        }
    });

    it("hides internal details for any 5xx AppError", async () => {
        const res = await errorResponse(new InternalServerError("secret detail", 500, new Error("db down")));
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ success: false, message: "Internal Server Error" });
    });

    it("hides details for a 503 NotFoundError", async () => {
        const res = await errorResponse(new NotFoundError("The requested data is not available", 503));
        expect(res.status).toBe(503);
        expect(res.body.message).toBe("Internal Server Error");
    });

    it("returns a generic 500 for unknown errors", async () => {
        const res = await errorResponse(new Error("unexpected crash"));
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ success: false, message: "Internal Server Error" });
    });

    it("maps a duplicate-key error to the message for its constraint", async () => {
        const res = await errorResponse(
            new InternalServerError("Internal Server error", 500, {
                code: "ER_DUP_ENTRY",
                sqlMessage: "Duplicate entry 'abc' for key 'uq_grade_items'",
            })
        );
        expect(res.status).toBe(409);
        expect(res.body.message).toBe(
            "An activity with this title already exists for this class and subject."
        );
    });

    it("falls back to a generic duplicate message for an unknown constraint", async () => {
        const res = await errorResponse(
            new InternalServerError("Internal Server error", 500, {
                code: "ER_DUP_ENTRY",
                sqlMessage: "Duplicate entry 'abc' for key 'some_other_key'",
            })
        );
        expect(res.status).toBe(409);
        expect(res.body.message).toBe(
            "This record already exists. Please check for duplicates before trying again."
        );
    });

    it("maps missing and blocked references", async () => {
        const missing = await errorResponse(
            new InternalServerError("Internal Server error", 500, mysqlError("ER_NO_REFERENCED_ROW_2"))
        );
        expect(missing.status).toBe(400);

        const blocked = await errorResponse(
            new InternalServerError("Internal Server error", 500, mysqlError("ER_ROW_IS_REFERENCED_2"))
        );
        expect(blocked.status).toBe(409);
    });

    it("maps required-field, length and range errors", async () => {
        const cases = [
            "ER_BAD_NULL_ERROR",
            "ER_DATA_TOO_LONG",
            "ER_WARN_DATA_OUT_OF_RANGE",
        ];

        for (const code of cases) {
            const res = await errorResponse(
                new InternalServerError("Internal Server error", 500, mysqlError(code))
            );
            expect(res.status, code).toBe(400);
        }
    });

    it("maps a missing table to 503", async () => {
        const res = await errorResponse(
            new InternalServerError("Internal Server error", 500, mysqlError("ER_NO_SUCH_TABLE"))
        );
        expect(res.status).toBe(503);
        expect(res.body.message).toContain("not available");
    });

    it("only maps MySQL causes wrapped by an InternalServerError", async () => {
        const res = await errorResponse(
            new BadRequestError("already a client error")
        );
        expect(res.status).toBe(400);
        expect(res.body.message).toBe("already a client error");
    });

    it("walks a nested cause chain", async () => {
        let cause: unknown = mysqlError("ER_DUP_ENTRY", "Duplicate entry 'x' for key 'uq_class_modules'");
        for (let i = 0; i < 3; i++) {
            cause = { cause };
        }

        const res = await errorResponse(new InternalServerError("Internal Server error", 500, cause));
        expect(res.status).toBe(409);
        expect(res.body.message).toBe(
            "This module is already assigned to this class for this school year."
        );
    });

    it("stops walking the cause chain after five levels", async () => {
        let cause: unknown = mysqlError("ER_DUP_ENTRY", "Duplicate entry 'x' for key 'uq_class_modules'");
        for (let i = 0; i < 6; i++) {
            cause = { cause };
        }

        const res = await errorResponse(new InternalServerError("Internal Server error", 500, cause));
        expect(res.status).toBe(500);
        expect(res.body.message).toBe("Internal Server Error");
    });
});
