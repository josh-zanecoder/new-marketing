import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { getRegistryConnection } from '../../lib/mongoose'
import { resolveZcMailWebhookSecret } from './resolveZcMailWebhookSecret'

vi.mock('../../lib/mongoose', () => ({
  getRegistryConnection: vi.fn()
}))

const getRegistry = vi.mocked(getRegistryConnection)

describe('resolveZcMailWebhookSecret', () => {
  const prev = process.env.ZC_MAIL_WEBHOOK_SECRET

  beforeEach(() => {
    process.env.ZC_MAIL_WEBHOOK_SECRET = 'env-secret'
  })

  afterEach(() => {
    if (prev === undefined) delete process.env.ZC_MAIL_WEBHOOK_SECRET
    else process.env.ZC_MAIL_WEBHOOK_SECRET = prev
    vi.clearAllMocks()
  })

  it('prefers the per-tenant registry secret', async () => {
    getRegistry.mockResolvedValue({
      collection: () => ({
        findOne: async () => ({ zcMailWebhookSecret: ' tenant-hmac ' })
      })
    } as never)

    await expect(resolveZcMailWebhookSecret('acme_db')).resolves.toBe('tenant-hmac')
  })

  it('falls back to env when the tenant has no custom secret', async () => {
    getRegistry.mockResolvedValue({
      collection: () => ({
        findOne: async () => ({})
      })
    } as never)

    await expect(resolveZcMailWebhookSecret('acme_db')).resolves.toBe('env-secret')
  })

  it('uses env when dbName is missing', async () => {
    await expect(resolveZcMailWebhookSecret(null)).resolves.toBe('env-secret')
    expect(getRegistry).not.toHaveBeenCalled()
  })
})
