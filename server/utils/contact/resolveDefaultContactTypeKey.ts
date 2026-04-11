import type { Connection } from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'

/**
 * When the tenant registry is empty or code cannot query the DB, this parse-safe key is used
 * (matches `parseAudienceKey` rules in `recipientListAudience.ts`).
 */
export const LAST_RESORT_CONTACT_TYPE_KEY = 'contact'

type ContactTypeKeyLean = { key?: string }

/**
 * First enabled `contact_types` row by `sortOrder`, then `key`; otherwise {@link LAST_RESORT_CONTACT_TYPE_KEY}.
 */
export async function resolveDefaultContactTypeKey(tenantConn: Connection): Promise<string> {
  const { ContactType } = getTenantClientModels(tenantConn)
  const row = await ContactType.findOne({ enabled: { $ne: false } })
    .sort({ sortOrder: 1, key: 1 })
    .select({ key: 1 })
    .lean<ContactTypeKeyLean>()
    .exec()
  const k = String(row?.key ?? '').trim().toLowerCase()
  return k || LAST_RESORT_CONTACT_TYPE_KEY
}
