import EventEmitter from 'events';
import { Worker } from 'worker_threads';

import { Job } from '../interfaces.js';

export class WorkerPool extends EventEmitter {
  private workers: Worker[] = [];
  private busyWorkers: Set<Worker> = new Set();
  private jobQueue: Job[] = [];
  private jobCounter = 0;

  constructor(
    private workerScriptPath: string,
    private poolSize: number,
  ) {
    super();
    for (let i = 0; i < poolSize; i++) this.spawnWorker();
  }

  private spawnWorker() {
    const isTsFile = this.workerScriptPath.endsWith('.ts');

    const worker = new Worker(this.workerScriptPath, {
      execArgv: isTsFile ? ['--loader', 'ts-node/esm'] : [], // 👈 use ts-node only for .ts
    });

    worker.on('message', (msg) => this.finishJob(worker, msg));
    worker.on('error', (err) => {
      this.emit('error', err, worker);
      this.respawnWorker(worker);
    });
    worker.on('exit', (code) => {
      this.emit('exit', code, worker);
      if (code !== 0) this.respawnWorker(worker);
    });

    this.workers.push(worker);
  }

  private respawnWorker(deadWorker: Worker) {
    this.busyWorkers.delete(deadWorker);
    this.workers = this.workers.filter((w) => w !== deadWorker);
    this.spawnWorker();
    this.processQueue();
  }

  private activeJobMap = new Map<Worker, Job>();

  private finishJob(worker: Worker, msg: any) {
    const job = this.activeJobMap.get(worker);
    if (!job) return; // stray message
    clearTimeout(job.timeout);
    job.resolve(msg);
    this.activeJobMap.delete(worker);
    this.busyWorkers.delete(worker);
    this.processQueue();
  }

  private processQueue() {
    if (this.jobQueue.length === 0) return;
    const availableWorker = this.workers.find((w) => !this.busyWorkers.has(w));
    if (!availableWorker) return;

    const job = this.jobQueue.shift()!;
    this.busyWorkers.add(availableWorker);
    this.activeJobMap.set(availableWorker, job);

    // Timeout handler (optional)
    if (job.timeout) clearTimeout(job.timeout);
    job.timeout = setTimeout(() => {
      job.reject(new Error('Job timed out'));
      this.activeJobMap.delete(availableWorker);
      this.busyWorkers.delete(availableWorker);
      this.processQueue();
    }, Number(process.env.WORKERPOOL_TIMEOUTMS)); // e.g., 5 seconds

    availableWorker.postMessage(job.message);
  }

  // Submit a job, returns promise resolved/rejected on result/error
  public runJob(message: any, timeoutMs = Number(process.env.WORKERPOOL_DEFAULT_MS)): Promise<any> {
    return new Promise((resolve, reject) => {
      const job: Job = {
        id: ++this.jobCounter,
        message,
        resolve,
        reject,
      };
      job.timeout = setTimeout(() => {
        reject(new Error('Job timed out'));
        // If job timeout fires before run, clean from queue
        this.jobQueue = this.jobQueue.filter((j) => j.id !== job.id);
      }, timeoutMs);
      this.jobQueue.push(job);
      this.processQueue();
    });
  }

  // Gracefully stop all workers
  public async close(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.terminate()));
    this.workers = [];
    this.busyWorkers.clear();
    this.activeJobMap.clear();
  }
}
