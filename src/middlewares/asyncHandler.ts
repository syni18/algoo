import { NextFunction, Request, RequestHandler, Response } from 'express';

// Wrapper to catch errors in async route handlers
const asyncHandler = (fn: RequestHandler) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
