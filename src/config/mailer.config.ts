// config/mailer.config.ts
import nodemailer from 'nodemailer';
import logger from 'logger/winston-logger';

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST!,
  port: Number(process.env.SMTP_PORT!),
  secure: false,
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!
  }
});

// Verify transporter on startup
export async function verifyMailerConnection() {
  try {
    logger.info(`Verifying SMTP transporter... ${JSON.stringify(transporter.options)}`);
    await transporter.verify();
    logger.info("SMTP transporter verified successfully");
    return true;
  } catch (err) {
    logger.error("Failed to verify SMTP connection", { error: err });
    throw new Error("SMTP connection failed");
  }
}

async function sendMail() {
  const info = await transporter.sendMail({
    from: process.env.SMTP_SENDER!,
    to: "csesai07@gmail.com",
    subject: "Test Email from Titan SMTP",
    text: "Hello from Titan SMTP!",
    html: "<p>Hello from <b>Titan SMTP</b>!</p>",
  });

  console.log("Message sent: %s", info.messageId);
}

sendMail().catch(console.error);