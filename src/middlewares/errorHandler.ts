// src/middleware/errorHandler.ts
import { NextFunction, Request, Response } from "express";

import { HttpError } from "../errors/HttpError.js";
import logger from "../logger/winston-logger.js";

const errorHandler = (
  err: Error | HttpError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  let statusCode: number;
  let message: string;

  if (err instanceof HttpError) {
    // Use custom error details
    statusCode = err.statusCode;
    message = err.message;
  } else {
    // Unexpected or generic error
    statusCode = 500;
    message = "Internal Server Error";
  }

  // Log the error (optionally enrich with request info)
  logger.error(
    `${req.method} ${req.originalUrl} - ${statusCode} - ${err.message}`
  );
  if (!(err instanceof HttpError)) {
    logger.error(err.stack ?? "");
  }

  // Hide stack trace in production, show only in development
  const responseBody: { error: string; stack?: string } = { error: message };
  if (
    process.env.NODE_ENV !== "production" &&
    err &&
    typeof err === "object" &&
    "stack" in err &&
    typeof (err as { stack?: unknown }).stack === "string"
  ) {
    responseBody.stack = (err as { stack: string }).stack;
  }

  res.status(statusCode).json(responseBody);
};

export default errorHandler;
