// utils/emailTemplates/passwordResetEmail.ts

export const passwordResetEmail = (
  username: string,
  rawToken: string,
  resetTokenTTL: string,
  server: string,
  hostname: string,
  port: string,
): string => {
  const year = new Date().getFullYear();

  return `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Password Reset - Slashoff.in</title>
      <style>
        :root {
          color-scheme: light dark;
          supported-color-schemes: light dark;
        }

        body {
          background-color: #f2f4f8;
          font-family: "Inter", "Segoe UI", Roboto, Arial, sans-serif;
          margin: 0;
          padding: 40px 0;
          -webkit-text-size-adjust: 100%;
        }

        @media (prefers-color-scheme: dark) {
          body {
            background-color: #0f172a;
            color: #e5e7eb;
          }

          .email-wrapper {
            background-color: #1e293b !important;
            color: #e5e7eb !important;
          }

          .footer {
            background-color: #111827 !important;
            color: #9ca3af !important;
          }

          .button {
            background-color: #22c1c3 !important;
            color: #ffffff !important;
          }

          .logo {
            color: #22c1c3 !important;
          }
        }

        .email-wrapper {
          max-width: 520px;
          margin: auto;
          background-color: #ffffff;
          border-radius: 10px;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
          overflow: hidden;
        }

        .header {
          text-align: center;
          padding: 30px 20px 10px;
        }

        .logo {
          font-size: 22px;
          font-weight: 700;
          color: #1b9c9c;
          margin-bottom: 6px;
        }

        .content {
          padding: 25px 30px 35px;
          color: #374151;
          font-size: 15px;
          line-height: 1.6;
        }

        .content p {
          margin: 0 0 15px;
        }

        .username {
          font-weight: 600;
          margin-bottom: 5px;
          color: #111827;
          text-align: left;
        }

        .button {
          display: inline-block;
          background-color: #1b9c9c;
          color: #ffffff !important;
          text-decoration: none;
          padding: 12px 26px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 15px;
          margin-top: 15px;
        }

        .button:hover {
          background-color: #178585;
        }

        .footer {
          background-color: #f9fafb;
          text-align: center;
          font-size: 13px;
          color: #9ca3af;
          padding: 20px;
        }

        .footer a {
          color: #1b9c9c;
          text-decoration: none;
        }
      </style>
    </head>

    <body>
      <div class="email-wrapper">
        <div class="header">
          <div class="logo">Slashoff.in</div>
        </div>

        <div class="content">
          <p class="username">Hi ${username},</p>

          <p>
            You requested to reset your password. Click the button below to
            continue. The link will expire in <strong>${resetTokenTTL}</strong> minutes.
          </p>

          <p style="text-align: center;">
            <a
              href="${server}://${hostname}:${port}/api/auth/reset-password?token=${rawToken}"
              target="_blank"
              rel="noopener noreferrer"
              class="button"
            >
              Reset Password
            </a>
          </p>

          <p style="font-size: 13px; color: #6b7280; margin-top: 20px;">
            If you didn’t request this, you can safely ignore this email.
          </p>
        </div>

        <div class="footer">
          © ${year} Slashoff.in. All rights reserved.
        </div>
      </div>
    </body>
  </html>
  `;
};
