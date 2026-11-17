import { describe, expect, it } from 'vitest'
import { planInboundHandlerFailure } from './inboundConsumerKeepalive'

describe('DLQ decision for swallowed Kafka failures', () => {
  it('marks handler errors as non-rethrow so DLQ can retain them', () => {
    const plan = planInboundHandlerFailure({
      err: new Error('Types is not defined'),
      eventType: 'contact.updated'
    })
    expect(plan.rethrow).toBe(false)
    expect(plan.kind).toBe('handler')
  })

  it('still rethrows coordination errors (no DLQ swallow)', () => {
    const plan = planInboundHandlerFailure({
      err: new Error('The group is rebalancing'),
      eventType: 'contact.updated'
    })
    expect(plan.rethrow).toBe(true)
    expect(plan.kind).toBe('coordination')
  })
})
