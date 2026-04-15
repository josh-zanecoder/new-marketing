/** Keep equal to `server/constants/tenantAuth.constants` `TENANT_AUTH_COOKIE_MAX_AGE`. */
const TENANT_AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7

/**
 * Session cookies set by `POST /api/v1/auth/tenant-handoff` must work when Marketing is
 * embedded in retail (different origin/port). `SameSite=Lax` is often dropped in that
 * context; `SameSite=None` + `Secure` is required (localhost is a secure exception for
 * `Secure` in Chromium for local dev).
 *
 * Set `MARKETING_HANDOFF_COOKIES_SAMESITE=lax` only for legacy non-iframe deployments over plain HTTP.
 */
export function marketingTenantHandoffCookieBase(): {
  path: '/'
  sameSite: 'lax' | 'none'
  secure: boolean
  maxAge: number
} {
  if (process.env.MARKETING_HANDOFF_COOKIES_SAMESITE === 'lax') {
    return {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: TENANT_AUTH_COOKIE_MAX_AGE
    }
  }
  return {
    path: '/',
    sameSite: 'none',
    secure: true,
    maxAge: TENANT_AUTH_COOKIE_MAX_AGE
  }
}
