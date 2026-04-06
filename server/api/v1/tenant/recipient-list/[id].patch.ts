import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { ContactKind } from '@server/types/tenant/contact.model'
import type { RecipientListFilterMode } from '@server/types/tenant/recipientList.model'
import {
  isRegisteredTenantAuthContext,
  recipientListMembershipOwnerEmailsFromAuth,
  recipientListMembershipScopeFromAuth,
  tenantCreatedByFromAuth
} from '@server/tenant/registry-auth'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'
import { normalizeRecipientListDoc } from '@server/utils/recipient/recipientListDocument'
import {
  pickJoinsForQuery,
  rebuildRecipientListMembers,
  resolveRecipientListFiltersFromBody
} from '@server/utils/recipient/recipientListMutation'

const AUDIENCES = new Set<ContactKind>(['prospect', 'client', 'contact'])

function assertAudience(raw: unknown): ContactKind {
  if (typeof raw === 'string' && AUDIENCES.has(raw as ContactKind)) {
    return raw as ContactKind
  }
  throw createError({
    statusCode: 400,
    message: 'Invalid audience (use prospect, client, or contact)'
  })
}

function assertFilterMode(raw: unknown): RecipientListFilterMode {
  if (raw === 'or') return 'or'
  if (raw === 'and' || raw === undefined) return 'and'
  throw createError({
    statusCode: 400,
    message: 'Invalid filterMode (use and or or)'
  })
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as unknown
  if (!isRegisteredTenantAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Tenant access required' })
  }

  const rawId = getRouterParam(event, 'id')
  if (!rawId || !mongoose.isValidObjectId(rawId)) {
    throw createError({ statusCode: 400, message: 'Invalid list id' })
  }

  const listId = new mongoose.Types.ObjectId(rawId)

  const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>
  const name =
    typeof body?.name === 'string' ? body.name.trim().slice(0, 200) : ''
  if (!name) {
    throw createError({ statusCode: 400, message: 'Name is required' })
  }

  const audience = assertAudience(body?.audience)
  const filterMode = assertFilterMode(body?.filterMode)

  const tenantConn = await getTenantConnectionFromEvent(event)

  const { filters, criterionGroups, persistedFilterRows, criterionJoinsFromBody } =
    await resolveRecipientListFiltersFromBody(body, tenantConn, audience)
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
    name,
    audience,
    filters,
    filterMode,
    filterRows: persistedFilterRows
  }
  if (criterionJoinsFromBody !== null) {
    updateDoc.criterionJoins = criterionJoinsFromBody
  }
  const editorId = tenantCreatedByFromAuth(auth)
  if (editorId) updateDoc.updatedBy = editorId
  const membershipScope = recipientListMembershipScopeFromAuth(auth)
  const membershipOwnerEmails =
    membershipScope === 'owner_emails'
      ? recipientListMembershipOwnerEmailsFromAuth(auth)
      : []
  updateDoc.membershipScope = membershipScope
  updateDoc.membershipOwnerEmails = membershipOwnerEmails

  await RecipientList.findByIdAndUpdate(listId, { $set: updateDoc }).exec()

  const joinsForRebuild = pickJoinsForQuery(
    criterionGroups,
    criterionJoinsFromBody,
    existing as { criterionJoins?: unknown }
  )
  const memberCount = await rebuildRecipientListMembers(
    tenantConn,
    listId,
    audience,
    filters,
    filterMode,
    criterionGroups,
    auth,
    membershipScope,
    membershipOwnerEmails,
    joinsForRebuild
  )

  const updated = (await RecipientList.findById(listId).lean().exec()) as Record<
    string,
    unknown
  > | null
  const normalized = updated
    ? normalizeRecipientListDoc(updated)
    : {
        audience,
        filters,
        filterMode,
        criterionJoins: [] as ('and' | 'or')[]
      }

  return {
    list: {
      id: String(listId),
      name: typeof updated?.name === 'string' ? updated.name : name,
      listType: typeof updated?.listType === 'string' ? updated.listType : 'dynamic',
      audience: normalized.audience,
      filters: normalized.filters,
      filterMode: normalized.filterMode,
      criterionJoins: normalized.criterionJoins ?? [],
      membershipScope:
        updated?.membershipScope === 'tenant' ||
        updated?.membershipScope === 'owner_emails'
          ? updated.membershipScope
          : 'owner_emails',
      membershipOwnerEmails: Array.isArray(updated?.membershipOwnerEmails)
        ? (updated.membershipOwnerEmails as unknown[]).filter(
            (e): e is string => typeof e === 'string'
          )
        : [],
      memberCount,
      createdAt:
        updated?.createdAt instanceof Date
          ? updated.createdAt.toISOString()
          : null,
      updatedAt:
        updated?.updatedAt instanceof Date
          ? updated.updatedAt.toISOString()
          : null
    }
  }
})
