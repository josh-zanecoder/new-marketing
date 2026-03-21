import type { Connection } from 'mongoose'
import type { H3Event } from 'h3'
import { getRegistryConnection } from '../lib/mongoose'
import {
  isAdminAuthContext,
  isRegisteredTenantAuthContext
} from './registry-auth'

/** Matches tenant DB names produced by `toTenantDbName` and typical Mongo naming. */
const TENANT_DB_NAME = /^[a-z0-9][a-z0-9_]{0,62}$/i

function normalizeAndAssertTenantDbName(raw: string): string {
  const dbName = raw.trim()
  if (!dbName || !TENANT_DB_NAME.test(dbName)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid tenant database name'
    })
  }
  return dbName
}

/**
 * Mongoose connection for the authenticated tenant database only.
 * Rejects admin sessions so registry/admin data cannot be mixed with tenant routes by mistake.
 */
export async function getTenantConnectionFromEvent(
  event: H3Event
): Promise<Connection> {
  const auth = event.context.auth as unknown

  if (!auth || typeof auth !== 'object') {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  if (isAdminAuthContext(auth)) {
    throw createError({
      statusCode: 403,
      message: 'Tenant-scoped routes require a tenant session or tenant API key'
    })
  }
  if (!isRegisteredTenantAuthContext(auth)) {
    throw createError({
      statusCode: 403,
      message: 'Missing or invalid tenant context'
    })
  }

  const dbName = normalizeAndAssertTenantDbName(auth.dbName)
  const registry = await getRegistryConnection()
  return registry.useDb(dbName)
}

/**
 * Same DB selection as {@link getTenantConnectionFromEvent}, for workers/cron.
 * Pass only `dbName` values that originated from trusted server state (e.g. job payload from enqueue), never raw user input.
 */
export async function getTenantConnectionByDbName(
  dbName: string
): Promise<Connection> {
  const normalized = normalizeAndAssertTenantDbName(dbName)
  const registry = await getRegistryConnection()
  return registry.useDb(normalized)
}
