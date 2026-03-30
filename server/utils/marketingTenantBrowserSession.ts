import { createHmac, timingSafeEqual } from 'node:crypto'

function base64urlEncode(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

function base64urlToBuffer(s: string): Buffer {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad
  return Buffer.from(b64, 'base64')
}

/**
 * Session cookie: HS256 with registry `clientKeyHash` (hex) as secret; `sub` = `dbName`.
 */
export function signMarketingTenantBrowserSession(params: {
  dbName: string
  tenantId: string | null
  clientKeyHash: string
  maxAgeSec: number
  crmHandoffEmail?: string
}): string {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'HS256', typ: 'JWT' }
  const payload: Record<string, unknown> = {
    sub: params.dbName,
    iat: now,
    exp: now + params.maxAgeSec
  }
  if (params.tenantId) payload.tid = params.tenantId
  const em = params.crmHandoffEmail?.trim()
  if (em) payload.crmEmail = em

  const h = base64urlEncode(Buffer.from(JSON.stringify(header), 'utf8'))
  const p = base64urlEncode(Buffer.from(JSON.stringify(payload), 'utf8'))
  const sig = createHmac('sha256', params.clientKeyHash).update(`${h}.${p}`).digest()
  const s = base64urlEncode(sig)
  return `${h}.${p}.${s}`
}

export function verifyMarketingTenantBrowserSession(
  token: string,
  clientKeyHash: string,
  expectedDbName: string
): { tenantId: string | null; crmEmail?: string } {
  const parts = token.trim().split('.')
  if (parts.length !== 3) throw new Error('Invalid session')
  const [h, p, sigB64] = parts
  if (!h || !p || !sigB64) throw new Error('Invalid session')

  const expectedSig = createHmac('sha256', clientKeyHash).update(`${h}.${p}`).digest()
  const gotSig = base64urlToBuffer(sigB64)
  if (gotSig.length !== expectedSig.length || !timingSafeEqual(gotSig, expectedSig)) {
    throw new Error('Invalid signature')
  }

  const payload = JSON.parse(base64urlToBuffer(p).toString('utf8')) as Record<string, unknown>
  const sub = typeof payload.sub === 'string' ? payload.sub.trim() : ''
  const exp = typeof payload.exp === 'number' ? payload.exp : 0
  if (!sub || sub !== expectedDbName) throw new Error('Invalid subject')
  if (exp < Math.floor(Date.now() / 1000)) throw new Error('Expired')

  const tid = typeof payload.tid === 'string' ? payload.tid.trim() : ''
  const crmEmail = typeof payload.crmEmail === 'string' ? payload.crmEmail.trim() : ''

  return {
    tenantId: tid || null,
    ...(crmEmail ? { crmEmail } : {})
  }
}
