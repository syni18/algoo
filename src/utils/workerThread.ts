import EventEmitter from 'events';
import path from "path";
import { fileURLToPath } from "url";
import os from 'os';
import { Worker } from 'worker_threads';
import { Job } from '../interfaces';
import logger from '../logger/winston-logger';

// ✅ CRITICAL: Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type WorkerPoolOptions = {
  workerScriptPath: string;
  poolSize?: number;
  jobDefaultTimeoutMs?: number;
  respawnBackoffMs?: number;
};

export class WorkerPool extends EventEmitter {
  private workers: Worker[] = [];
  private busyWorkers: Set<Worker> = new Set();
  private jobQueue: Job[] = [];
  private jobCounter = 0;
  private activeJobMap = new Map<Worker, Job>();
  private shuttingDown = false;
  private respawnCounts = new Map<string, number>();

  public readonly poolSize: number;
  private readonly workerScriptPath: string;
  private readonly jobDefaultTimeoutMs: number;
  private readonly respawnBackoffMs: number;


  constructor(opts: WorkerPoolOptions) {
    super();
    // ✅ VALIDATE INPUT
    if (!opts || typeof opts.workerScriptPath !== 'string') {
      throw new Error(
        `WorkerPool requires 'workerScriptPath' as string, got: ${typeof opts?.workerScriptPath}\n` +
        `Received opts: ${JSON.stringify(opts, null, 2)}`
      );
    }

    // ✅ Handle both absolute and relative paths
    this.workerScriptPath = path.isAbsolute(opts.workerScriptPath)
      ? opts.workerScriptPath
      : path.resolve(__dirname, opts.workerScriptPath);
    this.poolSize = opts.poolSize ?? Math.max(1, Math.floor(os.cpus().length / 2));
    this.jobDefaultTimeoutMs = opts.jobDefaultTimeoutMs ?? Number(process.env.WORKERPOOL_DEFAULT_MS ?? 30_000);
    this.respawnBackoffMs = opts.respawnBackoffMs ?? 1000;

    for (let i = 0; i < this.poolSize; i++) this.spawnWorker();
  }

  private spawnWorker() {
    const isTsFile = this.workerScriptPath.endsWith('.ts');

    const worker = new Worker(this.workerScriptPath, {
      execArgv: isTsFile ? [
          '--loader', 'ts-node/esm',
          '--experimental-specifier-resolution=node',  // 👈 Allow extension-less imports
          '--no-warnings'
        ] : [], // 👈 use ts-node only for .ts
    });

    this.emit("worker:spawn", { pid: worker.threadId });
    worker.on('message', (msg) => this.finishJob(worker, msg));
    worker.on("error", (err) => {
      this.emit("worker:error", {
        err,
        pid: worker.threadId,
        message: err.message,
        stack: err.stack
      });
      logger.error(`❌ Worker ${worker.threadId} error:`, err);
      this.respawnWorker(worker);
    });

    worker.on("exit", (code) => {
      this.emit("worker:exit", { code, pid: worker.threadId });
      logger.warn(`⚠️ Worker ${worker.threadId} exited with code ${code}`);
      if (code !== 0) this.respawnWorker(worker);
    });

    this.workers.push(worker);
  }

  private async respawnWorker(deadWorker: Worker) {
    try {
      // clean up busy state & active job
      const activeJob = this.activeJobMap.get(deadWorker);
      if (activeJob) {
        this.activeJobMap.delete(deadWorker);
        // reject active job so caller knows
        activeJob.reject(new Error("Worker terminated unexpectedly"));
      }
      this.busyWorkers.delete(deadWorker);
      this.workers = this.workers.filter((w) => w !== deadWorker);

      // Simple crash loop protection: backoff if respawned too often
      const key = this.workerScriptPath;
      const count = (this.respawnCounts.get(key) || 0) + 1;
      this.respawnCounts.set(key, count);
      const backoff = Math.min(this.respawnBackoffMs * count, 30_000);
      setTimeout(() => {
        if (!this.shuttingDown) {
          this.spawnWorker();
          // reset count after some time
          setTimeout(() => this.respawnCounts.set(key, Math.max((this.respawnCounts.get(key) || 1) - 1, 0)), 60_000);
        }
      }, backoff);
      this.processQueue();
    } catch (err) {
      this.emit("error", err);
    }
  }


  private finishJob(worker: Worker, msg: any) {
    const job = this.activeJobMap.get(worker);
    if (!job) {
      // stray message: ignore but emit for visibility
      this.emit("worker:strayMessage", { pid: worker.threadId, msg });
      return;
    }
    // clear job-specific timeout
    if (job.timeout) {
      clearTimeout(job.timeout);
      job.timeout = null;
    }
    // settle promise
    try {
      job.resolve(msg);
      this.emit("job:success", { jobId: job.id, workerPid: worker.threadId });
    } catch (err) {
      job.reject(err);
      this.emit("job:fail", { jobId: job.id, workerPid: worker.threadId, err });
    }

    this.activeJobMap.delete(worker);
    this.busyWorkers.delete(worker);
    // process next queued job
    setImmediate(() => this.processQueue());
  }

  private processQueue() {
    if (this.shuttingDown) return;
    if (this.jobQueue.length === 0) return;
    const availableWorker = this.workers.find((w) => !this.busyWorkers.has(w));
    if (!availableWorker) return;

    const job = this.jobQueue.shift()!;
    this.busyWorkers.add(availableWorker);
    this.activeJobMap.set(availableWorker, job);

    // Clear pre-queue timeout (if any) to avoid double-timeout race
    if (job.timeout) {
      clearTimeout(job.timeout);
      job.timeout = null;
    }
    // Setup execution timeout
    const execTimeout = setTimeout(() => {
      // If the job remains active after timeout, reject and kill the worker to avoid stuck processes.
      const active = this.activeJobMap.get(availableWorker);
      if (active && active.id === job.id) {
        active.reject(new Error("Job timed out (execution)"));
        // Best-effort cleanup - terminate worker and spawn a fresh one
        try {
          availableWorker.terminate();
        } catch (err) {
          // ignore
        }
        this.activeJobMap.delete(availableWorker);
        this.busyWorkers.delete(availableWorker);
        this.processQueue();
      }
    }, this.jobDefaultTimeoutMs);

    job.timeout = execTimeout;

    // Emit start event for monitoring
    this.emit("job:start", { jobId: job.id, workerPid: availableWorker.threadId, queuedAt: job.createdAt ?? Date.now() });

    // Post the message
    try {
      availableWorker.postMessage(job.message);
    } catch (err) {
      // posting failed; clean up and reject
      if (job.timeout) {
        clearTimeout(job.timeout);
        job.timeout = null;
      }
      this.activeJobMap.delete(availableWorker);
      this.busyWorkers.delete(availableWorker);
      job.reject(err);
      this.emit("job:fail", { jobId: job.id, workerPid: availableWorker.threadId, err });
      this.processQueue();
    }
  }

  // Submit a job, returns promise resolved/rejected on result/error
  public runJob(message: any, timeoutMs?: number): Promise<any> {
    if (this.shuttingDown) return Promise.reject(new Error("WorkerPool is shutting down"));
    return new Promise((resolve, reject) => {
      const id = ++this.jobCounter;
      const job: Job = {
        id,
        message,
        resolve,
        reject,
        createdAt: Date.now(),
      };

      // pre-queue timeout to avoid indefinite queuing
      const preQueueTimeoutMs = timeoutMs ?? Number(process.env.WORKERPOOL_QUEUETIMEOUT_MS ?? 60_000);
      job.timeout = setTimeout(() => {
        // if still in queue, remove it and reject
        const exists = this.jobQueue.find((j) => j.id === id);
        if (exists) {
          this.jobQueue = this.jobQueue.filter((j) => j.id !== id);
          reject(new Error("Job timed out (queue)"));
        }
      }, preQueueTimeoutMs);

      this.jobQueue.push(job);
      // kick processing
      setImmediate(() => this.processQueue());
    });
  }

  // Gracefully stop all workers
  public async close(timeoutMs = 30_000): Promise<void> {
    this.shuttingDown = true;
    // wait for in-flight jobs or terminate workers after timeout
    const stop = new Promise<void>((resolve) => {
      const timer = setTimeout(async () => {
        // Force terminate remaining workers
        await Promise.all(this.workers.map((w) => w.terminate().catch(() => { })));
        this.workers = [];
        this.busyWorkers.clear();
        this.activeJobMap.clear();
        resolve();
      }, timeoutMs);

      // If all workers idle, resolve early
      const checkIdle = () => {
        if (this.busyWorkers.size === 0) {
          clearTimeout(timer);
          resolve();
        } else {
          setTimeout(checkIdle, 200);
        }
      };
      checkIdle();
    });

    await stop;
    this.emit("shutdown");
  }
}
