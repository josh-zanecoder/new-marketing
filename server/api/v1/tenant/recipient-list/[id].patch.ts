import mongoose from 'mongoose'
import { getRegistryConnection } from '../../../../lib/mongoose'
import { getTenantClientModels } from '../../../../models/tenant/tenantClientModels'
import type { ContactKind } from '../../../../types/tenant/contact.model'
import type { RecipientListFilterMode } from '../../../../types/tenant/recipientList.model'
import {
  isRegisteredTenantAuthContext,
  resolveTenantIdForTenantAuth
} from '../../../../tenant/registry-auth'
import { getTenantConnectionFromEvent } from '../../../../tenant/connection'
import { normalizeRecipientListDoc } from '../../../../utils/recipientListDocument'
import {
  rebuildRecipientListMembers,
  resolveRecipientListFiltersFromBody
} from '../../../../utils/recipientListMutation'

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

  const registryConn = await getRegistryConnection()
  const tenantId = await resolveTenantIdForTenantAuth(registryConn, auth)

  const { filters, criterionGroups, persistedFilterRows } =
    await resolveRecipientListFiltersFromBody(body, registryConn, tenantId, audience)

  const tenantConn = await getTenantConnectionFromEvent(event)
  const { RecipientList } = getTenantClientModels(tenantConn)

  const existing = await RecipientList.findById(listId).lean().exec()
  if (!existing) {
    throw createError({ statusCode: 404, message: 'List not found' })
  }

  await RecipientList.findByIdAndUpdate(listId, {
    name,
    audience,
    filters,
    filterMode,
    filterRows: persistedFilterRows
  }).exec()

  const memberCount = await rebuildRecipientListMembers(
    tenantConn,
    listId,
    audience,
    filters,
    filterMode,
    criterionGroups,
    auth
  )

  const updated = (await RecipientList.findById(listId).lean().exec()) as Record<
    string,
    unknown
  > | null
  const normalized = updated
    ? normalizeRecipientListDoc(updated)
    : { audience, filters, filterMode }

  return {
    list: {
      id: String(listId),
      name: typeof updated?.name === 'string' ? updated.name : name,
      listType: typeof updated?.listType === 'string' ? updated.listType : 'dynamic',
      audience: normalized.audience,
      filters: normalized.filters,
      filterMode: normalized.filterMode,
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
