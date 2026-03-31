import type { Types } from 'mongoose'
import { getTenantClientModels } from '../../../../models/tenant/tenantClientModels'
import type { ContactKind } from '../../../../types/tenant/contact.model'
import type { RecipientListFilterMode } from '../../../../types/tenant/recipientList.model'
import { isRegisteredTenantAuthContext } from '../../../../tenant/registry-auth'
import { getTenantConnectionFromEvent } from '../../../../tenant/connection'
import {
  rebuildRecipientListMembers,
  resolveRecipientListFiltersFromBody
} from '../../../../utils/recipientListMutation'

type CreatedRecipientList = {
  name?: string
  listType?: string
  audience?: string
  filters?: unknown[]
  filterMode?: string
  createdAt?: Date | null
  updatedAt?: Date | null
}

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

  const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>
  const name =
    typeof body?.name === 'string' ? body.name.trim().slice(0, 200) : ''
  if (!name) {
    throw createError({ statusCode: 400, message: 'Name is required' })
  }

  const audience = assertAudience(body?.audience)
  const filterMode = assertFilterMode(body?.filterMode)

  const tenantConn = await getTenantConnectionFromEvent(event)

  const { filters, criterionGroups, persistedFilterRows } =
    await resolveRecipientListFiltersFromBody(body, tenantConn, audience)
  const { RecipientList } = getTenantClientModels(tenantConn)

  const created = await RecipientList.create({
    name,
    description: '',
    listType: 'dynamic',
    audience,
    filters,
    filterMode,
    filterRows: persistedFilterRows,
    clientId: ''
  })

  const listId = created._id as Types.ObjectId
  const memberCount = await rebuildRecipientListMembers(
    tenantConn,
    listId,
    audience,
    filters,
    filterMode,
    criterionGroups,
    auth
  )

  const lean = created.toObject() as CreatedRecipientList

  return {
    list: {
      id: String(created._id),
      name: lean.name ?? '',
      listType: lean.listType ?? '',
      audience: lean.audience ?? '',
      filters: lean.filters ?? [],
      filterMode: lean.filterMode === 'or' ? 'or' : 'and',
      memberCount,
      createdAt: lean.createdAt?.toISOString?.() ?? null,
      updatedAt: lean.updatedAt?.toISOString?.() ?? null
    }
  }
})
