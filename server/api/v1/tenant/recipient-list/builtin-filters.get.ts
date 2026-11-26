import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { requireTenantAdvancedRecipientFiltering } from '@server/utils/requireTenantAdvancedRecipientFiltering'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'
import { withMarketableContactFilter } from '@server/utils/contact/marketableContact'
import { parseAudienceKey } from '@server/utils/recipient/recipientListAudience'
import { recipientFilterContactValueOptions } from '@server/utils/recipient/recipientFilterContactValues'
import { BUILTIN_FILTERS, builtinFilterDoc } from '~~/shared/campaignBuiltinFilters'

/**
 * Advanced Recipient Filtering: the standard contact fields (state, city, ZIP, company, source, …)
 * as filter choices for one contact type, with the values the caller's contacts already hold.
 * Fields no contact has a value for are left out so the picker only offers useful choices.
 */
export default defineEventHandler(async (event) => {
  const { auth } = await requireTenantAdvancedRecipientFiltering(event)

  const audience = parseAudienceKey(getQuery(event).audience)
  if (!audience) return { filters: [] }

  const conn = await getTenantConnectionFromEvent(event)
  const docs = BUILTIN_FILTERS.map((def) => builtinFilterDoc(`builtin:${def.key}`, audience)!)

  const optionsById = await recipientFilterContactValueOptions({
    tenantConn: conn,
    contactFilter: mergeTenantOwnerEmailScopeFilter(withMarketableContactFilter({}), auth) as Record<
      string,
      unknown
    >,
    filterDocs: docs
  })

  return {
    filters: docs
      .map((doc) => ({
        id: doc._id,
        tenantId: '',
        name: doc.name,
        contactType: doc.contactType,
        property: doc.property,
        propertyType: doc.propertyType,
        propertyValue: '',
        valuesFromContacts: doc.valuesFromContacts,
        valueOptions: optionsById.get(doc._id) ?? [],
        enabled: true
      }))
      .filter((f) => !f.valuesFromContacts || f.valueOptions.length > 0)
  }
})
