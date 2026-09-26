import nodemailer from 'nodemailer';

const WEB_URL = process.env.WEB_URL || 'http://localhost:5173';

let transporter = null;
if (process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

/**
 * Send a password-reset email. In dev (no SMTP configured) the reset link is
 * logged to the console instead — never in production.
 */
export async function sendPasswordReset(toEmail, name, rawToken) {
  const resetUrl = `${WEB_URL}/reset-password?token=${encodeURIComponent(rawToken)}`;
  if (!transporter) {
    // Dev fallback only. The token is secret; this path must never run in prod.
    console.log(`[dev] Password reset requested for ${toEmail}. Reset link: ${resetUrl}`);
    return;
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'noreply@example.com',
    to: toEmail,
    subject: 'Reset your password',
    text:
      `Hi ${name || 'there'},\n\n` +
      `We received a request to reset your password. Open this link to choose a new one (valid for 1 hour):\n\n` +
      `${resetUrl}\n\n` +
      `If you did not request this, you can safely ignore this email.\n`,
  });
}
