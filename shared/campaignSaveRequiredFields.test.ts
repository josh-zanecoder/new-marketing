import { describe, expect, it } from 'vitest'
import {
  campaignSaveMissingFieldsMessage,
  missingCampaignSaveFieldLabels
} from './campaignSaveRequiredFields'

describe('missingCampaignSaveFieldLabels', () => {
  it('lists incomplete fields in display order', () => {
    expect(
      missingCampaignSaveFieldLabels({
        hasName: false,
        hasRecipients: false,
        hasDesign: true,
        hasSubject: false
      })
    ).toEqual(['Campaign name', 'Recipients', 'Subject'])
  })

  it('returns empty when all required fields are complete', () => {
    expect(
      missingCampaignSaveFieldLabels({
        hasName: true,
        hasRecipients: true,
        hasDesign: true,
        hasSubject: true
      })
    ).toEqual([])
  })
})

describe('campaignSaveMissingFieldsMessage', () => {
  it('returns null when nothing is missing', () => {
    expect(
      campaignSaveMissingFieldsMessage({
        hasName: true,
        hasRecipients: true,
        hasDesign: true,
        hasSubject: true
      })
    ).toBeNull()
  })

  it('names a single missing field', () => {
    expect(
      campaignSaveMissingFieldsMessage({
        hasName: true,
        hasRecipients: true,
        hasDesign: false,
        hasSubject: true
      })
    ).toBe('Design is required before saving.')
  })

  it('lists multiple missing fields', () => {
    expect(
      campaignSaveMissingFieldsMessage({
        hasName: false,
        hasRecipients: false,
        hasDesign: false,
        hasSubject: false
      })
    ).toBe(
      'Complete these required fields before saving: Campaign name, Recipients, Design, Subject.'
    )
  })
})
