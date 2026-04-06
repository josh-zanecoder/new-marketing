import type { Types } from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { ContactKind } from '@server/types/tenant/contact.model'
import type { RecipientListFilterMode } from '@server/types/tenant/recipientList.model'
import {
  isRegisteredTenantAuthContext,
  recipientListMembershipOwnerEmailsFromAuth,
  recipientListMembershipScopeFromAuth,
  recipientListOwnershipFromAuth
} from '@server/tenant/registry-auth'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import {
  pickJoinsForQuery,
  rebuildRecipientListMembers,
  resolveRecipientListFiltersFromBody
} from '@server/utils/recipient/recipientListMutation'

type CreatedRecipientList = {
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

  const { filters, criterionGroups, persistedFilterRows, criterionJoinsFromBody } =
    await resolveRecipientListFiltersFromBody(body, tenantConn, audience)
  const { RecipientList } = getTenantClientModels(tenantConn)

  const joinsToStore =
    criterionJoinsFromBody !== null
      ? criterionJoinsFromBody
      : Array.from({ length: Math.max(0, criterionGroups.length - 1) }, () => 'and' as const)

  const ownership = recipientListOwnershipFromAuth(auth)
  const membershipScope = recipientListMembershipScopeFromAuth(auth)
  const membershipOwnerEmails =
    membershipScope === 'owner_emails'
      ? recipientListMembershipOwnerEmailsFromAuth(auth)
      : []

  const created = await RecipientList.create({
    name,
    description: '',
    listType: 'dynamic',
    audience,
    filters,
    filterMode,
    filterRows: persistedFilterRows,
    criterionJoins: joinsToStore,
    clientId: '',
    membershipScope,
    membershipOwnerEmails,
    ...ownership
  })

  const listId = created._id as Types.ObjectId
  const joinsForRebuild = pickJoinsForQuery(
    criterionGroups,
    criterionJoinsFromBody,
    { criterionJoins: joinsToStore }
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

  const lean = created.toObject() as CreatedRecipientList

  return {
    list: {
      id: String(created._id),
      name: lean.name ?? '',
      listType: lean.listType ?? '',
      audience: lean.audience ?? '',
      filters: lean.filters ?? [],
      filterMode: lean.filterMode === 'or' ? 'or' : 'and',
      criterionJoins: Array.isArray(lean.criterionJoins)
        ? lean.criterionJoins.map((j) => (j === 'or' ? 'or' : 'and'))
        : [],
      membershipScope:
        lean.membershipScope === 'tenant' || lean.membershipScope === 'owner_emails'
          ? lean.membershipScope
          : 'owner_emails',
      membershipOwnerEmails: Array.isArray(lean.membershipOwnerEmails)
        ? lean.membershipOwnerEmails.filter((e): e is string => typeof e === 'string')
        : [],
      memberCount,
      createdAt: lean.createdAt?.toISOString?.() ?? null,
      updatedAt: lean.updatedAt?.toISOString?.() ?? null
    }
  }
})
