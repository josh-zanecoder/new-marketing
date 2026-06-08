import {
  createRecipientListReadContext,
  loadRecipientListFormScope,
  loadRecipientListFullCatalog,
  loadRecipientListIndexPage,
  loadRecipientListNameOptions,
  loadRecipientListPickerCatalog,
  parseRecipientListScope
} from '@server/utils/recipient/recipientListIndexRead'

export default defineEventHandler(async (event) => {
  const ctx = await createRecipientListReadContext(event)
  const scope = parseRecipientListScope(getQuery(event).scope)

  switch (scope) {
    case 'lists':
      return loadRecipientListNameOptions(ctx)
    case 'picker':
      return loadRecipientListPickerCatalog(ctx)
    case 'index':
      return loadRecipientListIndexPage(ctx)
    case 'form':
      return loadRecipientListFormScope(ctx)
    default:
      return loadRecipientListFullCatalog(ctx)
  }
})
