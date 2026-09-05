import nodemailer from 'nodemailer';
import { env } from '../config/env.ts';

const isConfigured = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);

const transporter = isConfigured
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 587,
      secure: false,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    })
  : null;

/**
 * Sends an email notification when a ticket's status changes.
 * Silently skips if SMTP is not configured.
 */
export async function sendStatusChangeEmail(
  to: string,
  ticketId: string,
  fromStatus: string,
  toStatus: string,
  note?: string
): Promise<void> {
  if (!transporter) {
    console.log(`[EmailService] SMTP not configured. Skipped status change email for ticket ${ticketId} to ${to}`);
    return;
  }

  const statusLabel = (s: string) => s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());

  await transporter.sendMail({
    from: env.SMTP_FROM ?? 'Helpdesk <noreply@helpdesk.com>',
    to,
    subject: `[${ticketId}] Status updated to ${statusLabel(toStatus)}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px;">
        <h2 style="margin-bottom: 4px;">Ticket ${ticketId}</h2>
        <p>Status changed from <strong>${statusLabel(fromStatus)}</strong> to <strong>${statusLabel(toStatus)}</strong>.</p>
        ${note ? `<p style="color: #666; border-left: 3px solid #ddd; padding-left: 12px;">${note}</p>` : ''}
        <p style="margin-top: 24px; font-size: 13px; color: #999;">
          You're receiving this because you created this ticket.
        </p>
      </div>
    `,
  });

  console.log(`[EmailService] Status change email dispatched for ticket ${ticketId} to ${to}`);
}
