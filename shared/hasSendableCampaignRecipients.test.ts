import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  canScheduleCampaignDraft,
  hasSendableCampaignRecipients
} from './hasSendableCampaignRecipients'

const contactId = '507f1f77bcf86cd799439011'

function wizardDraft(recipientsType: 'list' | 'manual', selectedIds: string[]) {
  return {
    status: 'Draft',
    recipientsType,
    recipientsListId: recipientsType === 'list' ? '507f1f77bcf86cd799439012' : '',
    recipients: selectedIds.map((id) => ({ email: '', contactId: id })),
    recipientsCount: selectedIds.length
  }
}

describe('duplicated campaign schedule check', () => {
  it('rejects the old list-index row that caused Add recipients before scheduling', () => {
    expect(
      canScheduleCampaignDraft({
        status: 'Draft',
        recipientsType: 'list',
        recipientsListId: '507f1f77bcf86cd799439012',
        recipients: [],
        recipientsCount: 0
      })
    ).toBe(false)
  })

  it('accepts a duplicated list when the selected people are on the draft', () => {
    expect(canScheduleCampaignDraft(wizardDraft('list', [contactId, '507f1f77bcf86cd799439013']))).toBe(
      true
    )
  })

  it('accepts a duplicated manual campaign from the saved count or the selected rows', () => {
    expect(canScheduleCampaignDraft(wizardDraft('manual', [contactId]))).toBe(true)
    expect(
      canScheduleCampaignDraft({
        status: 'Draft',
        recipientsType: 'manual',
        recipients: [],
        recipientsCount: 4
      })
    ).toBe(true)
  })

  it('rejects an empty selection for both list and manual drafts', () => {
    expect(canScheduleCampaignDraft(wizardDraft('list', []))).toBe(false)
    expect(canScheduleCampaignDraft(wizardDraft('manual', []))).toBe(false)
    expect(
      hasSendableCampaignRecipients({
        recipientsType: 'list',
        recipientsListId: '507f1f77bcf86cd799439012',
        recipientsCount: 0,
        recipients: []
      })
    ).toBe(false)
  })

  it('does not schedule a copy that is no longer a draft', () => {
    expect(
      canScheduleCampaignDraft({
        ...wizardDraft('list', [contactId]),
        status: 'Scheduled'
      })
    ).toBe(false)
  })
})

describe('schedule wizard uses the selected recipients, not the campaign list row', () => {
  it('edit and add builders count the selected contact ids', () => {
    for (const file of [
      'app/pages/tenant/campaigns/edit/[id].vue',
      'app/pages/tenant/campaigns/add.vue'
    ]) {
      const source = readFileSync(file, 'utf8')
      const start = source.indexOf('function buildCampaignForSend')
      const end = source.indexOf('async function loadRecipientLists')
      const fn = source.slice(start, end)
      expect(fn).not.toContain('fromStore')
      expect(fn).toContain('recipientsCount: selectedIds.length')
      expect(fn).toContain('contactId: id')
    }
  })

  it('send/schedule gates use the shared audience helper', () => {
    const source = readFileSync('app/composables/useCampaignSendFlow.ts', 'utf8')
    expect(source).toContain("from '~~/shared/hasSendableCampaignRecipients'")
    expect(source).toContain('hasSendableCampaignRecipients(c)')
  })
})
