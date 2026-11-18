/** CRM role codes for the Marketing Flyers tab (passed via handoff JWT). */
export const MARKETING_FLYERS_READ_PERMISSION = 'marketing:flyers:read' as const
export const MARKETING_FLYERS_ADD_PERMISSION = 'marketing:flyers:add' as const
export const MARKETING_FLYERS_DELETE_PERMISSION = 'marketing:flyers:delete' as const

export const MARKETING_FLYERS_PERMISSIONS = [
  MARKETING_FLYERS_READ_PERMISSION,
  MARKETING_FLYERS_ADD_PERMISSION,
  MARKETING_FLYERS_DELETE_PERMISSION,
] as const
