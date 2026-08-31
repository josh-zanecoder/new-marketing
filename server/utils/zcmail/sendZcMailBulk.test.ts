import { describe, expect, it, vi } from 'vitest'
import {
  alignZcMailBulkResultsToRecipients,
  sendZcMailBulk,
  unwrapZcMailBulkJobStatus,
  ZC_MAIL_BULK_POLL_INTERVAL_MS
} from './sendZcMailBulk'
import { ZcMailSendError } from './sendZcMailEmail'

describe('sendZcMailBulk', () => {
  it('unwraps nested job status payload from zcMail', () => {
    expect(
      unwrapZcMailBulkJobStatus({
        job: { id: 'job-1', status: 'completed', sent: 1, failed: 0, results: [] }
      })
    ).toEqual({ id: 'job-1', status: 'completed', sent: 1, failed: 0, results: [] })
    expect(unwrapZcMailBulkJobStatus({ status: 'completed', sent: 1 })).toEqual({
      status: 'completed',
      sent: 1
    })
  })

  it('aligns sent results to recipient order', () => {
    expect(
      alignZcMailBulkResultsToRecipients(2, [
        { status: 'sent', sesMessageId: 'ses-1' },
        { status: 'failed', error: 'bounce' }
      ])
    ).toEqual(['ses-1', null])
  })

  it('enqueues bulk job and polls until completed', async () => {
    vi.useFakeTimers()
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 202,
        text: async () => JSON.stringify({ jobId: 'job-1' })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            job: {
              id: 'job-1',
              status: 'processing',
              sent: 0,
              failed: 0,
              results: [{ status: 'sending' }]
            }
          })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            job: {
              id: 'job-1',
              status: 'completed',
              sent: 1,
              failed: 0,
              results: [{ status: 'sent', sesMessageId: 'ses-1' }]
            }
          })
      })

    const pending = sendZcMailBulk(
      {
        baseUrl: 'http://localhost:3003/',
        apiKey: 'zcm_test',
        tenant: 'acme',
        from: 'noreply@acme.example',
        recipients: [{ to: 'a@example.com', subject: 'Hi', html: '<p>Hi</p>' }]
      },
      fetchImpl as unknown as typeof fetch
    )

    await vi.advanceTimersByTimeAsync(ZC_MAIL_BULK_POLL_INTERVAL_MS)
    const result = await pending

    expect(result.jobId).toBe('job-1')
    expect(result.status).toBe('completed')
    expect(result.results[0]?.sesMessageId).toBe('ses-1')
    expect(String(fetchImpl.mock.calls[0][0])).toBe('http://localhost:3003/v1/mail/bulk')
    vi.useRealTimers()
  })

  it('throws ZcMailSendError when enqueue fails', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: 'unauthorized' })
    })

    await expect(
      sendZcMailBulk(
        {
          baseUrl: 'http://localhost:3003',
          apiKey: 'bad',
          tenant: 'acme',
          recipients: [{ to: 'a@example.com', subject: 'Hi', html: '<p>Hi</p>' }]
        },
        fetchImpl as unknown as typeof fetch
      )
    ).rejects.toBeInstanceOf(ZcMailSendError)
  })
})
