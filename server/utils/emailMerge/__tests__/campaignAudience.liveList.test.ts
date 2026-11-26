/* eslint-disable import/first -- vi.mock must precede the imports it replaces */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Connection } from 'mongoose'
import type { CampaignLean } from '@server/types/tenant/campaign.model'

const resolveRecipientListEmails = vi.fn()
const manualFind = vi.fn()
const contactFind = vi.fn()

vi.mock('@server/utils/recipient/resolveRecipientListEmails', () => ({
  resolveRecipientListEmails: (...args: unknown[]) => resolveRecipientListEmails(...args)
}))
vi.mock('@server/models/tenant/tenantClientModels', () => ({
  getTenantClientModels: () => ({
    ManualRecipient: { find: manualFind },
    Contact: { find: contactFind }
  })
}))

import { recipientEmailsForCampaign } from '../campaignAudience'

const conn = {} as Connection
const LIST = '65f0c0ffee0000000000aaaa'

function campaign(over: Partial<CampaignLean>): CampaignLean {
  return {
    _id: '65f0c0ffee0000000000cccc',
    recipientsType: 'list',
    recipientsListId: LIST,
    ...over
  } as unknown as CampaignLean
}

describe('recipientEmailsForCampaign — live vs snapshot', () => {
  beforeEach(() => {
    resolveRecipientListEmails.mockReset()
    manualFind.mockReset()
    contactFind.mockReset()
    // No unsubscribed contacts unless a test says otherwise.
    contactFind.mockReturnValue({ select: () => ({ lean: async () => [] }) })
  })

  it('a filter-built campaign reads the list as it is at send time, ignoring any snapshot', async () => {
    resolveRecipientListEmails.mockResolvedValue(['A@x.com', 'a@x.com', 'b@x.com'])
    const out = await recipientEmailsForCampaign(conn, campaign({ liveListAudience: true }))
    expect(resolveRecipientListEmails).toHaveBeenCalledWith(conn, LIST)
    expect(manualFind).not.toHaveBeenCalled()
    expect(out).toEqual(['a@x.com', 'b@x.com'])
  })

  it('reflects a changed audience on the next send (same campaign, new membership)', async () => {
    resolveRecipientListEmails.mockResolvedValueOnce(['a@x.com', 'b@x.com'])
    resolveRecipientListEmails.mockResolvedValueOnce(['b@x.com', 'c@x.com'])
    const live = campaign({ liveListAudience: true })
    expect(await recipientEmailsForCampaign(conn, live)).toEqual(['a@x.com', 'b@x.com'])
    // Contact a moved to another loan officer / status, contact c now qualifies.
    expect(await recipientEmailsForCampaign(conn, live)).toEqual(['b@x.com', 'c@x.com'])
  })

  it('a classic list campaign still uses its saved snapshot', async () => {
    manualFind.mockReturnValue({ lean: async () => [{ contact: '65f0c0ffee0000000000dddd' }] })
    contactFind.mockReturnValue({
      select: () => ({
        lean: async () => [{ _id: '65f0c0ffee0000000000dddd', email: 'snap@x.com' }]
      })
    })
    const out = await recipientEmailsForCampaign(conn, campaign({ liveListAudience: false }))
    expect(resolveRecipientListEmails).not.toHaveBeenCalled()
    expect(out).toEqual(['snap@x.com'])
  })

  it('never sends to an address whose other contact is unsubscribed (same rule the preview applies)', async () => {
    resolveRecipientListEmails.mockResolvedValue(['a@x.com', 'b@x.com', 'c@x.com'])
    contactFind.mockReturnValue({
      select: () => ({ lean: async () => [{ email: 'B@x.com' }] })
    })
    const out = await recipientEmailsForCampaign(conn, campaign({ liveListAudience: true }))
    expect(out).toEqual(['a@x.com', 'c@x.com'])
    const query = contactFind.mock.calls[0]![0] as Record<string, unknown>
    expect(query.isUnsubscribe).toBe(true)
  })
})
