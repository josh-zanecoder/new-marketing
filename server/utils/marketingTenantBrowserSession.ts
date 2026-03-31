import { createHmac, timingSafeEqual } from 'node:crypto'
import { MAX_CONTACT_OWNER_EMAILS_IN_SESSION } from '../constants/contactOwnerScope.constants'

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
  crmHandoffFirstName?: string
  crmHandoffLastName?: string
  crmHandoffPhone?: string
  crmHandoffRole?: string
  /** CRM user may see all tenant contacts (no `metadata.ownerEmail` filter). */
  tenantWideContacts?: boolean
  contactOwnerEmails?: string[]
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
  const fn = params.crmHandoffFirstName?.trim()
  if (fn) payload.crmFn = fn
  const ln = params.crmHandoffLastName?.trim()
  if (ln) payload.crmLn = ln
  const ph = params.crmHandoffPhone?.trim()
  if (ph) payload.crmPh = ph
  const rl = params.crmHandoffRole?.trim()
  if (rl) payload.crmRl = rl
  if (params.tenantWideContacts === true) {
    payload.tw = true
  }
  if (params.contactOwnerEmails?.length) {
    payload.owners = params.contactOwnerEmails.slice(0, MAX_CONTACT_OWNER_EMAILS_IN_SESSION)
  }

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
): {
  tenantId: string | null
  crmEmail?: string
  crmFirstName?: string
  crmLastName?: string
  crmPhone?: string
  crmRole?: string
  tenantWideContacts?: true
  contactOwnerEmails?: string[]
} {
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
  const crmFirstName = typeof payload.crmFn === 'string' ? payload.crmFn.trim() : ''
  const crmLastName = typeof payload.crmLn === 'string' ? payload.crmLn.trim() : ''
  const crmPhone = typeof payload.crmPh === 'string' ? payload.crmPh.trim() : ''
  const crmRole = typeof payload.crmRl === 'string' ? payload.crmRl.trim() : ''
  const tenantWideContacts =
    payload.tw === true || payload.tw === 'true' ? (true as const) : undefined

  let contactOwnerEmails: string[] | undefined
  const rawOwners = payload.owners
  if (Array.isArray(rawOwners)) {
    const next: string[] = []
    const seen = new Set<string>()
    for (const x of rawOwners) {
      if (typeof x !== 'string') continue
      const e = x.trim().toLowerCase()
      if (!e || seen.has(e)) continue
      seen.add(e)
      next.push(e)
      if (next.length >= MAX_CONTACT_OWNER_EMAILS_IN_SESSION) break
    }
    if (next.length > 0) contactOwnerEmails = next
  }

  return {
    tenantId: tid || null,
    ...(crmEmail ? { crmEmail } : {}),
    ...(crmFirstName ? { crmFirstName } : {}),
    ...(crmLastName ? { crmLastName } : {}),
    ...(crmPhone ? { crmPhone } : {}),
    ...(crmRole ? { crmRole } : {}),
    ...(tenantWideContacts ? { tenantWideContacts } : {}),
    ...(contactOwnerEmails ? { contactOwnerEmails } : {})
  }
}
