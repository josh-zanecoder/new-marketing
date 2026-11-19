/**
 * Prefer the CampaignRecipient ledger (or delivery-report counts) when the
 * optimistic / stale status-poll snapshot lags behind a finished send.
 */

import {
  CAMPAIGN_STATUS_FAILED,
  CAMPAIGN_STATUS_SENT
} from './constants/campaignTerminalStatus'
import {
  sendStatusFromCampaignRecipients,
  type CampaignRecipientDeliveryCounts,
  type CampaignRecipientDeliveryStatusRow
} from './campaignRecipientDeliveryCounts'

export type CampaignSendProgressSnapshot = {
  campaignId: string
  campaignStatus: string
  pending: number
  sent: number
  failed: number
  aborted: number
  total: number
  done: boolean
}

export function isCampaignSendTerminalStatus(
  status: string | null | undefined
): boolean {
  const s = String(status ?? '').trim()
  return s === CAMPAIGN_STATUS_SENT || s === CAMPAIGN_STATUS_FAILED
}

function snapshotFromDeliveryCounts(input: {
  campaignId: string
  campaignStatus: string
  counts: Pick<
    CampaignRecipientDeliveryCounts,
    'pending' | 'sending' | 'sent' | 'failed' | 'aborted' | 'total' | 'remaining'
  >
}): CampaignSendProgressSnapshot {
  const campaignStatus = String(input.campaignStatus || '').trim()
  return {
    campaignId: input.campaignId,
    campaignStatus,
    pending: input.counts.remaining,
    sent: input.counts.sent,
    failed: input.counts.failed,
    aborted: input.counts.aborted,
    total: input.counts.total,
    done: input.counts.remaining === 0 && campaignStatus !== 'Sending'
  }
}

function pollMatchesCampaign(
  poll: CampaignSendProgressSnapshot | null | undefined,
  campaignId: string
): poll is CampaignSendProgressSnapshot {
  if (!poll) return false
  if (poll.campaignId && poll.campaignId !== campaignId) return false
  return true
}

function ledgerIsAheadOfPoll(
  ledger: CampaignSendProgressSnapshot,
  poll: CampaignSendProgressSnapshot
): boolean {
  return (
    ledger.sent > poll.sent ||
    ledger.failed > poll.failed ||
    ledger.aborted > (poll.aborted ?? 0) ||
    ledger.pending < poll.pending ||
    (ledger.done && !poll.done)
  )
}

/**
 * Merge poll + detail/report delivery truth. When recipients already show Sent
 * (or the campaign is terminal) but the poll still has optimistic Pending, the
 * ledger wins so banner/modal match the recipient list.
 */
export function reconcileCampaignSendProgress(input: {
  campaignId: string
  campaignStatus?: string | null
  poll?: CampaignSendProgressSnapshot | null
  recipients?: CampaignRecipientDeliveryStatusRow[] | null
  deliveryCounts?: Pick<
    CampaignRecipientDeliveryCounts,
    'pending' | 'sending' | 'sent' | 'failed' | 'aborted' | 'total' | 'remaining'
  > | null
}): CampaignSendProgressSnapshot | null {
  const campaignId = input.campaignId
  const campaignStatus = String(
    input.campaignStatus ?? input.poll?.campaignStatus ?? ''
  ).trim()
  const poll = pollMatchesCampaign(input.poll ?? null, campaignId)
    ? input.poll!
    : null

  let ledger: CampaignSendProgressSnapshot | null = null
  if (input.deliveryCounts && input.deliveryCounts.total > 0) {
    ledger = snapshotFromDeliveryCounts({
      campaignId,
      campaignStatus: campaignStatus || poll?.campaignStatus || 'Sending',
      counts: input.deliveryCounts
    })
  } else if (input.recipients?.length) {
    const fromRows = sendStatusFromCampaignRecipients({
      campaignId,
      campaignStatus: campaignStatus || poll?.campaignStatus || 'Sending',
      recipients: input.recipients
    })
    if (fromRows.total > 0 || campaignStatus === 'Sending') {
      ledger = {
        ...fromRows,
        aborted: fromRows.aborted ?? 0
      }
    }
  }

  if (!poll && !ledger) return null
  if (!poll) return ledger
  if (!ledger) return { ...poll, aborted: poll.aborted ?? 0 }

  const terminal = isCampaignSendTerminalStatus(campaignStatus)
  if (terminal || ledgerIsAheadOfPoll(ledger, poll)) {
    return {
      ...ledger,
      campaignStatus: campaignStatus || ledger.campaignStatus,
      total: Math.max(poll.total, ledger.total),
      done:
        ledger.done ||
        (terminal && ledger.pending === 0) ||
        (poll.done && ledger.pending === 0)
    }
  }

  return { ...poll, aborted: poll.aborted ?? 0 }
}

/** True when in-flight send modal / optimistic poll UI should be released. */
export function shouldReleaseInFlightSendUi(input: {
  campaignId: string
  campaignStatus?: string | null
  sendingCampaignId?: string | null
  sendStatusCampaignId?: string | null
}): boolean {
  if (!isCampaignSendTerminalStatus(input.campaignStatus)) return false
  return (
    input.sendingCampaignId === input.campaignId ||
    input.sendStatusCampaignId === input.campaignId
  )
}
