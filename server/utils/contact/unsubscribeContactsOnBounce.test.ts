import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  shouldAutoUnsubscribeOnTrackingEvent,
  AUTO_UNSUBSCRIBE_TRACKING_EVENTS,
  unsubscribeContactsOnBounce
} from './unsubscribeContactsOnBounce'

const updateOne = vi.fn()
const onContactUnsubscribed = vi.fn()
const findLean = vi.fn()

vi.mock('@server/models/tenant/tenantClientModels', () => ({
  getTenantClientModels: () => ({
    Contact: {
      find: () => ({
        select: () => ({
          lean: () => ({
            exec: findLean
          })
        })
      }),
      updateOne
    }
  })
}))

vi.mock('@server/utils/contact/contactSubscriptionEffects', () => ({
  onContactUnsubscribed: (...args: unknown[]) => onContactUnsubscribed(...args)
}))

describe('shouldAutoUnsubscribeOnTrackingEvent', () => {
  it('auto-unsubscribes hard bounces, SES bounces, and spam', () => {
    expect(shouldAutoUnsubscribeOnTrackingEvent('hardBounces')).toBe(true)
    expect(shouldAutoUnsubscribeOnTrackingEvent('bounces')).toBe(true)
    expect(shouldAutoUnsubscribeOnTrackingEvent('bounced')).toBe(true)
    expect(shouldAutoUnsubscribeOnTrackingEvent('spam')).toBe(true)
    expect(AUTO_UNSUBSCRIBE_TRACKING_EVENTS.has('hardBounces')).toBe(true)
  })

  it('does not auto-unsubscribe soft bounces or other events', () => {
    expect(shouldAutoUnsubscribeOnTrackingEvent('softBounces')).toBe(false)
    expect(shouldAutoUnsubscribeOnTrackingEvent('delivered')).toBe(false)
    expect(shouldAutoUnsubscribeOnTrackingEvent('unsubscribed')).toBe(false)
    expect(shouldAutoUnsubscribeOnTrackingEvent('')).toBe(false)
  })
})

describe('unsubscribeContactsOnBounce', () => {
  beforeEach(() => {
    updateOne.mockReset()
    onContactUnsubscribed.mockReset()
    findLean.mockReset()
  })

  it('skips soft bounces without querying contacts', async () => {
    const result = await unsubscribeContactsOnBounce({} as never, {
      email: 'a@example.com',
      reason: 'softBounces'
    })
    expect(result.skipped).toBe(true)
    expect(findLean).not.toHaveBeenCalled()
  })

  it('unsubscribes matching contacts and records bounce metadata', async () => {
    const contactId = { toString: () => 'c1' }
    findLean.mockResolvedValue([{ _id: contactId, isUnsubscribe: false }])
    updateOne.mockResolvedValue({ matchedCount: 1 })
    onContactUnsubscribed.mockResolvedValue(undefined)

    const result = await unsubscribeContactsOnBounce({} as never, {
      email: 'Ada@Example.com',
      reason: 'hardBounces',
      messageId: 'msg-1'
    })

    expect(result).toEqual({
      updated: 1,
      alreadyUnsubscribed: 0,
      notFound: false,
      skipped: false
    })
    expect(updateOne).toHaveBeenCalledWith(
      { _id: contactId },
      {
        $set: expect.objectContaining({
          isUnsubscribe: true,
          'metadata.unsubscribeSource': 'hardBounces',
          'metadata.bounceMessageId': 'msg-1'
        })
      }
    )
    expect(onContactUnsubscribed).toHaveBeenCalledWith({}, contactId)
  })

  it('is idempotent for already-unsubscribed contacts', async () => {
    findLean.mockResolvedValue([{ _id: { toString: () => 'c1' }, isUnsubscribe: true }])
    const result = await unsubscribeContactsOnBounce({} as never, {
      email: 'a@example.com',
      reason: 'spam'
    })
    expect(result).toEqual({
      updated: 0,
      alreadyUnsubscribed: 1,
      notFound: false,
      skipped: false
    })
    expect(updateOne).not.toHaveBeenCalled()
  })
})
