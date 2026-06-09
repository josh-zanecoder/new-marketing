import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import {
  loadContactsListPage,
  parseContactListQuery
} from '@server/utils/contact/contactListRead'

export default defineEventHandler(async (event) => {
  const conn = await getTenantConnectionFromEvent(event)
  const models = getTenantClientModels(conn)
  const auth = event.context.auth as unknown
  const query = parseContactListQuery(getQuery(event) as Record<string, unknown>)
  return loadContactsListPage(models, auth, query)
})
