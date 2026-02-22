/**
 * Email Service
 *
 * Provides transactional email sending via nodemailer.
 * Falls back to console logging in development when SMTP is not configured.
 */

import nodemailer from 'nodemailer';

// -- Configuration -----------------------------------------------------------

const SMTP_HOST = process.env.SMTP_HOST ?? 'localhost';
const SMTP_PORT = parseInt(process.env.SMTP_PORT ?? '1025', 10);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER ?? '';
const SMTP_PASS = process.env.SMTP_PASS ?? '';
const SMTP_FROM = process.env.SMTP_FROM ?? 'GlowCam <noreply@glowcam.com>';
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

// -- Transport ---------------------------------------------------------------

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    if (!SMTP_USER || !SMTP_PASS) {
      console.warn(
        '[Email] SMTP credentials not configured. Emails will be logged to console.',
      );
    }

    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth:
        SMTP_USER && SMTP_PASS
          ? {
              user: SMTP_USER,
              pass: SMTP_PASS,
            }
          : undefined,
    });
  }
  return transporter;
}

// -- Shared HTML Layout ------------------------------------------------------

function wrapInLayout(title: string, bodyHtml: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #FF6B8A, #8B5CF6); padding: 32px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">GlowCam</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 40px 32px;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #fafafa; text-align: center; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; color: #a1a1aa; font-size: 12px; line-height: 1.5;">
                &copy; ${new Date().getFullYear()} GlowCam. All rights reserved.<br />
                This email was sent from a no-reply address. Please do not reply directly.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

// -- Send Helper -------------------------------------------------------------

async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  // In development without SMTP, log instead of sending
  if (process.env.NODE_ENV === 'development' && (!SMTP_USER || !SMTP_PASS)) {
    console.log('[Email] Would send to:', to);
    console.log('[Email] Subject:', subject);
    console.log('[Email] Body preview:', html.slice(0, 300), '...');
    return;
  }

  try {
    const transport = getTransporter();
    await transport.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error('[Email] Failed to send email:', {
      to,
      subject,
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  }
}

// -- Public API --------------------------------------------------------------

/**
 * Send a password reset email with the reset token link.
 */
export async function sendPasswordResetEmail(
  to: string,
  token: string,
): Promise<void> {
  const resetUrl = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`;

  const html = wrapInLayout(
    'Reset Your Password',
    `
    <h2 style="margin: 0 0 16px; color: #18181b; font-size: 20px;">Reset Your Password</h2>
    <p style="margin: 0 0 24px; color: #52525b; font-size: 15px; line-height: 1.6;">
      We received a request to reset your password. Click the button below to choose a new password.
      This link will expire in 30 minutes.
    </p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${resetUrl}"
         style="display: inline-block; background: linear-gradient(135deg, #FF6B8A, #FF3366); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600;">
        Reset Password
      </a>
    </div>
    <p style="margin: 0; color: #71717a; font-size: 13px; line-height: 1.6;">
      If you didn't request a password reset, you can safely ignore this email.
      Your password will remain unchanged.
    </p>
    `,
  );

  await sendEmail(to, 'Reset Your GlowCam Password', html);
}

/**
 * Send a welcome email to a newly registered user.
 */
export async function sendWelcomeEmail(
  to: string,
  name: string,
): Promise<void> {
  const html = wrapInLayout(
    'Welcome to GlowCam',
    `
    <h2 style="margin: 0 0 16px; color: #18181b; font-size: 20px;">Welcome, ${escapeHtml(name)}!</h2>
    <p style="margin: 0 0 24px; color: #52525b; font-size: 15px; line-height: 1.6;">
      Thank you for joining GlowCam. We're excited to help you capture and enhance your most beautiful moments.
    </p>
    <p style="margin: 0 0 16px; color: #52525b; font-size: 15px; line-height: 1.6;">
      Here's what you can do to get started:
    </p>
    <ul style="margin: 0 0 24px; padding-left: 20px; color: #52525b; font-size: 15px; line-height: 2;">
      <li>Open the camera and try our beauty filters</li>
      <li>Explore AI-powered enhancements</li>
      <li>Create albums to organize your photos</li>
      <li>Share your favorite shots with friends</li>
    </ul>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${APP_URL}"
         style="display: inline-block; background: linear-gradient(135deg, #FF6B8A, #FF3366); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600;">
        Open GlowCam
      </a>
    </div>
    `,
  );

  await sendEmail(to, 'Welcome to GlowCam!', html);
}

/**
 * Send a notification email when a support ticket is updated.
 */
export async function sendTicketUpdateEmail(
  to: string,
  ticketId: string,
  message: string,
): Promise<void> {
  const ticketUrl = `${APP_URL}/support/tickets/${encodeURIComponent(ticketId)}`;

  const html = wrapInLayout(
    'Support Ticket Update',
    `
    <h2 style="margin: 0 0 16px; color: #18181b; font-size: 20px;">Your Support Ticket Has Been Updated</h2>
    <p style="margin: 0 0 16px; color: #52525b; font-size: 15px; line-height: 1.6;">
      Our team has replied to your support request:
    </p>
    <div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px; margin: 0 0 24px; border-left: 4px solid #FF6B8A;">
      <p style="margin: 0; color: #3f3f46; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(message)}</p>
    </div>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${ticketUrl}"
         style="display: inline-block; background: linear-gradient(135deg, #FF6B8A, #FF3366); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600;">
        View Ticket
      </a>
    </div>
    <p style="margin: 0; color: #71717a; font-size: 13px; line-height: 1.6;">
      Ticket ID: ${escapeHtml(ticketId)}
    </p>
    `,
  );

  await sendEmail(to, 'Support Ticket Update - GlowCam', html);
}

// -- Utilities ---------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
