import nodemailer from 'nodemailer';
import dns from 'node:dns/promises';
import net from 'node:net';
import { env } from '../config/env.ts';

const isSmtpConfigured = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
const isResendConfigured = Boolean(env.RESEND_API_KEY);

async function getSmtpTransporter() {
  if (!isSmtpConfigured) return null;

  let host = env.SMTP_HOST!;
  const servername = host;

  // On Render and cloud container platforms without IPv6 outbound routing,
  // resolve hostname to an explicit IPv4 address to prevent ENETUNREACH errors.
  if (!net.isIP(host)) {
    try {
      const res = await dns.lookup(host, { family: 4 });
      if (res?.address) {
        host = res.address;
      }
    } catch (err) {
      console.warn('[EmailService] DNS IPv4 lookup failed, using original hostname:', err);
    }
  }

  return nodemailer.createTransport({
    host,
    port: env.SMTP_PORT ?? 587,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
    tls: {
      servername,
    },
  });
}

/**
 * Sends an email notification when a ticket's status changes.
 * Prioritizes Resend HTTPS REST API (which bypasses cloud container SMTP firewall blocks).
 * Falls back to SMTP if Resend is not configured.
 * Silently skips if neither is configured.
 */
export async function sendStatusChangeEmail(
  to: string,
  ticketId: string,
  fromStatus: string,
  toStatus: string,
  note?: string
): Promise<void> {
  const statusLabel = (s: string) => s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  const subject = `[${ticketId}] Status updated to ${statusLabel(toStatus)}`;
  const html = `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; color: #1e293b;">
      <h2 style="margin-top: 0; margin-bottom: 8px; color: #0f172a; font-size: 20px;">Ticket Status Update</h2>
      <p style="font-size: 15px; margin: 4px 0 16px 0; color: #475569;">
        Ticket <strong>#${ticketId}</strong> has been updated.
      </p>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px 16px; margin-bottom: 16px;">
        <p style="margin: 0; font-size: 14px; line-height: 1.6;">
          <strong>Status:</strong> <span style="color: #64748b; text-decoration: line-through;">${statusLabel(fromStatus)}</span> &rarr; <span style="color: #0284c7; font-weight: 600;">${statusLabel(toStatus)}</span>
        </p>
        ${note ? `<p style="margin: 10px 0 0 0; padding-top: 10px; border-top: 1px dashed #cbd5e1; font-size: 14px; color: #334155;"><strong>Note:</strong> ${note}</p>` : ''}
      </div>
      <p style="margin-bottom: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
        This is an automated notification from your Helpdesk Support Team.
      </p>
    </div>
  `;

  // 1. Priority: Resend REST API over HTTPS (port 443)
  if (isResendConfigured && env.RESEND_API_KEY) {
    const from = env.EMAIL_FROM ?? env.SMTP_FROM ?? 'Helpdesk <onboarding@resend.dev>';
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          html,
        }),
      });

      const result = (await response.json().catch(() => ({}))) as { id?: string; message?: string; error?: unknown };

      if (!response.ok) {
        console.error(`[EmailService] Resend API error (${response.status}):`, result.message || result);
        return;
      }

      console.log(`[EmailService] Status change email dispatched via Resend API (id: ${result.id}) for ticket ${ticketId} to ${to}`);
      return;
    } catch (err) {
      console.error('[EmailService] Failed to send email via Resend API:', err);
      return;
    }
  }

  // 2. Fallback: SMTP via Nodemailer
  if (isSmtpConfigured) {
    try {
      const transporter = await getSmtpTransporter();
      if (!transporter) return;

      const from = env.SMTP_FROM ?? env.EMAIL_FROM ?? 'Helpdesk <noreply@helpdesk.com>';
      await transporter.sendMail({
        from,
        to,
        subject,
        html,
      });

      console.log(`[EmailService] Status change email dispatched via SMTP for ticket ${ticketId} to ${to}`);
      return;
    } catch (err) {
      console.error('[EmailService] Failed to send email via SMTP:', err);
      return;
    }
  }

  console.log(`[EmailService] Neither Resend nor SMTP is configured. Skipped email for ticket ${ticketId} to ${to}`);
}
