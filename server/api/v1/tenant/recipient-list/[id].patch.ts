import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { ContactKind } from '@server/types/tenant/contact.model'
import type { RecipientListFilterMode } from '@server/types/tenant/recipientList.model'
import { isRegisteredTenantAuthContext } from '@server/tenant/registry-auth'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
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

  const existing = await RecipientList.findById(listId).lean().exec()
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

  await RecipientList.findByIdAndUpdate(listId, updateDoc).exec()

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
