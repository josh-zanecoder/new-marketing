/**
 * Tenant recipient list **create** and **patch** (single entry point).
 * See `README.md` in this folder for other modules (normalization, membership query, filter parsing).
 */
import type { Types } from 'mongoose'
import mongoose from 'mongoose'
import type { Connection } from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type {
  RecipientListCriterion,
  RecipientListCriterionJoin,
  RecipientListFilterMode,
  RecipientListMembershipScope
} from '@server/types/tenant/recipientList.model'
import {
  isRegisteredTenantAuthContext,
  recipientListMembershipOwnerEmailsFromAuth,
  recipientListMembershipScopeFromAuth,
  recipientListOwnershipFromAuth,
  tenantCreatedByFromAuth
} from '@server/tenant/registry-auth'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'
import { assertRecipientListAudience } from '@server/utils/recipient/recipientListAudience'
import { rebuildRecipientListMembers } from '@server/utils/recipient/recipientListMembershipQuery'
import {
  pickJoinsForQuery,
  resolveRecipientListFiltersFromBody
} from '@server/utils/recipient/recipientListMutation'
import { normalizeRecipientListDoc } from '@server/utils/recipient/recipientListNormalization'

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
  createdAt?: Date | null
  updatedAt?: Date | null
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
    memberCount,
    createdAt: lean.createdAt?.toISOString?.() ?? null,
    updatedAt: lean.updatedAt?.toISOString?.() ?? null
  }
}

function listRowFromPatch(
  listId: mongoose.Types.ObjectId,
  name: string,
  updated: Record<string, unknown> | null,
  normalized: ReturnType<typeof normalizeRecipientListDoc>,
  memberCount: number
): RecipientListApiRow {
  const scope =
    updated?.membershipScope === 'tenant' || updated?.membershipScope === 'owner_emails'
      ? (updated.membershipScope as 'tenant' | 'owner_emails')
      : 'owner_emails'
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
  membershipScope: RecipientListMembershipScope
  membershipOwnerEmails: string[]
}> {
  requireTenantAuth(auth)
  const name = assertName(body)
  const filterMode = assertFilterMode(body?.filterMode)
  const audience = await assertRecipientListAudience(tenantConn, body?.audience)
  const { filters, criterionGroups, persistedFilterRows, criterionJoinsFromBody } =
    await resolveRecipientListFiltersFromBody(body, tenantConn, audience)

  const joinsToStore =
    criterionJoinsFromBody !== null
      ? criterionJoinsFromBody
      : Array.from({ length: Math.max(0, criterionGroups.length - 1) }, () => 'and' as const)

  const membershipScope = recipientListMembershipScopeFromAuth(auth)
  const membershipOwnerEmails =
    membershipScope === 'owner_emails'
      ? recipientListMembershipOwnerEmailsFromAuth(auth)
      : []

  return {
    name,
    filterMode,
    audience,
    filters,
    criterionGroups,
    persistedFilterRows,
    criterionJoinsFromBody,
    joinsToStore,
    membershipScope,
    membershipOwnerEmails
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
    clientId: '',
    membershipScope: w.membershipScope,
    membershipOwnerEmails: w.membershipOwnerEmails,
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
    joinsForRebuild
  )

  return {
    list: listRowFromCreated(String(created._id), created.toObject() as CreatedLean, memberCount)
  }
}

export async function updateRecipientList(params: {
  tenantConn: Connection
  auth: unknown
  listId: mongoose.Types.ObjectId
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
  if (w.criterionJoinsFromBody !== null) {
    updateDoc.criterionJoins = w.criterionJoinsFromBody
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
    joinsForRebuild
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
