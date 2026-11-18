import {
  MARKETING_FLYERS_ADD_PERMISSION,
  MARKETING_FLYERS_DELETE_PERMISSION,
  MARKETING_FLYERS_READ_PERMISSION,
} from '../constants/marketingFlyersPermissions'

export type MarketingFlyersAccessInput = {
  /** When null/undefined, session has no CRM snapshot (Firebase/legacy) — allow all. */
  permissions: readonly string[] | null | undefined
  /** When false, treat as no CRM snapshot. */
  hasCrmPermissionSnapshot: boolean
}

export type MarketingFlyersAccess = {
  canReadFlyers: boolean
  canAddFlyers: boolean
  canDeleteFlyers: boolean
}

function hasCode(
  granted: ReadonlySet<string> | null,
  code: string
): boolean {
  if (granted === null) return true
  return granted.has(code)
}

/** Pure CRM handoff gates for the Marketing Flyers tab. */
export function resolveMarketingFlyersAccess(
  input: MarketingFlyersAccessInput
): MarketingFlyersAccess {
  const granted =
    input.hasCrmPermissionSnapshot
      ? new Set(input.permissions ?? [])
      : null

  return {
    canReadFlyers: hasCode(granted, MARKETING_FLYERS_READ_PERMISSION),
    canAddFlyers: hasCode(granted, MARKETING_FLYERS_ADD_PERMISSION),
    canDeleteFlyers: hasCode(granted, MARKETING_FLYERS_DELETE_PERMISSION),
  }
}
