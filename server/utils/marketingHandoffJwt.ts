import { createHmac, timingSafeEqual } from 'node:crypto'

const ISS = 'mortdash-crm'
const AUD = 'mortdash-marketing'

function base64urlToBuffer(s: string): Buffer {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad
  return Buffer.from(b64, 'base64')
}

function verifyHs256Signature(h: string, p: string, sigB64url: string, hmacSecret: string): void {
  const expectedSig = createHmac('sha256', hmacSecret).update(`${h}.${p}`).digest()
  const gotSig = base64urlToBuffer(sigB64url)
  if (gotSig.length !== expectedSig.length || !timingSafeEqual(gotSig, expectedSig)) {
    throw new Error('Invalid signature')
  }
}

export type HandoffParseResult = {
  apiKey: string
  marketingTenantId: string
  email?: string
}

/**
 * CRM handoff JWT: HS256 secret = tenant `nmk_`; payload `k` matches; `sub` = marketing registry tenantId.
 */
export function parseMarketingHandoffToken(token: string): HandoffParseResult {
  const parts = token.trim().split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid token shape')
  }
  const [h, p, s] = parts
  if (!h || !p || !s) throw new Error('Invalid token')

  const payload = JSON.parse(base64urlToBuffer(p).toString('utf8')) as Record<string, unknown>
  if (payload.iss !== ISS || payload.aud !== AUD) {
    throw new Error('Invalid issuer or audience')
  }
  const sub = typeof payload.sub === 'string' ? payload.sub.trim() : ''
  const exp = typeof payload.exp === 'number' ? payload.exp : 0
  if (!sub || exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Invalid subject or expired')
  }
  const apiKey = typeof payload.k === 'string' ? payload.k.trim() : ''
  if (!apiKey.startsWith('nmk_')) {
    throw new Error('Invalid key material')
  }

  verifyHs256Signature(h, p, s, apiKey)

  const emailRaw = typeof payload.email === 'string' ? payload.email.trim() : ''

  return {
    apiKey,
    marketingTenantId: sub,
    ...(emailRaw ? { email: emailRaw } : {})
  }
}

export { ISS as MARKETING_HANDOFF_ISS, AUD as MARKETING_HANDOFF_AUD }
