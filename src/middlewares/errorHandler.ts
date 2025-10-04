// src/middleware/errorHandler.ts
import { NextFunction, Request, Response } from 'express';

import { HttpError } from '../errors/HttpError';
import logger from '../logger/winston-logger';
import { sendResponse } from '../utils/sendResponse';
import { timestampFormatGmt } from '../utils/timestamp-format';

const errorHandler = (err: Error | HttpError, req: Request, res: Response, _next: NextFunction) => {
  let statusCode: number;
  let message: string;

  if (err instanceof HttpError) {
    // Use custom error details
    statusCode = err.statusCode;
    message = err.message;
  } else {
    // Unexpected or generic error
    statusCode = 500;
    message = 'Internal Server Error';
  }

  // Log the error (optionally enrich with request info)
  logger.error(`${req.method} ${req.originalUrl} - ${statusCode} - ${err.message}`);
  if (!(err instanceof HttpError)) {
    logger.error(err.stack ?? '');
  }

  // Add stack trace in development
  const meta: Record<string, any> = {
    timestamp: timestampFormatGmt(new Date()),
    path: req.originalUrl,
    method: req.method,
  };

  if (
    process.env.NODE_ENV !== 'production' &&
    err &&
    typeof err === 'object' &&
    'stack' in err &&
    typeof (err as { stack?: unknown }).stack === 'string'
  ) {
    meta.stack = (err as { stack: string }).stack;
    meta.message = err.message;
  }

  // ✅ Use sendResponse for consistency
  return sendResponse({
    res,
    statusCode,
    success: false,
    message,
    data: null,
    meta,
  });
};

export default errorHandler;
