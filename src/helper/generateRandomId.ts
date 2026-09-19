import {randomUUID} from "node:crypto";
import { UUIDToBuffer } from "./UUIDToBuffer.js";

export function generateRandomUUID() {
    const id = randomUUID();

    const bufferId = UUIDToBuffer(id);
    return bufferId
}