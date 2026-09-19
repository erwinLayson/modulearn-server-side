import {BadRequestError} from "./error.js";

export function CheckData<T extends object>(data: T) {
    for(const [key, value] of Object.entries(data)) {
        if(value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
            throw new BadRequestError(`Invalid data: ${key}`)
        };
    }
}