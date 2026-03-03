import { Resend } from 'resend';
import logger from '../utils/logger';

const EMAIL_FROM = process.env.EMAIL_FROM || 'TimeHarbor <noreply@timeharbor.com>';

// Lazy-initialize so a missing/placeholder key doesn't crash the server on startup
let _resend: Resend | null = null;
function getResendClient(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || apiKey.startsWith('re_xxx')) {
      throw new Error('RESEND_API_KEY is not configured. Set a real key in your .env file.');
    }
    _resend = new Resend(apiKey);
  }
  return _resend;
}

export const sendPasswordResetEmail = async (to: string, resetLink: string): Promise<void> => {
  const resend = getResendClient();

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to,
    subject: 'Reset your TimeHarbor password',
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Reset your password</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; margin: 0; padding: 40px 20px;">
        <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.07);">
          <div style="background: #2563eb; padding: 32px 40px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">TimeHarbor</h1>
          </div>
          <div style="padding: 40px;">
            <h2 style="color: #111827; font-size: 20px; margin: 0 0 16px;">Reset your password</h2>
            <p style="color: #6b7280; font-size: 15px; line-height: 1.6; margin: 0 0 28px;">
              We received a request to reset the password for your TimeHarbor account.
              Click the button below to choose a new password. This link expires in <strong>1 hour</strong>.
            </p>
            <a href="${resetLink}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; padding: 14px 32px; border-radius: 8px;">
              Reset Password
            </a>
            <p style="color: #9ca3af; font-size: 13px; margin: 28px 0 0; line-height: 1.6;">
              If you didn't request a password reset, you can safely ignore this email —
              your password won't be changed.
            </p>
            <p style="color: #9ca3af; font-size: 12px; margin: 16px 0 0; word-break: break-all;">
              Or copy this link: ${resetLink}
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
  });

  if (error) {
    logger.error('Failed to send password reset email', { to, error });
    throw new Error(`Email send failed: ${error.message}`);
  }

  logger.info(`Password reset email sent to ${to}`);
};
