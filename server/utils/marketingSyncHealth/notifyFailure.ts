import { sendEmail } from '@server/services/brevo.service'
import {
  DEFAULT_CAMPAIGN_SENDER_EMAIL,
  DEFAULT_CAMPAIGN_SENDER_NAME
} from '~~/shared/defaultCampaignSender'
import {
  claimMarketingSyncAlertNotifySlot,
  getMarketingSyncAlertEmails
} from './alertSettings'

export type MarketingSyncFailureNotifyInput = {
  kind: 'error' | 'dlq' | 'worker'
  error: string
  dbName?: string
  tenantId?: string
  eventType?: string
  kafkaTopic?: string
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fingerprintFor(input: MarketingSyncFailureNotifyInput): string {
  const scope = input.dbName || input.tenantId || 'worker'
  const err = String(input.error || '')
    .trim()
    .slice(0, 120)
    .toLowerCase()
  // Mongo dotted-path safe (no `.` / `$`).
  return `${input.kind}:${scope}:${err}`.replace(/[.$]/g, '_')
}

/**
 * Email configured ops recipients when sync ingest fails.
 * Fire-and-forget safe: never throws to the caller path.
 */
export async function notifyMarketingSyncHealthFailure(
  input: MarketingSyncFailureNotifyInput
): Promise<void> {
  try {
    const error = String(input.error || '').trim()
    if (!error) return

    const emails = await getMarketingSyncAlertEmails()
    if (emails.length === 0) return

    const fingerprint = fingerprintFor(input)
    const claimed = await claimMarketingSyncAlertNotifySlot(fingerprint)
    if (!claimed) return

    const kindLabel =
      input.kind === 'dlq' ? 'Dead letter' : input.kind === 'worker' ? 'Worker' : 'Sync error'
    const subjectParts = [
      `[Sync health] ${kindLabel}`,
      input.dbName ? input.dbName : null,
      error.slice(0, 80)
    ].filter(Boolean)

    const lines = [
      `<p><strong>${escapeHtml(kindLabel)}</strong></p>`,
      `<p>${escapeHtml(error)}</p>`,
      '<ul>',
      input.dbName ? `<li><strong>dbName:</strong> ${escapeHtml(input.dbName)}</li>` : '',
      input.tenantId ? `<li><strong>tenantId:</strong> ${escapeHtml(input.tenantId)}</li>` : '',
      input.eventType ? `<li><strong>event:</strong> ${escapeHtml(input.eventType)}</li>` : '',
      input.kafkaTopic ? `<li><strong>topic:</strong> ${escapeHtml(input.kafkaTopic)}</li>` : '',
      `<li><strong>at:</strong> ${escapeHtml(new Date().toISOString())}</li>`,
      '</ul>',
      '<p style="color:#64748b;font-size:12px">Cooldownounced to at most once per hour per similar failure.</p>'
    ].filter(Boolean)

    const fromEmail =
      (process.env.SYNC_HEALTH_ALERT_FROM_EMAIL || '').trim() || DEFAULT_CAMPAIGN_SENDER_EMAIL
    const fromName =
      (process.env.SYNC_HEALTH_ALERT_FROM_NAME || '').trim() ||
      DEFAULT_CAMPAIGN_SENDER_NAME ||
      'Sync health'

    await sendEmail({
      sender: { email: fromEmail, name: fromName },
      to: emails.map((email) => ({ email })),
      subject: subjectParts.join(' · ').slice(0, 200),
      htmlContent: lines.join('\n'),
      tags: ['sync-health-alert', `kind:${input.kind}`]
    })
  } catch (err) {
    console.warn(
      '[sync-health] alert email failed',
      err instanceof Error ? err.message : String(err)
    )
  }
}

/** Non-blocking wrapper for store / kafka paths. */
export function queueNotifyMarketingSyncHealthFailure(
  input: MarketingSyncFailureNotifyInput
): void {
  void notifyMarketingSyncHealthFailure(input)
}
