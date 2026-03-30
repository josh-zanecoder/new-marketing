/**
 * httpOnly JWT from `POST /api/v1/auth/tenant-handoff` (CRM launch). `sub` = registry `dbName`.
 */
export const MARKETING_TENANT_SESSION_COOKIE = 'marketing_tenant_session'

/**
 * Non-httpOnly flag so client middleware allows navigation without Firebase when CRM handoff set session.
 */
export const MARKETING_TENANT_BRIDGE_COOKIE = 'marketing_tenant_bridge'

/** Align with typical session length (7 days). */
export const TENANT_AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
