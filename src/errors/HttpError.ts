// src/errors/HttpError.ts
export class HttpError extends Error {
  statusCode: number;
  isOperational: boolean; // distinguishes expected vs programmer errors

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}
