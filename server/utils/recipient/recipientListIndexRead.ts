import type { Connection } from 'mongoose'
import type { H3Event } from 'h3'
import { getRegistryConnection } from '@server/lib/mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import {
  isRegisteredTenantAuthContext,
  resolveTenantIdForTenantAuth
} from '@server/tenant/registry-auth'
import { withMarketableContactFilter } from '@server/utils/contact/marketableContact'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { countAllMarketableContactsByType } from '@server/utils/recipient/contactCountsByType'
import {
  CATALOG_CONTACT_SELECT,
  mapContactTypeDocs,
  RECIPIENT_LIST_CATALOG_LIMIT,
  serializeCatalogContacts,
  type CatalogContactRow
} from '@server/utils/recipient/recipientListCatalog'
import { countVisibleMembersByListId } from '@server/utils/recipient/recipientListMemberCounts'
import {
  buildRecipientListFormMetadata,
  buildRecipientListIndexMetadata
} from '@server/utils/recipient/recipientListRegistryMetadata'
import {
  recipientListObjectIds,
  serializeRecipientListNameOptions,
  serializeRecipientListRows,
  type RecipientListLeanDoc
} from '@server/utils/recipient/recipientListSerialization'

export type RecipientListScope = 'lists' | 'picker' | 'index' | 'form' | 'full'

export function parseRecipientListScope(raw: unknown): RecipientListScope {
  const value = String(Array.isArray(raw) ? raw[0] : (raw ?? '')).toLowerCase()
  if (value === 'lists' || value === 'picker' || value === 'index' || value === 'form') {
    return value
  }
  return 'full'
}

export type RecipientListReadContext = {
  auth: unknown
  tenantId: string | null
  tenantConn: Connection
  contactFilter: Record<string, unknown>
  Contact: ReturnType<typeof getTenantClientModels>['Contact']
  RecipientList: ReturnType<typeof getTenantClientModels>['RecipientList']
  RecipientListMember: ReturnType<typeof getTenantClientModels>['RecipientListMember']
  RecipientFilter: ReturnType<typeof getTenantClientModels>['RecipientFilter']
  ContactType: ReturnType<typeof getTenantClientModels>['ContactType']
}

export async function createRecipientListReadContext(event: H3Event): Promise<RecipientListReadContext> {
  const auth = event.context.auth as unknown
  if (!isRegisteredTenantAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Tenant access required' })
  }

  const registryConn = await getRegistryConnection()
  const tenantId = await resolveTenantIdForTenantAuth(registryConn, auth)
  const tenantConn = await getTenantConnectionFromEvent(event)
  const { Contact, RecipientList, RecipientListMember, RecipientFilter, ContactType } =
    getTenantClientModels(tenantConn)

  const contactFilter = mergeTenantOwnerEmailScopeFilter(
    withMarketableContactFilter({}),
    auth
  ) as Record<string, unknown>

  return {
    auth,
    tenantId,
    tenantConn,
    contactFilter,
    Contact,
    RecipientList,
    RecipientListMember,
    RecipientFilter,
    ContactType
  }
}

async function fetchEnabledContactTypes(ContactType: RecipientListReadContext['ContactType']) {
  return ContactType.find({ enabled: { $ne: false } })
    .sort({ sortOrder: 1, key: 1 })
    .lean()
    .exec()
}

async function fetchEnabledRegistryFilters(RecipientFilter: RecipientListReadContext['RecipientFilter']) {
  return RecipientFilter.find({ enabled: true }).sort({ updatedAt: -1 }).lean().exec()
}

async function fetchOwnedRecipientLists(
  RecipientList: RecipientListReadContext['RecipientList'],
  auth: unknown
) {
  return RecipientList.find(mergeTenantOwnerEmailScopeFilter({}, auth))
    .sort({ updatedAt: -1 })
    .limit(200)
    .lean()
    .exec() as Promise<RecipientListLeanDoc[]>
}

export async function loadRecipientListNameOptions(ctx: RecipientListReadContext) {
  const lists = await ctx.RecipientList.find(mergeTenantOwnerEmailScopeFilter({}, ctx.auth))
    .select({ name: 1 })
    .sort({ updatedAt: -1 })
    .limit(200)
    .lean()
    .exec()

  return { lists: serializeRecipientListNameOptions(lists as RecipientListLeanDoc[]) }
}

export async function loadRecipientListPickerCatalog(ctx: RecipientListReadContext) {
  const [contactTotal, contactsRaw, contactTypeDocs, contactCounts] = await Promise.all([
    ctx.Contact.countDocuments(ctx.contactFilter),
    ctx.Contact.find(ctx.contactFilter)
      .select(CATALOG_CONTACT_SELECT)
      .sort({ updatedAt: -1 })
      .limit(RECIPIENT_LIST_CATALOG_LIMIT)
      .lean()
      .exec(),
    fetchEnabledContactTypes(ctx.ContactType),
    countAllMarketableContactsByType({ Contact: ctx.Contact, contactFilter: ctx.contactFilter })
  ])

  return {
    contacts: serializeCatalogContacts(contactsRaw as CatalogContactRow[]),
    contactTotal,
    contactsTruncated: contactTotal > RECIPIENT_LIST_CATALOG_LIMIT,
    contactCounts,
    contactTypes: mapContactTypeDocs(contactTypeDocs)
  }
}

export async function loadRecipientListIndexPage(ctx: RecipientListReadContext) {
  const [lists, contactTypeDocs, filterDocsRaw] = await Promise.all([
    fetchOwnedRecipientLists(ctx.RecipientList, ctx.auth),
    fetchEnabledContactTypes(ctx.ContactType),
    fetchEnabledRegistryFilters(ctx.RecipientFilter)
  ])

  const memberCountByListId = await countVisibleMembersByListId({
    RecipientListMember: ctx.RecipientListMember,
    Contact: ctx.Contact,
    listObjectIds: recipientListObjectIds(lists),
    contactFilter: ctx.contactFilter
  })

  const meta = buildRecipientListIndexMetadata({
    tenantId: ctx.tenantId,
    contactTypeDocs,
    filterDocsRaw
  })

  return {
    tenantId: ctx.tenantId,
    tenantIdConfigured: Boolean(ctx.tenantId),
    ...meta,
    lists: serializeRecipientListRows(lists, memberCountByListId)
  }
}

export async function loadRecipientListFormScope(ctx: RecipientListReadContext) {
  const [contactTypeDocs, filterDocsRaw] = await Promise.all([
    fetchEnabledContactTypes(ctx.ContactType),
    fetchEnabledRegistryFilters(ctx.RecipientFilter)
  ])

  const meta = await buildRecipientListFormMetadata({
    tenantConn: ctx.tenantConn,
    auth: ctx.auth,
    tenantId: ctx.tenantId,
    contactTypeDocs,
    filterDocsRaw
  })

  return {
    tenantId: ctx.tenantId,
    tenantIdConfigured: Boolean(ctx.tenantId),
    ...meta,
    contacts: [],
    contactTotal: 0,
    contactsTruncated: false,
    lists: []
  }
}

export async function loadRecipientListFullCatalog(ctx: RecipientListReadContext) {
  const [contactTotal, contactsRaw, lists, contactTypeDocs, filterDocsRaw, contactCounts] =
    await Promise.all([
      ctx.Contact.countDocuments(ctx.contactFilter),
      ctx.Contact.find(ctx.contactFilter)
        .select(CATALOG_CONTACT_SELECT)
        .sort({ updatedAt: -1 })
        .limit(RECIPIENT_LIST_CATALOG_LIMIT)
        .lean()
        .exec(),
      fetchOwnedRecipientLists(ctx.RecipientList, ctx.auth),
      fetchEnabledContactTypes(ctx.ContactType),
      fetchEnabledRegistryFilters(ctx.RecipientFilter),
      countAllMarketableContactsByType({ Contact: ctx.Contact, contactFilter: ctx.contactFilter })
    ])

  const memberCountByListId = await countVisibleMembersByListId({
    RecipientListMember: ctx.RecipientListMember,
    Contact: ctx.Contact,
    listObjectIds: recipientListObjectIds(lists),
    contactFilter: ctx.contactFilter
  })

  const { contactTypes, recipientFilters } = await buildRecipientListFormMetadata({
    tenantConn: ctx.tenantConn,
    auth: ctx.auth,
    tenantId: ctx.tenantId,
    contactTypeDocs,
    filterDocsRaw,
    contactCounts
  })

  return {
    tenantId: ctx.tenantId,
    tenantIdConfigured: Boolean(ctx.tenantId),
    contacts: serializeCatalogContacts(contactsRaw as CatalogContactRow[]),
    contactTotal,
    contactsTruncated: contactTotal > RECIPIENT_LIST_CATALOG_LIMIT,
    contactCounts,
    contactTypes,
    recipientFilters,
    lists: serializeRecipientListRows(lists, memberCountByListId)
  }
}
