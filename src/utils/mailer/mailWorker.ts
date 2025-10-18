// workers/mailWorker.ts
import { Job, Queue, Worker } from 'bullmq';
import { backOff } from 'exponential-backoff';

import { transporter } from '../../config/mailer.config';
import { query } from '../../config/postgres';
import { redisClient } from '../../config/redis';
import logger from '../../logger/winston-logger';

const QUEUE_NAME = 'email-queue';
const DLQ_NAME = 'email-dlq';

// DLQ for failed emails
export const dlqQueue = new Queue(DLQ_NAME, { connection: redisClient });

// Helper: Check if error is transient (retryable)
function isTransientSMTPError(err: any): boolean {
  if (!err) return false;

  const transientCodes = ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED'];
  if (err.code && transientCodes.includes(err.code)) return true;

  const msg = String(err.message || '').toLowerCase();
  return msg.includes('timeout') || msg.includes('temporary') || msg.includes('connection');
}

// Helper: Move job to DLQ
async function moveToDlq(job: Job) {
  await dlqQueue.add(
    'dlq_email',
    {
      originalJob: job.data,
      failedJobId: job.id,
      failedAt: new Date().toISOString(),
      attempts: job.attemptsMade,
      lastError: job.failedReason,
    },
    { removeOnComplete: true },
  );
  logger.warn('Job moved to DLQ', { jobId: job.id, to: job.data.to });
}

// Main worker
export const mailWorker = new Worker(
  QUEUE_NAME,
  async (job: Job) => {
    const { to, subject, html, attachments, auditId } = job.data;

    try {
      // Increment attempt count
      await query(
        `UPDATE email_audit SET attempt_count = attempt_count + 1, updated_at = now() WHERE id = $1`,
        [auditId],
      );

      // Send email with additional retry logic for transient errors
      await backOff(
        () =>
          transporter.sendMail({
            from: process.env.SMTP_SENDER!,
            to,
            subject,
            headers: {
              'X-Entity-Ref-ID': crypto.randomUUID(),
              'Message-ID': `<${crypto.randomUUID()}@${process.env.HOSTNAME!}>`,
            },
            html,
            ...(attachments && { attachments }),
          }),
        {
          jitter: 'full',
          numOfAttempts: 3,
          startingDelay: 500,
          retry: (e) => isTransientSMTPError(e),
        },
      );

      // Mark as sent
      await query(`UPDATE email_audit SET status = 'sent', updated_at = now() WHERE id = $1`, [
        auditId,
      ]);

      logger.info('Email sent successfully', {
        jobId: job.id,
        to,
        auditId,
        attempt: job.attemptsMade,
      });
    } catch (err: any) {
      const errorMsg = err?.message || 'Unknown error';
      logger.error('Email worker error', {
        jobId: job.id,
        to,
        error: errorMsg,
        attempt: job.attemptsMade,
      });

      // Determine if this is the final attempt
      const maxAttempts = job.opts.attempts || 5;
      const isFinalAttempt = job.attemptsMade >= maxAttempts;

      // Update audit status
      await query(
        `UPDATE email_audit 
         SET status = $1, failure_reason = $2, updated_at = now() 
         WHERE id = $3`,
        [
          isFinalAttempt ? 'failed' : 'queued',
          errorMsg.substring(0, 500), // Limit error message length
          auditId,
        ],
      );

      // Move to DLQ if final attempt
      if (isFinalAttempt) {
        await moveToDlq(job);
        await query(`UPDATE email_audit SET status = 'dlq', updated_at = now() WHERE id = $1`, [
          auditId,
        ]);
      }

      // Rethrow to let BullMQ handle retry logic
      throw err;
    }
  },
  {
    connection: redisClient,
    concurrency: 10,
    lockDuration: 60000, // 60 seconds
  },
);

// Event handlers
mailWorker.on('completed', (job) => {
  logger.info('Job completed', { jobId: job.id, to: job.data.to });
});

mailWorker.on('failed', (job, err) => {
  logger.error('Job failed', {
    jobId: job?.id,
    to: job?.data?.to,
    error: err?.message,
  });
});

mailWorker.on('error', (err) => {
  logger.error('Worker error', { error: err.message });
});
