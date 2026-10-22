import { describe, expect, it, vi } from "vitest";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { UUIDToBuffer } from "../../helper/UUIDToBuffer.js";
import { bufferToUUID } from "../../helper/bufferToUUID.js";
import { generateRandomUUID } from "../../helper/generateRandomId.js";
import { normalizeEmail } from "../../helper/normalizeEmail.js";
import { CheckData } from "../../helper/checkdata.js";
import { BadRequestError } from "../../helper/error.js";
import { generateToken, verifyToken } from "../../helper/jwt.js";
import { hashPassword } from "../../helper/hashPassword.js";
import { getEnvName } from "../../helper/getEnv.js";

const SAMPLE_UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("UUID helpers", () => {
    it("round-trips a canonical UUID", () => {
        expect(bufferToUUID(UUIDToBuffer(SAMPLE_UUID))).toBe(SAMPLE_UUID);
    });

    it("accepts uppercase and un-hyphenated input", () => {
        const upper = SAMPLE_UUID.toUpperCase();
        expect(bufferToUUID(UUIDToBuffer(upper))).toBe(SAMPLE_UUID);
        expect(bufferToUUID(UUIDToBuffer(SAMPLE_UUID.replace(/-/g, "")))).toBe(SAMPLE_UUID);
    });

    it("generates 16-byte ids that do not repeat", () => {
        const ids = new Set<string>();
        for (let i = 0; i < 500; i++) {
            const buffer = generateRandomUUID();
            expect(buffer).toHaveLength(16);
            ids.add(buffer.toString("hex"));
        }
        expect(ids.size).toBe(500);
    });

    it("formats UUIDs in the canonical pattern", () => {
        expect(bufferToUUID(generateRandomUUID())).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
        );
    });
});

describe("normalizeEmail", () => {
    it("trims and lowercases", () => {
        expect(normalizeEmail("  User.Name@Example.COM  ")).toBe("user.name@example.com");
    });

    it("leaves an already-normalized address unchanged", () => {
        expect(normalizeEmail("user@example.com")).toBe("user@example.com");
    });
});

describe("CheckData", () => {
    it("rejects undefined, null and blank strings", () => {
        expect(() => CheckData({ value: undefined })).toThrow(BadRequestError);
        expect(() => CheckData({ value: null })).toThrow("Invalid data: value");
        expect(() => CheckData({ value: "   " })).toThrow("Invalid data: value");
    });

    it("accepts 0 and false as real values", () => {
        expect(() => CheckData({ zero: 0, flag: false })).not.toThrow();
    });
});

describe("JWT helpers", () => {
    const payload = { id: SAMPLE_UUID, role: "faculty" as const, school_id: 42 };

    it("round-trips a token payload", () => {
        expect(verifyToken(generateToken(payload))).toMatchObject(payload);
    });

    it("rejects a token signed with another secret", () => {
        const forged = jwt.sign(payload, "not-the-real-secret");
        expect(() => verifyToken(forged)).toThrow();
    });

    it("rejects an expired token", () => {
        const expired = jwt.sign(payload, getEnvName("JWT_SECRET"), { expiresIn: -10 });
        expect(() => verifyToken(expired)).toThrow();
    });
});

describe("hashPassword", () => {
    it("hashes irreversibly and verifies", async () => {
        const hash = await hashPassword("Secret123!");
        expect(hash).not.toBe("Secret123!");
        expect(await bcrypt.compare("Secret123!", hash)).toBe(true);
        expect(await bcrypt.compare("wrong", hash)).toBe(false);
    });
});

describe("getEnvName", () => {
    it("returns a configured value", () => {
        expect(getEnvName("JWT_SECRET")).toBe(process.env.JWT_SECRET);
    });

    it("throws for a missing variable", () => {
        const log = vi.spyOn(console, "log").mockImplementation(() => {});
        try {
            expect(() => getEnvName("__MISSING_TEST_VARIABLE__")).toThrow(
                "Invalid Env Variable"
            );
        } finally {
            log.mockRestore();
        }
    });
});
