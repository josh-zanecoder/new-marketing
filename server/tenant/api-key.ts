import crypto from 'node:crypto'
import { TENANT_API_KEY_PREFIX, TENANT_API_KEY_BYTES } from '../constants/apiKey.constants'

export function generateTenantApiKey(): string {
  const raw = crypto.randomBytes(TENANT_API_KEY_BYTES).toString('base64url')
  return `${TENANT_API_KEY_PREFIX}${raw}`
}

export function hashTenantApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex')
}

export function getTenantApiKeyPrefix(apiKey: string): string {
  if (apiKey.length < 12) return '****'
  return `${apiKey.slice(0, 8)}...`
}

export function verifyTenantApiKey(plain: string, hash: string): boolean {
  if (!plain || !hash || hash.length !== 64) return false
  const computed = hashTenantApiKey(plain)
  if (computed.length !== hash.length) return false
  return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(hash, 'hex'))
}
