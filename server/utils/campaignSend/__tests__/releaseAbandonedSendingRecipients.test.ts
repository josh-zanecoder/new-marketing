import { afterEach, describe, expect, it } from 'vitest'
import type { CampaignRecipientModel } from '../../../types/tenant/campaignRecipient.model'
import {
  abandonedSendingCutoff,
  releaseAbandonedSendingRecipients
} from '../releaseAbandonedSendingRecipients'

type Row = { campaign: string; status: string; updatedAt: Date; error?: string }

function fakeModel(rows: Row[]): CampaignRecipientModel {
  return {
    updateMany: async (
      filter: { campaign: string; status: string; updatedAt: { $lt: Date } },
      update: { $set: { status: string } }
    ) => {
      let modifiedCount = 0
      for (const row of rows) {
        if (
          row.campaign === filter.campaign &&
          row.status === filter.status &&
          row.updatedAt < filter.updatedAt.$lt
        ) {
          row.status = update.$set.status
          delete row.error
          modifiedCount += 1
        }
      }
      return { modifiedCount }
    }
  } as unknown as CampaignRecipientModel
}

describe('releaseAbandonedSendingRecipients', () => {
  const now = Date.parse('2026-10-13T15:30:00.000Z')
  const minutesAgo = (m: number) => new Date(now - m * 60_000)

  afterEach(() => {
    delete process.env.CAMPAIGN_SEND_RECONCILE_ACK_SENDING_MS
  })

  it('returns old sending rows to pending and leaves fresh or other rows alone', async () => {
    const rows: Row[] = [
      { campaign: 'c1', status: 'sending', updatedAt: minutesAgo(38), error: 'x' },
      { campaign: 'c1', status: 'sending', updatedAt: minutesAgo(1) },
      { campaign: 'c1', status: 'sent', updatedAt: minutesAgo(38) },
      { campaign: 'c2', status: 'sending', updatedAt: minutesAgo(38) }
    ]

    const released = await releaseAbandonedSendingRecipients(fakeModel(rows), 'c1', now)

    expect(released).toBe(1)
    expect(rows.map((r) => r.status)).toEqual(['pending', 'sending', 'sent', 'sending'])
    expect(rows[0]!.error).toBeUndefined()
  })

  it('never uses a cutoff shorter than one minute', () => {
    process.env.CAMPAIGN_SEND_RECONCILE_ACK_SENDING_MS = '1000'
    expect(abandonedSendingCutoff(now).getTime()).toBe(now - 60_000)
  })
})
