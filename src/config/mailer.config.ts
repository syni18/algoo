// config/mailer.config.ts
import nodemailer from 'nodemailer';
import logger from 'logger/winston-logger';

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST!,
  port: Number(process.env.SMTP_PORT!),
  secure: Boolean(process.env.SMTP_SECURE!), // true for 465, false for other ports
  requireTLS: true,
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!
  },
  tls: {
    rejectUnauthorized: true,
    minVersion: 'TLSv1.2'
  }
});

// Verify transporter on startup
export async function verifyMailerConnection() {
  try {
    await transporter.verify();
    logger.info("✅ SMTP transporter verified successfully");
    return true;
  } catch (err) {
    logger.error("❌ Failed to verify SMTP connection", { error: err });
    throw new Error("SMTP connection failed");
  }
}
