import { beforeEach, describe, expect, it, vi } from 'vitest'
import { publishRatesheetUnsubscribedToKafka } from './publishRatesheetUnsubscribed'

const publishMarketingEnvelope = vi.fn()
const isKafkaConfigured = vi.fn()

vi.mock('./kafkaProducer', () => ({
  publishMarketingEnvelope: (...args: unknown[]) => publishMarketingEnvelope(...args),
  isKafkaConfigured: (...args: unknown[]) => isKafkaConfigured(...args)
}))

vi.mock('../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

describe('publishRatesheetUnsubscribedToKafka', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isKafkaConfigured.mockReturnValue(true)
    publishMarketingEnvelope.mockResolvedValue(undefined)
  })

  it('publishes ratesheet.unsubscribed envelope', async () => {
    await publishRatesheetUnsubscribedToKafka({
      tenantDbName: 'forge_capital',
      tenantId: 'tid-1',
      email: 'Broker@Example.COM',
      reason: 'marketing_unsubscribe',
      source: 'new-marketing-preference'
    })

    expect(publishMarketingEnvelope).toHaveBeenCalledTimes(1)
    const envelope = publishMarketingEnvelope.mock.calls[0][0]
    expect(envelope.eventType).toBe('ratesheet.unsubscribed')
    expect(envelope.tenantDbName).toBe('forge_capital')
    expect(envelope.tenantId).toBe('tid-1')
    expect(envelope.payload).toEqual({
      email: 'broker@example.com',
      reason: 'marketing_unsubscribe',
      source: 'new-marketing-preference'
    })
  })

  it('skips when Kafka is not configured', async () => {
    isKafkaConfigured.mockReturnValue(false)
    await publishRatesheetUnsubscribedToKafka({
      tenantDbName: 'forge_capital',
      email: 'a@b.com'
    })
    expect(publishMarketingEnvelope).not.toHaveBeenCalled()
  })

  it('skips invalid email', async () => {
    await publishRatesheetUnsubscribedToKafka({
      tenantDbName: 'forge_capital',
      email: 'not-an-email'
    })
    expect(publishMarketingEnvelope).not.toHaveBeenCalled()
  })
})
