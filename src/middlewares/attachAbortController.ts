// middleware/attachAbortController.ts
import type { NextFunction, Request, Response } from 'express';

import { abortManager } from '../utils/abort.js';

export function attachAbortController(timeoutMs?: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { id, controller } = abortManager.create(timeoutMs);

    req.abortId = id;
    req.abortController = controller;

    const cleanup = () => abortManager.abort(id);

    req.on('close', cleanup);
    res.on('finish', cleanup);

    next();
  };
}
