import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';

import { HttpError } from '../errors/HttpError';
type ValidationTarget = 'body' | 'params' | 'query';

export const validateRequest =
  (schema: ZodSchema, target: ValidationTarget = 'body') =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      throw new HttpError(`Invalid Request: ${errors[0].message}`, 400);
    }

    // overwrite request with safe parsed data
    req[target] = result.data;
    next();
  };
