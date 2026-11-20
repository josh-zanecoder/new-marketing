export const ADMIN_DELETED_FLYERS_TAB_LABEL = 'Deleted flyers' as const
export const ADMIN_DELETED_FLYERS_RECOVER_TITLE = 'Recover flyer' as const
export const ADMIN_DELETED_FLYERS_RECOVER_CONFIRM = 'Recover' as const
export const ADMIN_DELETED_FLYERS_HARD_DELETE_TITLE = 'Delete forever' as const
export const ADMIN_DELETED_FLYERS_HARD_DELETE_CONFIRM = 'Delete forever' as const

export function buildAdminDeletedFlyerRecoverMessage(flyerName: string): string {
  const name = String(flyerName ?? '').trim() || 'this flyer'
  return `Recover “${name}”? It will return to the tenant Custom Flyers library.`
}

export function buildAdminDeletedFlyerHardDeleteMessage(flyerName: string): string {
  const name = String(flyerName ?? '').trim() || 'this flyer'
  return `Delete “${name}” forever? This removes the library row and the hosted file. This cannot be undone.`
}
