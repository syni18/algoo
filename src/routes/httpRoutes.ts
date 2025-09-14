// src/routes/httpRoutes.ts
import longRunningWork from '../utils/longWork.js';
import { Router } from 'express';

import { attachAbortController } from '../middlewares/attachAbortController.js';
const router = Router();

router.get('/', (req, res) => {
  res.json({ message: 'API Root Working' });
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

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

export default router;
