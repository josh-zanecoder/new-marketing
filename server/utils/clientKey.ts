import crypto from 'node:crypto'
import { CLIENT_KEY_PREFIX, CLIENT_KEY_BYTES } from './clientKey.constants'

export function generateClientKey(): string {
  const raw = crypto.randomBytes(CLIENT_KEY_BYTES).toString('base64url')
  return `${CLIENT_KEY_PREFIX}${raw}`
}

export function hashClientKey(clientKey: string): string {
  return crypto.createHash('sha256').update(clientKey).digest('hex')
}

export function getClientKeyPrefix(clientKey: string): string {
  if (clientKey.length < 12) return '****'
  return `${clientKey.slice(0, 8)}...`
}

export function verifyClientKey(plain: string, hash: string): boolean {
  if (!plain || !hash || hash.length !== 64) return false
  const computed = hashClientKey(plain)
  if (computed.length !== hash.length) return false
  return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(hash, 'hex'))
}
