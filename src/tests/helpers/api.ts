import request from "supertest";
import type { Response } from "supertest";
import { expect } from "vitest";

import app from "../../app.js";
import { generateToken } from "../../helper/jwt.js";
import type { UserRole } from "../../constant/users.js";

export interface TestIdentity {
    id: string;
    role: UserRole;
    school_id?: number;
}

/** A chained Supertest request created from the exported Express app. */
export type ApiTest = InstanceType<typeof request.Test>;

export const tokenFor = (identity: TestIdentity): string => {
    const payload: { id: string; role: UserRole; school_id?: number } = {
        id: identity.id,
        role: identity.role,
    };
    if (identity.school_id !== undefined) {
        payload.school_id = identity.school_id;
    }
    return generateToken(payload);
};

export const cookieFor = (identity: TestIdentity): string => `token=${tokenFor(identity)}`;

export const as = (identity: TestIdentity, test: ApiTest): ApiTest =>
    test.set("Cookie", [cookieFor(identity)]);

export const api = {
    get: (identity: TestIdentity, url: string): ApiTest =>
        as(identity, request(app).get(url)),
    post: (identity: TestIdentity, url: string): ApiTest =>
        as(identity, request(app).post(url)),
    put: (identity: TestIdentity, url: string): ApiTest =>
        as(identity, request(app).put(url)),
    delete: (identity: TestIdentity, url: string): ApiTest =>
        as(identity, request(app).delete(url)),
    anonymousGet: (url: string): ApiTest => request(app).get(url),
    anonymousPost: (url: string): ApiTest => request(app).post(url),
};

/** Performs a real login request (no pre-signed cookie). */
export const loginRequest = (email: string, password: string, schoolId?: number): ApiTest => {
    const body: { email: string; password: string; school_id?: number } = { email, password };
    if (schoolId !== undefined) {
        body.school_id = schoolId;
    }
    return request(app).post("/api/auth/login").send(body);
};

/** Asserts the success envelope produced by `sendSuccess`. */
export function expectSuccess(res: Response, status = 200) {
    expect(res.status, `expected ${status}, body: ${JSON.stringify(res.body)}`).toBe(status);
    expect(res.body).toMatchObject({ isOk: true });
    expect(typeof res.body.message).toBe("string");
    return res.body;
}

/** Asserts the error envelope produced by `ErrorHandler`. */
export function expectError(res: Response, status: number, messageIncludes?: string) {
    expect(res.status, `expected ${status}, body: ${JSON.stringify(res.body)}`).toBe(status);
    expect(res.body).toMatchObject({ success: false });
    expect(typeof res.body.message).toBe("string");
    if (messageIncludes) {
        expect(res.body.message).toContain(messageIncludes);
    }
    return res.body;
}

/** Returns the `token` cookie set on a response. */
export function findTokenCookie(res: Response): string | undefined {
    const cookies = (res.headers["set-cookie"] ?? []) as unknown as string[];
    return cookies.find((cookie) => cookie.startsWith("token="));
}
