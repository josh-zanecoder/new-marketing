import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { isRegisteredTenantAuthContext } from '@server/tenant/registry-auth'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import {
  buildCriteriaChainForList,
  loadRecipientListMembersPage,
  parseMembersPageQuery,
  resolveFilterRowsForList,
  serializeListDetailHeader
} from '@server/utils/recipient/recipientListDetailRead'
import { normalizeRecipientListDoc } from '@server/utils/recipient/recipientListNormalization'
import type { RecipientListLeanDoc } from '@server/utils/recipient/recipientListSerialization'

function parseDetailScope(raw: unknown): 'edit' | 'members' | 'detail' {
  const value = String(Array.isArray(raw) ? raw[0] : (raw ?? '')).toLowerCase()
  if (value === 'edit') return 'edit'
  if (value === 'members') return 'members'
  return 'detail'
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
  const tenantConn = await getTenantConnectionFromEvent(event)
  const models = getTenantClientModels(tenantConn)

  const doc = (await models.RecipientList.findOne(
    mergeTenantOwnerEmailScopeFilter({ _id: listId }, auth)
  )
    .lean()
    .exec()) as RecipientListLeanDoc | null

  if (!doc) {
    throw createError({ statusCode: 404, message: 'List not found' })
  }

  const { audience, filters, filterMode, criterionJoins } = normalizeRecipientListDoc(doc)
  const scope = parseDetailScope(getQuery(event).scope)

  if (scope === 'edit') {
    const filterRows = await resolveFilterRowsForList(doc, audience, filters, models.RecipientFilter)
    return {
      list: {
        name: doc.name ?? '',
        audience,
        filterMode,
        criterionJoins: criterionJoins ?? [],
        filterRows
      }
    }
  }

  const { page, pageSize } = parseMembersPageQuery(getQuery(event) as Record<string, unknown>)
  const members = await loadRecipientListMembersPage({
    models,
    listId,
    auth,
    page,
    pageSize
  })

  if (scope === 'members') {
    return { members }
  }

  const { criteriaChain, filterRows } = await buildCriteriaChainForList(
    doc,
    audience,
    filters,
    models.RecipientFilter
  )

  return {
    list: serializeListDetailHeader(doc, { criteriaChain, filterRows }),
    members
  }
})
