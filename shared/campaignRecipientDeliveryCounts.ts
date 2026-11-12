/**
 * Delivery tallies from campaign detail recipient rows (CampaignRecipient ledger).
 * `sending` is in-flight (claimed by a worker) and must not be ignored as "Pending: 0".
 */

export type CampaignRecipientDeliveryStatusRow = {
  status?: string | null
}

export type CampaignRecipientDeliveryCounts = {
  pending: number
  sending: number
  sent: number
  failed: number
  aborted: number
  total: number
  /** pending + sending — still waiting on delivery */
  remaining: number
}

export function countCampaignRecipientDeliveryStatuses(
  recipients: CampaignRecipientDeliveryStatusRow[] | null | undefined
): CampaignRecipientDeliveryCounts {
  const counts: CampaignRecipientDeliveryCounts = {
    pending: 0,
    sending: 0,
    sent: 0,
    failed: 0,
    aborted: 0,
    total: 0,
    remaining: 0
  }
  if (!recipients?.length) return counts

  for (const row of recipients) {
    const status = String(row?.status ?? '')
      .trim()
      .toLowerCase()
    if (!status) continue
    counts.total += 1
    if (status === 'pending') counts.pending += 1
    else if (status === 'sending') counts.sending += 1
    else if (status === 'sent') counts.sent += 1
    else if (status === 'failed') counts.failed += 1
    else if (status === 'aborted' || status === 'cancelled') counts.aborted += 1
  }
  counts.remaining = counts.pending + counts.sending
  return counts
}

/**
 * Build a poll-shaped progress snapshot from detail recipients when the status API
 * has not hydrated yet (avoids a permanent "loading delivery stats" banner).
 */
export function sendStatusFromCampaignRecipients(input: {
  campaignId: string
  campaignStatus: string
  recipients: CampaignRecipientDeliveryStatusRow[] | null | undefined
}): {
  campaignId: string
  campaignStatus: string
  pending: number
  sent: number
  failed: number
  aborted: number
  total: number
  done: boolean
} {
  const counts = countCampaignRecipientDeliveryStatuses(input.recipients)
  const campaignStatus = String(input.campaignStatus || '').trim()
  return {
    campaignId: input.campaignId,
    campaignStatus,
    pending: counts.remaining,
    sent: counts.sent,
    failed: counts.failed,
    aborted: counts.aborted,
    total: counts.total,
    done: counts.remaining === 0 && campaignStatus !== 'Sending'
  }
}
