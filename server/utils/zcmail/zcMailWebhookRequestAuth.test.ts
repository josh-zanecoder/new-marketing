import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveZcMailWebhookSecret } from '@server/utils/zcmail/resolveZcMailWebhookSecret'
import {
  verifyZcMailSignature,
  verifyZcMailWebhookRequestAuth
} from './zcMailWebhookRequestAuth'

vi.mock('@server/utils/zcmail/resolveZcMailWebhookSecret', () => ({
  resolveZcMailWebhookSecret: vi.fn()
}))

const resolveSecret = vi.mocked(resolveZcMailWebhookSecret)

afterEach(() => {
  vi.clearAllMocks()
  delete process.env.ZC_MAIL_WEBHOOK_ALLOW_UNSIGNED
})

describe('verifyZcMailSignature', () => {
  it('accepts a matching sha256 HMAC header', () => {
    const secret = 'tenant-secret'
    const body = '{"event":"delivered"}'
    const sig = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
    expect(verifyZcMailSignature(body, sig, secret)).toBe(true)
  })

  it('rejects a bad signature', () => {
    expect(
      verifyZcMailSignature('{"a":1}', 'sha256=deadbeef', 'tenant-secret')
    ).toBe(false)
  })
})

describe('verifyZcMailWebhookRequestAuth', () => {
  it('uses the resolved tenant/env secret', async () => {
    resolveSecret.mockResolvedValue('tenant-secret')
    const body = '{"ok":true}'
    const sig = `sha256=${createHmac('sha256', 'tenant-secret').update(body).digest('hex')}`

    const result = await verifyZcMailWebhookRequestAuth({
      rawBody: body,
      signatureHeader: sig,
      dbName: 'acme_db'
    })

    expect(result).toEqual({ ok: true })
    expect(resolveSecret).toHaveBeenCalledWith('acme_db')
  })

  it('returns 401 when the signature does not match', async () => {
    resolveSecret.mockResolvedValue('tenant-secret')
    const result = await verifyZcMailWebhookRequestAuth({
      rawBody: '{}',
      signatureHeader: 'sha256=nope',
      dbName: 'acme_db'
    })
    expect(result).toEqual({
      ok: false,
      statusCode: 401,
      message: 'Invalid webhook signature'
    })
  })

  it('returns 503 when no secret is configured', async () => {
    resolveSecret.mockResolvedValue('')
    const result = await verifyZcMailWebhookRequestAuth({
      rawBody: '{}',
      signatureHeader: '',
      dbName: null
    })
    expect(result).toEqual({
      ok: false,
      statusCode: 503,
      message: 'zcMail webhook is not configured'
    })
  })

  it('allows unsigned when the local flag is set', async () => {
    process.env.ZC_MAIL_WEBHOOK_ALLOW_UNSIGNED = 'true'
    resolveSecret.mockResolvedValue('tenant-secret')
    const result = await verifyZcMailWebhookRequestAuth({
      rawBody: '{}',
      signatureHeader: '',
      dbName: 'acme_db'
    })
    expect(result).toEqual({ ok: true })
  })
})
