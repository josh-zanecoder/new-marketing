import { describe, expect, it } from 'vitest'
import { shouldUsePersistedSelectedLoSender } from '../persistedSelectedLoSender'

describe('shouldUsePersistedSelectedLoSender', () => {
  it('is true for selected mode with an email', () => {
    expect(
      shouldUsePersistedSelectedLoSender({
        senderMode: 'selected',
        senderEmail: 'lo@example.com'
      })
    ).toBe(true)
  })

  it('is false for contact_owner even with an email', () => {
    expect(
      shouldUsePersistedSelectedLoSender({
        senderMode: 'contact_owner',
        senderEmail: 'lo@example.com'
      })
    ).toBe(false)
  })

  it('is false when selected but email is empty', () => {
    expect(
      shouldUsePersistedSelectedLoSender({
        senderMode: 'selected',
        senderEmail: '  '
      })
    ).toBe(false)
  })
})
