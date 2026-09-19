import jwt from "jsonwebtoken";
import {getEnvName} from "./getEnv.js";
import type{UserRole} from "../constant/users.js";

export interface TokenPayload {
    id: string;
    role: UserRole;
    school_id?: number;
}

export function generateToken(payload: TokenPayload): string {
    const secret = getEnvName("JWT_SECRET");
    return jwt.sign(payload, secret, { expiresIn: "24h" });
}

export function verifyToken(token: string): TokenPayload {
    const secret = getEnvName("JWT_SECRET");
    return jwt.verify(token, secret) as TokenPayload;
}
