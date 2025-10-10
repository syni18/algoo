// admin/dlq.ts
import { Queue } from "bullmq";
import { redisClient } from "../../config/redis";
import { mailQueue } from "./emailEnqueue";
import logger from "logger/winston-logger";

const DLQ_NAME = "email-dlq";

// List all DLQ jobs
export async function listDlqJobs(limit = 100) {
  const dlq = new Queue(DLQ_NAME, { connection: redisClient });
  
  const jobs = await dlq.getJobs(
    ["waiting", "completed", "failed", "delayed"],
    0,
    limit
  );

  return jobs.map(job => ({
    id: job.id,
    data: job.data,
    attemptsMade: job.attemptsMade,
    failedReason: job.failedReason,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn
  }));
}

// Get specific DLQ job details
export async function getDlqJob(jobId: string) {
  const dlq = new Queue(DLQ_NAME, { connection: redisClient });
  const job = await dlq.getJob(jobId);
  
  if (!job) {
    throw new Error(`DLQ job ${jobId} not found`);
  }

  return {
    id: job.id,
    data: job.data,
    attemptsMade: job.attemptsMade,
    failedReason: job.failedReason,
    stacktrace: job.stacktrace,
    timestamp: job.timestamp
  };
}

// Requeue a DLQ job back to main queue
export async function requeueDlqJob(jobId: string) {
  const dlq = new Queue(DLQ_NAME, { connection: redisClient });
  const job = await dlq.getJob(jobId);

  if (!job) {
    throw new Error(`DLQ job ${jobId} not found`);
  }

  const payload = job.data.originalJob;

  // Add back to main queue
  const newJob = await mailQueue.add(
    `email:${payload.type || "generic"}`,
    payload,
    {
      attempts: 5,
      backoff: { type: "exponential", delay: 1000 }
    }
  );

  // Remove from DLQ
  await job.remove();

  logger.info("Job requeued from DLQ", { 
    dlqJobId: jobId, 
    newJobId: newJob.id,
    to: payload.to 
  });

  return { 
    dlqJobId: jobId, 
    newJobId: newJob.id,
    status: "requeued"
  };
}

// Bulk requeue multiple DLQ jobs
export async function requeueMultipleDlqJobs(jobIds: string[]) {
  const results = [];

  for (const jobId of jobIds) {
    try {
      const result = await requeueDlqJob(jobId);
      results.push({ jobId, success: true, ...result });
    } catch (err: any) {
      results.push({ jobId, success: false, error: err.message });
    }
  }

  return results;
}

// Delete a DLQ job permanently
export async function deleteDlqJob(jobId: string) {
  const dlq = new Queue(DLQ_NAME, { connection: redisClient });
  const job = await dlq.getJob(jobId);

  if (!job) {
    throw new Error(`DLQ job ${jobId} not found`);
  }

  await job.remove();
  logger.info("DLQ job deleted", { jobId });

  return { jobId, status: "deleted" };
}

// Get DLQ statistics
export async function getDlqStats() {
  const dlq = new Queue(DLQ_NAME, { connection: redisClient });
  
  const [waiting, completed, failed, delayed] = await Promise.all([
    dlq.getWaitingCount(),
    dlq.getCompletedCount(),
    dlq.getFailedCount(),
    dlq.getDelayedCount()
  ]);

  return {
    waiting,
    completed,
    failed,
    delayed,
    total: waiting + completed + failed + delayed
  };
}