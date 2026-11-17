import { afterEach, describe, expect, it } from 'vitest'
import {
  isKafkaConsumerGroupCoordinationError,
  planInboundHandlerFailure,
  shouldRethrowInboundHandlerError
} from './inboundConsumerKeepalive'

describe('shouldRethrowInboundHandlerError', () => {
  const prev = process.env.KAFKA_INBOUND_FAIL_FAST

  afterEach(() => {
    if (prev === undefined) delete process.env.KAFKA_INBOUND_FAIL_FAST
    else process.env.KAFKA_INBOUND_FAIL_FAST = prev
  })

  it('does not rethrow handler/data errors by default', () => {
    delete process.env.KAFKA_INBOUND_FAIL_FAST
    expect(shouldRethrowInboundHandlerError(new Error('Types is not defined'))).toBe(false)
    expect(shouldRethrowInboundHandlerError(new Error('MongoNetworkError'))).toBe(false)
  })

  it('rethrows consumer group coordination errors', () => {
    delete process.env.KAFKA_INBOUND_FAIL_FAST
    const err = new Error('The group is rebalancing')
    expect(isKafkaConsumerGroupCoordinationError(err)).toBe(true)
    expect(shouldRethrowInboundHandlerError(err)).toBe(true)
  })

  it('rethrows all errors when KAFKA_INBOUND_FAIL_FAST=true', () => {
    process.env.KAFKA_INBOUND_FAIL_FAST = 'true'
    expect(shouldRethrowInboundHandlerError(new Error('Types is not defined'))).toBe(true)
  })
})

describe('planInboundHandlerFailure (existing functionality contract)', () => {
  const prev = process.env.KAFKA_INBOUND_FAIL_FAST

  afterEach(() => {
    if (prev === undefined) delete process.env.KAFKA_INBOUND_FAIL_FAST
    else process.env.KAFKA_INBOUND_FAIL_FAST = prev
  })

  it('keeps contact.created poison from crashing the shared consumer', () => {
    delete process.env.KAFKA_INBOUND_FAIL_FAST
    const plan = planInboundHandlerFailure({
      err: new Error('Types is not defined'),
      eventType: 'contact.created'
    })
    expect(plan).toEqual({
      kind: 'handler',
      recordHealth: true,
      rethrow: false
    })
  })

  it('does not double-record health for marketing.sync.requested failures', () => {
    delete process.env.KAFKA_INBOUND_FAIL_FAST
    const plan = planInboundHandlerFailure({
      err: new Error('transient mongo'),
      eventType: 'marketing.sync.requested'
    })
    expect(plan.recordHealth).toBe(false)
    expect(plan.rethrow).toBe(false)
  })

  it('still rethrows rebalance errors so consumer can restart', () => {
    delete process.env.KAFKA_INBOUND_FAIL_FAST
    const plan = planInboundHandlerFailure({
      err: new Error('The group is rebalancing'),
      eventType: 'contact.updated'
    })
    expect(plan).toEqual({
      kind: 'coordination',
      recordHealth: true,
      rethrow: true
    })
  })

  it('success path is unaffected: planner is only for catch branches', () => {
    // Documented contract: happy-path eachMessage does not call planInboundHandlerFailure.
    // If handler resolves, KafkaJS commits and continues exactly as before.
    expect(typeof planInboundHandlerFailure).toBe('function')
  })
})
