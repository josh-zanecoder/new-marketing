import type { Connection } from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const AUDIENCE_KEY_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/

/** Normalize inbound audience to a stable lowercase key, or "" if invalid. */
export function parseAudienceKey(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const key = raw.trim().toLowerCase().slice(0, 64)
  if (!key || !AUDIENCE_KEY_RE.test(key)) return ''
  return key
}

/** Case-insensitive match for `RecipientFilter.contactType` queries. */
export function recipientFilterContactTypeMatch(audience: string) {
  const key = audience.trim().toLowerCase()
  return {
    contactType: new RegExp(`^${escapeRegex(key)}$`, 'i')
  }
}

export async function assertRecipientListAudience(
  tenantConn: Connection,
  raw: unknown
): Promise<string> {
  const key = parseAudienceKey(raw)
  if (!key) {
    throw createError({
      statusCode: 400,
      message:
        'Invalid audience: use a lowercase contact type key (letters, numbers, hyphens, underscores).'
    })
  }

  const { ContactType, RecipientFilter } = getTenantClientModels(tenantConn)

  const typeOk = await ContactType.findOne({
    key,
    enabled: { $ne: false }
  })
    .select({ _id: 1 })
    .lean()
    .exec()

  if (typeOk) return key

  const filterOk = await RecipientFilter.findOne({
    enabled: true,
    ...recipientFilterContactTypeMatch(key)
  })
    .select({ _id: 1 })
    .lean()
    .exec()

  if (filterOk) return key

  throw createError({
    statusCode: 400,
    message:
      "Invalid audience: choose an enabled contact type from tenant settings, or match a recipient filter's contact type."
  })
}
