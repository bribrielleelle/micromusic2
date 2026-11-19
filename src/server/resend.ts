import { getDb, isDatabaseConfigured } from '../db/index.ts';
import { emailAlerts } from '../db/schema.ts';

export type EmailAlertType =
  | 'dmca_notice'
  | 'dmca_resolution'
  | 'artist_verification'
  | 'moderation_flag'
  | 'admin_broadcast';

export interface SendAlertParams {
  to: string;
  alertType: EmailAlertType;
  subject: string;
  text: string;
  html?: string;
}

export interface SendAlertResult {
  deliveryStatus: 'sent' | 'logged_unconfigured' | 'failed';
  providerMessageId: string | null;
  errorMessage: string | null;
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim().length > 0);
}

export function getAdminAlertEmail(): string | null {
  const email = process.env.ADMIN_ALERT_EMAIL?.trim();
  return email && email.includes('@') ? email : null;
}

export async function sendResendAlert(params: SendAlertParams): Promise<SendAlertResult> {
  const recipient = params.to.trim();
  if (!recipient || !recipient.includes('@')) {
    return {
      deliveryStatus: 'failed',
      providerMessageId: null,
      errorMessage: 'Invalid recipient email address.',
    };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromAddress =
    process.env.RESEND_FROM_EMAIL?.trim() || 'SONA Alerts <onboarding@resend.dev>';

  let result: SendAlertResult;

  if (!apiKey) {
    result = {
      deliveryStatus: 'logged_unconfigured',
      providerMessageId: null,
      errorMessage:
        'RESEND_API_KEY is not configured; alert recorded in email_alerts log.',
    };
  } else {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [recipient],
          subject: params.subject,
          text: params.text,
          html:
            params.html ??
            `<div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#1F1B18;background:#F7F3EC;padding:24px;border:1px solid #DDD5C7;border-radius:8px;">
              <p style="margin:0 0 8px;font-size:12px;color:#B84A2E;font-weight:600;">SONA Fan-Centric Hub</p>
              <h2 style="margin:0 0 12px;font-size:18px;">${escapeHtml(params.subject)}</h2>
              <p style="margin:0;white-space:pre-wrap;font-size:14px;color:#5C534A;">${escapeHtml(params.text)}</p>
            </div>`,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        id?: string;
        message?: string;
        error?: { message?: string };
      };

      if (!response.ok) {
        result = {
          deliveryStatus: 'failed',
          providerMessageId: null,
          errorMessage:
            payload?.message ||
            payload?.error?.message ||
            `Resend API returned HTTP ${response.status}`,
        };
      } else {
        result = {
          deliveryStatus: 'sent',
          providerMessageId: payload.id ?? null,
          errorMessage: null,
        };
      }
    } catch (err) {
      result = {
        deliveryStatus: 'failed',
        providerMessageId: null,
        errorMessage: err instanceof Error ? err.message : 'Network error calling Resend API.',
      };
    }
  }

  if (isDatabaseConfigured()) {
    try {
      const db = getDb();
      await db.insert(emailAlerts).values({
        recipientEmail: recipient,
        alertType: params.alertType,
        subject: params.subject,
        providerMessageId: result.providerMessageId,
        deliveryStatus: result.deliveryStatus,
        errorMessage: result.errorMessage,
      });
    } catch (logErr) {
      console.warn('Unable to record email alert audit log:', logErr);
    }
  }

  return result;
}
