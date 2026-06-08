import { describe, expect, it } from 'vitest'
import { classifyEngagementEvent } from '../classifyEngagementEvent'

describe('classifyEngagementEvent', () => {
  it('maps Brevo request events to sent', () => {
    expect(classifyEngagementEvent('request')).toBe('sent')
    expect(classifyEngagementEvent('requests')).toBe('sent')
  })

  it('maps delivery and engagement events', () => {
    expect(classifyEngagementEvent('delivered')).toBe('delivered')
    expect(classifyEngagementEvent('opened')).toBe('opened')
    expect(classifyEngagementEvent('click')).toBe('clicked')
  })

  it('returns other for unknown events', () => {
    expect(classifyEngagementEvent('custom')).toBe('other')
  })
})
