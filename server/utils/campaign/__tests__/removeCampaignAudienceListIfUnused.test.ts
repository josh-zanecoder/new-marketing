/* eslint-disable import/first -- vi.mock must precede the imports it replaces */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Connection } from 'mongoose'

const campaignExists = vi.fn()
const listDeleteOne = vi.fn()
const memberDeleteMany = vi.fn()

vi.mock('@server/models/tenant/tenantClientModels', () => ({
  getTenantClientModels: () => ({
    Campaign: { exists: campaignExists },
    RecipientList: { deleteOne: listDeleteOne },
    RecipientListMember: { deleteMany: memberDeleteMany }
  })
}))

import { removeCampaignAudienceListIfUnused } from '../removeCampaignAudienceListIfUnused'

const conn = {} as Connection
const LIST = '65f0c0ffee0000000000aaaa'

describe('removeCampaignAudienceListIfUnused', () => {
  beforeEach(() => {
    campaignExists.mockReset()
    listDeleteOne.mockReset()
    memberDeleteMany.mockReset()
  })

  it('keeps the list while another campaign still follows it', async () => {
    campaignExists.mockResolvedValue({ _id: 'other' })
    expect(await removeCampaignAudienceListIfUnused(conn, LIST)).toBe(false)
    expect(listDeleteOne).not.toHaveBeenCalled()
  })

  it('only ever deletes lists flagged as a campaign audience', async () => {
    campaignExists.mockResolvedValue(null)
    listDeleteOne.mockResolvedValue({ deletedCount: 1 })
    expect(await removeCampaignAudienceListIfUnused(conn, LIST)).toBe(true)
    expect(listDeleteOne).toHaveBeenCalledWith({ _id: LIST, campaignAudience: true })
    expect(memberDeleteMany).toHaveBeenCalledWith({ recipientListId: LIST })
  })

  it('leaves a person-made list (and its members) alone', async () => {
    campaignExists.mockResolvedValue(null)
    listDeleteOne.mockResolvedValue({ deletedCount: 0 })
    expect(await removeCampaignAudienceListIfUnused(conn, LIST)).toBe(false)
    expect(memberDeleteMany).not.toHaveBeenCalled()
  })

  it('ignores an empty list id', async () => {
    expect(await removeCampaignAudienceListIfUnused(conn, '  ')).toBe(false)
    expect(campaignExists).not.toHaveBeenCalled()
  })
})
