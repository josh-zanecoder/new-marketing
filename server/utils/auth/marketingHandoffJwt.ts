import { createHmac, timingSafeEqual } from 'node:crypto'
import { MAX_CONTACT_OWNER_EMAILS_IN_SESSION } from '@server/constants/contactOwnerScope.constants'

const DEFAULT_HANDOFF_ISS = 'marketing-tenant'
const DEFAULT_HANDOFF_AUD = 'new-marketing'

function resolveHandoffIssAud(): { iss: string; aud: string } {
  try {
    const c = useRuntimeConfig()
    const iss = String(c.marketingHandoffIss ?? '').trim() || DEFAULT_HANDOFF_ISS
    const aud = String(c.marketingHandoffAud ?? '').trim() || DEFAULT_HANDOFF_AUD
    return { iss, aud }
  } catch {
    return { iss: DEFAULT_HANDOFF_ISS, aud: DEFAULT_HANDOFF_AUD }
  }
}

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
  firstName?: string
  lastName?: string
  phone?: string
  role?: string
  allowedOwnerEmails?: string[]
  tenantWideContacts?: true
}

export function parseMarketingHandoffToken(token: string): HandoffParseResult {
  const parts = token.trim().split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid token shape')
  }
  const [h, p, s] = parts
  if (!h || !p || !s) throw new Error('Invalid token')

  const payload = JSON.parse(base64urlToBuffer(p).toString('utf8')) as Record<string, unknown>
  const { iss, aud } = resolveHandoffIssAud()
  if (payload.iss !== iss || payload.aud !== aud) {
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
  const firstNameRaw = typeof payload.firstName === 'string' ? payload.firstName.trim() : ''
  const lastNameRaw = typeof payload.lastName === 'string' ? payload.lastName.trim() : ''
  const phoneRaw = typeof payload.phone === 'string' ? payload.phone.trim() : ''
  const roleRaw = typeof payload.role === 'string' ? payload.role.trim() : ''

  const tenantWideContacts =
    payload.tenantWideContacts === true || payload.tenantWideContacts === 'true'
      ? (true as const)
      : undefined

  const profileExtras = {
    ...(emailRaw ? { email: emailRaw } : {}),
    ...(firstNameRaw ? { firstName: firstNameRaw } : {}),
    ...(lastNameRaw ? { lastName: lastNameRaw } : {}),
    ...(phoneRaw ? { phone: phoneRaw } : {}),
    ...(roleRaw ? { role: roleRaw } : {})
  }

  if (tenantWideContacts) {
    return {
      apiKey,
      marketingTenantId: sub,
      ...profileExtras,
      tenantWideContacts
    }
  }

  let allowedOwnerEmails: string[] | undefined
  const rawOwners = payload.ownerEmails
  if (Array.isArray(rawOwners)) {
    const set = new Set<string>()
    for (const x of rawOwners) {
      if (typeof x !== 'string') continue
      const e = x.trim().toLowerCase()
      if (e) set.add(e)
      if (set.size >= MAX_CONTACT_OWNER_EMAILS_IN_SESSION) break
    }
    if (set.size > 0) allowedOwnerEmails = [...set]
  }

  return {
    apiKey,
    marketingTenantId: sub,
    ...profileExtras,
    ...(allowedOwnerEmails ? { allowedOwnerEmails } : {})
  }
}

/** Current expected issuer (from runtime config / defaults). */
export function getMarketingHandoffIss(): string {
  return resolveHandoffIssAud().iss
}

/** Current expected audience (from runtime config / defaults). */
export function getMarketingHandoffAud(): string {
  return resolveHandoffIssAud().aud
}
