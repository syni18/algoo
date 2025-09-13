import { NextFunction, Request, Response } from 'express';

import abortManager from '../utils/abortManager.js';

// Extend Express Request interface to include abort properties
declare global {
  namespace Express {
    interface Request {
      abortId?: string;
      abortController?: AbortController;
    }
  }
}

function attachAbortController(req: Request, res: Response, next: NextFunction): void {
  const { id, controller } = abortManager.create();

  req.abortId = id;
  req.abortController = controller;

  const cleanup = (): void => {
    if (!controller.signal.aborted) {
      controller.abort(new Error('client-disconnect'));
    }
    abortManager.abort(id);
  };

  req.on('close', cleanup);
  res.on('finish', cleanup);

  next();
}

export default attachAbortController;
