import type { Response } from "express";

interface SuccessResponse<T> {
  message: string;
  isOk: boolean;
  data?: T;
}

export function sendSuccess<T>(res: Response, message: string, data?: T, statusCode = 200) {
  const body: SuccessResponse<T> = { message, isOk: true };
  if (data !== undefined) {
    body.data = data;
  }
  return res.status(statusCode).json(body);
}
