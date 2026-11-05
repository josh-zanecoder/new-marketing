import { describe, expect, it } from 'vitest'
import {
  displayNameFromParts,
  pickBestOwnerNameFields
} from '../listCampaignSenderCandidates'

describe('pickBestOwnerNameFields', () => {
  it('skips empty owner name rows so Marketing/OM Sender is not email/email', () => {
    expect(
      pickBestOwnerNameFields([
        { firstName: '', lastName: '', avatarUrl: '' },
        { firstName: 'Hello', lastName: 'Sistar', avatarUrl: 'https://cdn/a.png' },
        { firstName: '', lastName: 'OnlyLast', avatarUrl: '' }
      ])
    ).toEqual({
      firstName: 'Hello',
      lastName: 'Sistar',
      avatarUrl: 'https://cdn/a.png'
    })
  })

  it('keeps empty when no owner names exist on any contact', () => {
    expect(
      pickBestOwnerNameFields([
        { firstName: '', lastName: '' },
        { firstName: null, lastName: undefined }
      ])
    ).toEqual({ firstName: '', lastName: '', avatarUrl: '' })
  })
})

describe('displayNameFromParts', () => {
  it('uses first+last when present, else email', () => {
    expect(displayNameFromParts('Hello', 'Sistar', 'hello+sistarlo@zanecoder.com')).toBe(
      'Hello Sistar'
    )
    expect(displayNameFromParts('', '', 'hello+sistarlo@zanecoder.com')).toBe(
      'hello+sistarlo@zanecoder.com'
    )
  })
})
