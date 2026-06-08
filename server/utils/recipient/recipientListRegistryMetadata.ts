import type { Connection } from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { withMarketableContactFilter } from '@server/utils/contact/marketableContact'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'
import { countMarketableContactsByTypeKey } from '@server/utils/recipient/contactCountsByType'
import { canonicalRecipientFilterFieldsFromDoc } from '@server/utils/recipient/recipientFilterValidation'
import { mapContactTypeDocs } from '@server/utils/recipient/recipientListCatalog'

type RegistryFilterDoc = {
  _id: unknown
  name: string
  contactType: string
  property?: string
  propertyType?: string | null
  propertyValue?: string
  enabled: boolean
  createdAt?: Date
  updatedAt?: Date
}

export function serializeRegistryFilter(f: RegistryFilterDoc, registryTenantId: string | null) {
  const { property, propertyType } = canonicalRecipientFilterFieldsFromDoc(f)
  return {
    id: String(f._id),
    tenantId: registryTenantId ?? '',
    name: f.name,
    contactType: f.contactType,
    property,
    propertyType,
    propertyValue: f.propertyValue ?? '',
    enabled: f.enabled,
    createdAt: f.createdAt?.toISOString?.() ?? null,
    updatedAt: f.updatedAt?.toISOString?.() ?? null
  }
}

function contactTypeKeysForCounts(contactTypeDocs: unknown[], filterDocsRaw: unknown[]): string[] {
  const keys = new Set<string>()
  for (const d of contactTypeDocs as Array<{ key?: string }>) {
    const k = String(d.key ?? '')
      .trim()
      .toLowerCase()
    if (k) keys.add(k)
  }
  for (const d of filterDocsRaw as Array<{ contactType?: string }>) {
    const k = String(d.contactType ?? '')
      .trim()
      .toLowerCase()
    if (k) keys.add(k)
  }
  return [...keys].sort((a, b) => a.localeCompare(b))
}

export async function buildRecipientListFormMetadata(params: {
  tenantConn: Connection
  auth: unknown
  tenantId: string | null
  contactTypeDocs: unknown[]
  filterDocsRaw: unknown[]
  /** When set (full catalog), skip a second count aggregation. */
  contactCounts?: Record<string, number>
}) {
  const { Contact } = getTenantClientModels(params.tenantConn)
  const contactFilter = mergeTenantOwnerEmailScopeFilter(withMarketableContactFilter({}), params.auth)

  const contactTypes = mapContactTypeDocs(params.contactTypeDocs)
  const contactCounts =
    params.contactCounts ??
    (await countMarketableContactsByTypeKey({
      Contact,
      contactFilter: contactFilter as Record<string, unknown>,
      countKeys: contactTypeKeysForCounts(params.contactTypeDocs, params.filterDocsRaw)
    }))

  const recipientFilters = (params.filterDocsRaw as RegistryFilterDoc[]).map((d) =>
    serializeRegistryFilter(d, params.tenantId)
  )

  return { contactTypes, contactCounts, recipientFilters }
}

export function buildRecipientListIndexMetadata(params: {
  tenantId: string | null
  contactTypeDocs: unknown[]
  filterDocsRaw: unknown[]
}) {
  return {
    contactTypes: mapContactTypeDocs(params.contactTypeDocs),
    recipientFilters: (params.filterDocsRaw as RegistryFilterDoc[]).map((d) =>
      serializeRegistryFilter(d, params.tenantId)
    )
  }
}
