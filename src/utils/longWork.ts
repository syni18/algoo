import logger from '../logger/winston-logger';

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('aborted'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new Error('aborted'));
    });
  });
}

async function longRunningWork(signal?: AbortSignal): Promise<string> {
  for (let i = 0; i < 10; i++) {
    logger.info(`Long work chunk ${i} : ${signal?.aborted}`);
    if (signal?.aborted) throw new Error('aborted');
    logger.info('Processing chunk', i);
    await sleep(1000, signal);
  }
  return 'done';
}

// async function longRunningWork(res?: { write: (chunk: string) => void }, signal?: AbortSignal): Promise<string> {
//   for (let i = 0; i < 20; i++) {
//     if (signal?.aborted) throw new Error("aborted");

//     if (res) {
//       // send chunk to client
//       res.write(`chunk ${i}\n`);
//     } else {
//       // fallback to console logging when no response object
//       console.log("Processing chunk", i);
//     }

//     // wait 1s
//     await sleep(1000, signal);
//   }
//   return "done";
// }

export default longRunningWork;
