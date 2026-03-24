import type { H3Event } from 'h3'

const RESERVED_SUBDOMAINS = new Set(['www', 'api'])
const ADMIN_SUBDOMAINS = new Set(['admin', 'superadmin'])

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().split(':')[0] || ''
}

function normalizeSubdomain(subdomain: string): string {
  return subdomain.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
}

export function normalizeTenantSubdomainInput(raw: string): string {
  const value = normalizeSubdomain(raw)
  if (!value) throw createError({ statusCode: 400, message: 'subdomain is required' })
  if (value.length < 2 || value.length > 63) {
    throw createError({ statusCode: 400, message: 'subdomain must be 2-63 characters' })
  }
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(value)) {
    throw createError({ statusCode: 400, message: 'subdomain must be lowercase letters, numbers, and hyphens' })
  }
  if (RESERVED_SUBDOMAINS.has(value) || ADMIN_SUBDOMAINS.has(value)) {
    throw createError({ statusCode: 400, message: 'subdomain is reserved' })
  }
  return value
}

export function getTenantBaseDomain(): string {
  return String(process.env.TENANT_BASE_DOMAIN || 'marketing.local').trim().toLowerCase()
}

export function getHostFromEvent(event: H3Event): string {
  return normalizeHost(getRequestHost(event) || '')
}

export function extractSubdomainFromHost(host: string, baseDomain = getTenantBaseDomain()): string {
  const normalizedHost = normalizeHost(host)
  const normalizedBase = normalizeHost(baseDomain)
  if (!normalizedHost) return ''
  if (normalizedHost === normalizedBase) return ''
  if (normalizedBase && normalizedHost.endsWith(`.${normalizedBase}`)) {
    const candidate = normalizedHost.slice(0, -(normalizedBase.length + 1))
    if (!candidate) return ''
    const first = candidate.split('.')[0] || ''
    return normalizeSubdomain(first)
  }
  const first = normalizedHost.split('.')[0] || ''
  return normalizeSubdomain(first)
}

export function isAdminSubdomain(subdomain: string): boolean {
  return ADMIN_SUBDOMAINS.has(normalizeSubdomain(subdomain))
}

export function isTenantSubdomain(subdomain: string): boolean {
  const normalized = normalizeSubdomain(subdomain)
  return !!normalized && !isAdminSubdomain(normalized) && !RESERVED_SUBDOMAINS.has(normalized)
}
