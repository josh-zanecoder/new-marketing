import { createHmac, timingSafeEqual } from 'node:crypto'

const TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000

export type UnsubscribeTokenPayload = {
  db: string
  c: string
  exp: number
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString('base64url')
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s, 'base64url')
}

export function signUnsubscribeToken(
  payload: Omit<UnsubscribeTokenPayload, 'exp'>,
  secret: string,
  nowMs = Date.now()
): string {
  const body: UnsubscribeTokenPayload = {
    db: payload.db.trim(),
    c: payload.c.trim(),
    exp: nowMs + TOKEN_TTL_MS
  }
  if (!body.db || !body.c) throw new Error('Invalid unsubscribe token payload')
  const p = b64urlEncode(Buffer.from(JSON.stringify(body), 'utf8'))
  const sig = createHmac('sha256', secret).update(p).digest()
  return `${p}.${b64urlEncode(sig)}`
}

export function verifyUnsubscribeToken(
  token: string,
  secret: string,
  nowMs = Date.now()
): UnsubscribeTokenPayload | null {
  const trimmed = token.trim()
  const dot = trimmed.lastIndexOf('.')
  if (dot <= 0) return null
  const p = trimmed.slice(0, dot)
  const sigB64 = trimmed.slice(dot + 1)
  if (!p || !sigB64) return null
  try {
    const expected = createHmac('sha256', secret).update(p).digest()
    const actual = b64urlDecode(sigB64)
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
    const payload = JSON.parse(b64urlDecode(p).toString('utf8')) as UnsubscribeTokenPayload
    if (!payload?.db?.trim() || !payload?.c?.trim()) return null
    if (typeof payload.exp !== 'number' || payload.exp < nowMs) return null
    return payload
  } catch {
    return null
  }
}
