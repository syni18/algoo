// services/email/emailEnqueue.ts
import { Queue } from "bullmq";
import { z } from "zod";
import { v4 as uuidv4 } from 'uuid';
import { redisClient } from "../../config/redis";
import { query } from "../../config/postgres";

// Single source of truth for mail queue
export const mailQueue = new Queue("email-queue", { connection: redisClient });

// Email validation schema
const EmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  html: z.string().min(1),
  type: z.string().optional().default("generic"),
  attachments: z.array(z.any()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export type EmailPayload = z.infer<typeof EmailSchema>;

// Main enqueue function
export async function enqueueMail(payloadRaw: unknown) {
  const parse = EmailSchema.safeParse(payloadRaw);
  if (!parse.success) {
    throw new Error(`Invalid email payload: ${parse.error.message}`);
  }

  const payload = parse.data;
  const auditId = uuidv4();

  // Create audit record
  const auditQuery = `
    INSERT INTO email_audit
      (id, job_id, to_email, subject, type, status, metadata, attempt_count)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id
  `;
  
  await query(auditQuery, [
    auditId,
    null, // job_id will be updated after queue.add
    payload.to,
    payload.subject,
    payload.type,
    "queued",
    payload.metadata ? JSON.stringify(payload.metadata) : '{}',
    0
  ]);

  // Add to queue
  const job = await mailQueue.add(
    `email:${payload.type}`,
    { ...payload, auditId },
    {
      attempts: 5,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: true,
      removeOnFail: false,
    }
  );

  // Update audit with job ID
  await query(
    `UPDATE email_audit SET job_id = $1, updated_at = now() WHERE id = $2`,
    [job.id!, auditId]
  );

  return { jobId: job.id, auditId };
}