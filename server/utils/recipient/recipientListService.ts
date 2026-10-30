/**
 * Tenant recipient list **create** and **patch** (single entry point).
 * See `README.md` in this folder for other modules (normalization, membership query, filter parsing).
 */
import type { Connection, Types } from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type {
  RecipientListCriterion,
  RecipientListCriterionJoin,
  RecipientListFilterMode,
  RecipientListMembershipScope
} from '@server/types/tenant/recipientList.model'
import type { NestedFilterGroup } from '@server/utils/recipient/recipientListMembershipQuery'
import type { PersistedFilterGroup } from '@server/utils/recipient/recipientListMutation'
import {
  isRegisteredTenantAuthContext,
  recipientListMembershipOwnerEmailsFromAuth,
  recipientListMembershipScopeFromAuth,
  recipientListOwnershipFromAuth,
  tenantCreatedByFromAuth
} from '@server/tenant/registry-auth'
import { getRegistryConnection } from '@server/lib/mongoose'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'
import { assertRecipientListAudience } from '@server/utils/recipient/recipientListAudience'
import { rebuildRecipientListMembers } from '@server/utils/recipient/recipientListMembershipQuery'
import {
  pickJoinsForQuery,
  recipientListExcludedContactIds,
  resolveRecipientListFiltersFromBody
} from '@server/utils/recipient/recipientListMutation'
import { normalizeRecipientListDoc } from '@server/utils/recipient/recipientListNormalization'
import { isAllowedSelectedCampaignSenderEmail } from '@server/utils/campaign/listCampaignSenderCandidates'
import { parseAllowTenantLoRecipientLists } from '~~/shared/allowTenantLoRecipientLists'
import type { ContactModel } from '@server/types/tenant/contact.model'

/** JSON `list` object returned by POST/PATCH. */
export type RecipientListApiRow = {
  id: string
  name: string
  listType: string
  audience: string
  filters: unknown[]
  filterMode: 'and' | 'or'
  criterionJoins: ('and' | 'or')[]
  membershipScope: 'tenant' | 'owner_emails'
  membershipOwnerEmails: string[]
  associatedLoanOfficerEmail: string
  associatedLoanOfficerName: string
  memberCount: number
  createdAt: string | null
  updatedAt: string | null
}

type CreatedLean = {
  name?: string
  listType?: string
  audience?: string
  filters?: unknown[]
  filterMode?: string
  criterionJoins?: string[]
  membershipScope?: string
  membershipOwnerEmails?: string[]
  associatedLoanOfficerEmail?: string
  associatedLoanOfficerName?: string
  createdAt?: Date | null
  updatedAt?: Date | null
}

function associatedLoFromDoc(rawEmail: unknown, rawName: unknown): {
  associatedLoanOfficerEmail: string
  associatedLoanOfficerName: string
} {
  const associatedLoanOfficerEmail =
    typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : ''
  const associatedLoanOfficerName = typeof rawName === 'string' ? rawName.trim() : ''
  return { associatedLoanOfficerEmail, associatedLoanOfficerName }
}

function requireTenantAuth(auth: unknown): void {
  if (!isRegisteredTenantAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Tenant access required' })
  }
}

function assertFilterMode(raw: unknown): RecipientListFilterMode {
  if (raw === 'or') return 'or'
  if (raw === 'and' || raw === undefined) return 'and'
  throw createError({
    statusCode: 400,
    message: 'Invalid filterMode (use and or or)'
  })
}

function assertName(body: Record<string, unknown>): string {
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 200) : ''
  if (!name) throw createError({ statusCode: 400, message: 'Name is required' })
  return name
}

function criterionJoinsForResponse(raw: unknown): ('and' | 'or')[] {
  if (!Array.isArray(raw)) return []
  return raw.map((j) => (j === 'or' ? 'or' : 'and'))
}

function membershipEmailsFromDoc(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((e): e is string => typeof e === 'string')
}

function listRowFromCreated(
  id: string,
  lean: CreatedLean,
  memberCount: number
): RecipientListApiRow {
  const scope =
    lean.membershipScope === 'tenant' || lean.membershipScope === 'owner_emails'
      ? lean.membershipScope
      : 'owner_emails'
  const lo = associatedLoFromDoc(lean.associatedLoanOfficerEmail, lean.associatedLoanOfficerName)
  return {
    id,
    name: lean.name ?? '',
    listType: lean.listType ?? '',
    audience: lean.audience ?? '',
    filters: lean.filters ?? [],
    filterMode: lean.filterMode === 'or' ? 'or' : 'and',
    criterionJoins: criterionJoinsForResponse(lean.criterionJoins),
    membershipScope: scope,
    membershipOwnerEmails: membershipEmailsFromDoc(lean.membershipOwnerEmails),
    ...lo,
    memberCount,
    createdAt: lean.createdAt?.toISOString?.() ?? null,
    updatedAt: lean.updatedAt?.toISOString?.() ?? null
  }
}

function listRowFromPatch(
  listId: Types.ObjectId,
  name: string,
  updated: Record<string, unknown> | null,
  normalized: ReturnType<typeof normalizeRecipientListDoc>,
  memberCount: number
): RecipientListApiRow {
  const scope =
    updated?.membershipScope === 'tenant' || updated?.membershipScope === 'owner_emails'
      ? (updated.membershipScope as 'tenant' | 'owner_emails')
      : 'owner_emails'
  const lo = associatedLoFromDoc(
    updated?.associatedLoanOfficerEmail,
    updated?.associatedLoanOfficerName
  )
  return {
    id: String(listId),
    name: typeof updated?.name === 'string' ? updated.name : name,
    listType: typeof updated?.listType === 'string' ? updated.listType : 'dynamic',
    audience: normalized.audience,
    filters: normalized.filters,
    filterMode: normalized.filterMode,
    criterionJoins: normalized.criterionJoins ?? [],
    membershipScope: scope,
    membershipOwnerEmails: membershipEmailsFromDoc(updated?.membershipOwnerEmails),
    ...lo,
    memberCount,
    createdAt:
      updated?.createdAt instanceof Date ? updated.createdAt.toISOString() : null,
    updatedAt:
      updated?.updatedAt instanceof Date ? updated.updatedAt.toISOString() : null
  }
}

/** Shared body → filters + membership snapshot (create and patch both use this). */
async function loadWritePayload(
  tenantConn: Connection,
  auth: unknown,
  body: Record<string, unknown>
): Promise<{
  name: string
  filterMode: RecipientListFilterMode
  audience: string
  filters: RecipientListCriterion[]
  criterionGroups: RecipientListCriterion[][]
  persistedFilterRows: { recipientFilterId: string; listPropertyValue: string }[]
  criterionJoinsFromBody: RecipientListCriterionJoin[] | null
  joinsToStore: RecipientListCriterionJoin[]
  nested: { groups: NestedFilterGroup[]; groupJoins: RecipientListCriterionJoin[] } | null
  persistedFilterGroups: PersistedFilterGroup[] | null
  groupJoinsToStore: RecipientListCriterionJoin[] | null
  membershipScope: RecipientListMembershipScope
  membershipOwnerEmails: string[]
  associatedLoanOfficerEmail: string
  associatedLoanOfficerName: string
  applyAssociatedLoanOfficer: boolean
  /** Set only for LO-scoped writes; omitted on classic path. */
  excludedContactIds: Types.ObjectId[]
  applyExcludedContactIds: boolean
}> {
  requireTenantAuth(auth)
  const name = assertName(body)
  const filterMode = assertFilterMode(body?.filterMode)
  const audience = await assertRecipientListAudience(tenantConn, body?.audience)
  const {
    filters,
    criterionGroups,
    persistedFilterRows,
    criterionJoinsFromBody,
    nested,
    persistedFilterGroups,
    groupJoinsToStore
  } = await resolveRecipientListFiltersFromBody(body, tenantConn, audience)

  const joinsToStore =
    criterionJoinsFromBody !== null
      ? criterionJoinsFromBody
      : Array.from({ length: Math.max(0, criterionGroups.length - 1) }, () => 'and' as const)

  let membershipScope = recipientListMembershipScopeFromAuth(auth)
  let membershipOwnerEmails =
    membershipScope === 'owner_emails'
      ? recipientListMembershipOwnerEmailsFromAuth(auth)
      : []
  let associatedLoanOfficerEmail = ''
  let associatedLoanOfficerName = ''
  let applyAssociatedLoanOfficer = false
  let excludedContactIds: Types.ObjectId[] = []
  let applyExcludedContactIds = false

  const dbName =
    isRegisteredTenantAuthContext(auth) && typeof auth.dbName === 'string' ? auth.dbName : ''
  let allowLoLists = false
  if (dbName) {
    try {
      const registry = await getRegistryConnection()
      const doc = await registry.collection('clients').findOne(
        { dbName },
        { projection: { allowTenantLoRecipientLists: 1 } }
      )
      allowLoLists = parseAllowTenantLoRecipientLists(doc?.allowTenantLoRecipientLists)
    } catch {
      allowLoLists = false
    }
  }

  // LO mode only when toggle ON + LO email in body. OFF path ignores LO fields.
  if (allowLoLists) {
    const loEmail = String(body?.associatedLoanOfficerEmail ?? '')
      .trim()
      .toLowerCase()
    const loName = String(body?.associatedLoanOfficerName ?? '').trim()
    if (loEmail) {
      if (!isRegisteredTenantAuthContext(auth)) {
        throw createError({ statusCode: 403, message: 'Tenant access required' })
      }
      const { Contact } = getTenantClientModels(tenantConn)
      const allowed = await isAllowedSelectedCampaignSenderEmail(
        Contact as ContactModel,
        auth,
        loEmail
      )
      if (!allowed) {
        throw createError({
          statusCode: 400,
          message: 'Loan officer must be a profile from the tenant directory'
        })
      }
      associatedLoanOfficerEmail = loEmail
      associatedLoanOfficerName = loName || loEmail
      membershipScope = 'owner_emails'
      membershipOwnerEmails = [loEmail]
      applyAssociatedLoanOfficer = true
      // Unchecked borrowers on the LO create/edit form → soft exclusions.
      applyExcludedContactIds = true
      excludedContactIds = recipientListExcludedContactIds({
        excludedContactIds: body?.excludedContactIds
      })
    }
  }

  return {
    name,
    filterMode,
    audience,
    filters,
    criterionGroups,
    persistedFilterRows,
    criterionJoinsFromBody,
    joinsToStore,
    nested,
    persistedFilterGroups,
    groupJoinsToStore,
    membershipScope,
    membershipOwnerEmails,
    associatedLoanOfficerEmail,
    associatedLoanOfficerName,
    applyAssociatedLoanOfficer,
    excludedContactIds,
    applyExcludedContactIds
  }
}

export async function createRecipientList(params: {
  tenantConn: Connection
  auth: unknown
  body: Record<string, unknown>
}): Promise<{ list: RecipientListApiRow }> {
  const { tenantConn, auth, body } = params
  const w = await loadWritePayload(tenantConn, auth, body)
  const { RecipientList } = getTenantClientModels(tenantConn)

  const created = await RecipientList.create({
    name: w.name,
    description: '',
    listType: 'dynamic',
    audience: w.audience,
    filters: w.filters,
    filterMode: w.filterMode,
    filterRows: w.persistedFilterRows,
    criterionJoins: w.joinsToStore,
    ...(w.persistedFilterGroups
      ? { filterGroups: w.persistedFilterGroups, groupJoins: w.groupJoinsToStore ?? [] }
      : {}),
    clientId: '',
    membershipScope: w.membershipScope,
    membershipOwnerEmails: w.membershipOwnerEmails,
    ...(w.applyAssociatedLoanOfficer
      ? {
          associatedLoanOfficerEmail: w.associatedLoanOfficerEmail,
          associatedLoanOfficerName: w.associatedLoanOfficerName
        }
      : {}),
    ...(w.applyExcludedContactIds ? { excludedContactIds: w.excludedContactIds } : {}),
    ...recipientListOwnershipFromAuth(auth)
  })

  const listId = created._id as Types.ObjectId
  const joinsForRebuild = pickJoinsForQuery(
    w.criterionGroups,
    w.criterionJoinsFromBody,
    { criterionJoins: w.joinsToStore }
  )
  const memberCount = await rebuildRecipientListMembers(
    tenantConn,
    listId,
    w.audience,
    w.filters,
    w.filterMode,
    w.criterionGroups,
    auth,
    w.membershipScope,
    w.membershipOwnerEmails,
    joinsForRebuild,
    w.nested
  )

  return {
    list: listRowFromCreated(String(created._id), created.toObject() as CreatedLean, memberCount)
  }
}

export async function updateRecipientList(params: {
  tenantConn: Connection
  auth: unknown
  listId: Types.ObjectId
  body: Record<string, unknown>
}): Promise<{ list: RecipientListApiRow }> {
  const { tenantConn, auth, listId, body } = params
  const w = await loadWritePayload(tenantConn, auth, body)
  const { RecipientList } = getTenantClientModels(tenantConn)

  const existing = await RecipientList.findOne(
    mergeTenantOwnerEmailScopeFilter({ _id: listId }, auth)
  )
    .lean()
    .exec()
  if (!existing) {
    throw createError({ statusCode: 404, message: 'List not found' })
  }

  const updateDoc: Record<string, unknown> = {
    name: w.name,
    audience: w.audience,
    filters: w.filters,
    filterMode: w.filterMode,
    filterRows: w.persistedFilterRows,
    membershipScope: w.membershipScope,
    membershipOwnerEmails: w.membershipOwnerEmails
  }
  if (w.applyAssociatedLoanOfficer) {
    updateDoc.associatedLoanOfficerEmail = w.associatedLoanOfficerEmail
    updateDoc.associatedLoanOfficerName = w.associatedLoanOfficerName
  }
  if (w.applyExcludedContactIds) {
    updateDoc.excludedContactIds = w.excludedContactIds
  }
  if (w.criterionJoinsFromBody !== null) {
    updateDoc.criterionJoins = w.criterionJoinsFromBody
  }
  if (w.persistedFilterGroups) {
    updateDoc.filterGroups = w.persistedFilterGroups
    updateDoc.groupJoins = w.groupJoinsToStore ?? []
  }
  const editorId = tenantCreatedByFromAuth(auth)
  if (editorId) updateDoc.updatedBy = editorId

  await RecipientList.findByIdAndUpdate(listId, { $set: updateDoc }).exec()

  const joinsForRebuild = pickJoinsForQuery(
    w.criterionGroups,
    w.criterionJoinsFromBody,
    existing as { criterionJoins?: unknown }
  )
  const memberCount = await rebuildRecipientListMembers(
    tenantConn,
    listId,
    w.audience,
    w.filters,
    w.filterMode,
    w.criterionGroups,
    auth,
    w.membershipScope,
    w.membershipOwnerEmails,
    joinsForRebuild,
    w.nested
  )

  const updated = (await RecipientList.findById(listId).lean().exec()) as Record<
    string,
    unknown
  > | null
  const normalized = updated
    ? normalizeRecipientListDoc(updated)
    : {
        audience: w.audience,
        filters: w.filters,
        filterMode: w.filterMode,
        criterionJoins: [] as ('and' | 'or')[]
      }

  return {
    list: listRowFromPatch(listId, w.name, updated, normalized, memberCount)
  }
}
