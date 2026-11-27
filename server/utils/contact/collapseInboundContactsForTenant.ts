import type { Connection } from 'mongoose'
import { isLendingQbStatusEnabledForConnection } from '@server/utils/recipient/lendingQbStatusFeature'
import {
  collapseInboundContactsByEmail,
  type InboundContactCollection,
  type InboundContactWriteRow
} from './collapseInboundContactsByEmail'
import {
  collapseInboundContactsByEmailLegacy,
  type LegacyInboundContactCollection
} from './collapseInboundContactsByEmailLegacy'

/**
 * One marketing contact per email, written from inbound CRM events.
 *
 * The stable "oldest contact owns the email" rules (plus the E11000 retry, and the duplicate merge
 * sweep + unique index that go with them) belong to the LendingQB integration, so they only apply
 * to tenants with the LendingQB permission ON. Every other tenant keeps the original behavior
 * (`collapseInboundContactsByEmailLegacy`: the most recently updated contact is kept).
 */
export async function collapseInboundContactsForTenant(params: {
  tenantConn: Connection
  Contact: InboundContactCollection
  source: string
  rows: InboundContactWriteRow[]
  now?: Date
}): Promise<{ keptIds: string[]; retiredIds: string[] }> {
  const { tenantConn, Contact, ...rest } = params
  if (await isLendingQbStatusEnabledForConnection(tenantConn)) {
    return collapseInboundContactsByEmail({ Contact, ...rest })
  }
  return collapseInboundContactsByEmailLegacy({
    Contact: Contact as unknown as LegacyInboundContactCollection,
    ...rest
  })
}
