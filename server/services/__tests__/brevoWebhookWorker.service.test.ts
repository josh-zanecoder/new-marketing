import { describe, expect, it, vi } from 'vitest'
import { processBrevoWebhookWorkerTask } from '@server/services/brevoWebhookWorker.service'

vi.mock('@server/utils/tracking/applyBrevoTrackingWebhook', () => ({
  applyBrevoTrackingWebhook: vi.fn()
}))

import { applyBrevoTrackingWebhook } from '@server/utils/tracking/applyBrevoTrackingWebhook'

describe('processBrevoWebhookWorkerTask', () => {
  it('returns applied result on success', async () => {
    vi.mocked(applyBrevoTrackingWebhook).mockResolvedValue({
      ok: true,
      dbName: 'tenant_a',
      upserted: true,
      messageId: 'm1',
      event: 'delivered'
    })

    const result = await processBrevoWebhookWorkerTask({
      kind: 'brevoTransactional',
      body: { event: 'delivered' },
      messageId: 'm1',
      event: 'delivered'
    })

    expect(result.ok).toBe(true)
    if (result.ok && !('skipped' in result) && !('terminalFailure' in result)) {
      expect(result.dbName).toBe('tenant_a')
      expect(result.upserted).toBe(true)
    }
  })

  it('skips client errors without throwing', async () => {
    vi.mocked(applyBrevoTrackingWebhook).mockResolvedValue({
      ok: false,
      statusCode: 404,
      message: 'Unknown tenant'
    })

    const result = await processBrevoWebhookWorkerTask({
      kind: 'brevoTransactional',
      body: {},
      messageId: 'm2',
      event: 'opened'
    })

    expect(result).toMatchObject({ ok: true, skipped: true, reason: 'Unknown tenant' })
  })
})
