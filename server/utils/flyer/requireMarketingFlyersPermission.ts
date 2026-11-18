import { createError, type H3Event } from 'h3'
import { isTenantApiKeyAuthContext } from '@server/tenant/registry-auth'
import {
  MARKETING_FLYERS_ADD_PERMISSION,
  MARKETING_FLYERS_DELETE_PERMISSION,
  MARKETING_FLYERS_READ_PERMISSION
} from '~~/shared/constants/marketingFlyersPermissions'

type FlyersPermission =
  | typeof MARKETING_FLYERS_READ_PERMISSION
  | typeof MARKETING_FLYERS_ADD_PERMISSION
  | typeof MARKETING_FLYERS_DELETE_PERMISSION

/**
 * Enforce CRM handoff flyers permissions when the session carries a permission snapshot.
 * Firebase / legacy API-key sessions without `permissions` stay unrestricted (same as FE).
 */
export function requireMarketingFlyersPermission(
  event: H3Event,
  permission: FlyersPermission
): void {
  const auth = event.context.auth
  if (!isTenantApiKeyAuthContext(auth)) return
  if (auth.permissions === undefined) return

  const granted = new Set(auth.permissions)
  if (granted.has(permission)) return

  throw createError({
    statusCode: 403,
    message: `Missing permission: ${permission}`
  })
}
