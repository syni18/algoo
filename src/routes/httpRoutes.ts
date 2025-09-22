// src/routes/httpRoutes.ts
import { sendResponse } from '../utils/sendResponse.js';
import { Router } from 'express';

import { attachAbortController } from '../middlewares/attachAbortController.js';
import longRunningWork from '../utils/longWork.js';
import health from './v1-API/health.js';
const router = Router();

router.get('/', (req, res) => {
  return sendResponse({
    res,
    statusCode: 200,
    success: true,
    data: null,
    message: 'Root API is running',
    meta: {},
  });
});

// Array of all routes
const routeModules = [health];

routeModules.forEach((mod) => {
  router.use(mod.basePath, mod.router);
});

export default router;

router.get('/long-task', attachAbortController(200), async (req, res) => {
  const signal = req.abortController!.signal;

  try {
    const result = await longRunningWork(signal);
    res.json({ ok: true, result });
  } catch (err) {
    if (signal.aborted) {
      res.status(499).send({ status: 499, msg: 'Client Closed Request' });
    } else {
      res.status(500).json({ error: String(err) });
    }
  }
});

router.get('/stream-task', attachAbortController(200), async (req, res) => {
  const signal = req.abortController!.signal;

  // use chunked response
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Transfer-Encoding', 'chunked');

  try {
    // const result = await longRunningWork(res, signal);
    // res.write(`\nTask completed: ${result}\n`);
    res.end();
  } catch (err: any) {
    if (signal.aborted) {
      res.write('\nTask aborted!\n');
      res.end();
    } else {
      res.write(`\nError: ${String(err.message)}\n`);
      res.end();
    }
  }
});
