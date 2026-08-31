import { describe, expect, it, vi } from 'vitest'
import { sendZcMailEmail, ZcMailSendError } from './sendZcMailEmail'

describe('sendZcMailEmail', () => {
  it('posts to /v1/mail/send with X-API-Key and SendMailRequest body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          sent: 1,
          failed: 0,
          results: [
            {
              recipient: 'user@example.com',
              role: 'to',
              messageId: 'msg-1',
              status: 'sent'
            }
          ]
        })
    })

    const result = await sendZcMailEmail(
      {
        baseUrl: 'http://localhost:3003/',
        apiKey: 'zcm_test_key',
        tenant: 'cbc',
        to: 'user@example.com',
        subject: 'Hello',
        html: '<p>Hi</p>',
        archive: true
      },
      fetchImpl as unknown as typeof fetch
    )

    expect(result.ok).toBe(true)
    expect(result.messageId).toBe('msg-1')
    expect(result.sent).toBe(1)
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('http://localhost:3003/v1/mail/send')
    expect(init.method).toBe('POST')
    expect(init.headers['X-API-Key']).toBe('zcm_test_key')
    expect(JSON.parse(init.body)).toEqual({
      tenant: 'cbc',
      to: 'user@example.com',
      subject: 'Hello',
      html: '<p>Hi</p>',
      archive: true
    })
  })

  it('throws ZcMailSendError on non-2xx responses', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: 'Invalid API key', code: 'UNAUTHORIZED' })
    })

    await expect(
      sendZcMailEmail(
        {
          baseUrl: 'http://localhost:3003',
          apiKey: 'bad',
          tenant: 'cbc',
          to: 'user@example.com',
          subject: 'Hello',
          html: '<p>Hi</p>'
        },
        fetchImpl as unknown as typeof fetch
      )
    ).rejects.toMatchObject({
      name: 'ZcMailSendError',
      message: expect.stringContaining('Invalid API key')
    })
  })

  it('rejects when neither html nor text is provided', async () => {
    await expect(
      sendZcMailEmail({
        baseUrl: 'http://localhost:3003',
        apiKey: 'zcm',
        tenant: 'cbc',
        to: 'user@example.com',
        subject: 'Hello'
      })
    ).rejects.toBeInstanceOf(ZcMailSendError)
  })
})
