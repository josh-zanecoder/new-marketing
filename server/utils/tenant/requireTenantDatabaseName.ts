import { createError } from 'h3'

const TENANT_OPERATION_UNAVAILABLE =
  'We could not complete your request right now. Please contact your administrator.'

/**
 * Prevent connection/configuration details from reaching the browser while
 * retaining the operation that needs attention in the server log.
 */
export function requireTenantDatabaseName(
  dbName: string | null | undefined,
  operation: string
): string {
  if (dbName) return dbName

  console.error('[TenantDatabaseContext] missing database name', { operation })
  throw createError({ statusCode: 500, message: TENANT_OPERATION_UNAVAILABLE })
}
