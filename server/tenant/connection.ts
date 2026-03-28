import type { Connection } from 'mongoose'
import type { H3Event } from 'h3'
import { getRegistryConnection } from '../lib/mongoose'
import {
  findRegistryTenantByTenantId,
  isAdminAuthContext,
  isRegisteredTenantAuthContext
} from './registry-auth'

/** Matches tenant DB names produced by `toTenantDbName` and typical Mongo naming. */
const TENANT_DB_NAME = /^[a-z0-9][a-z0-9_]{0,62}$/i

const MAX_REGISTRY_TENANT_ID_LEN = 128

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

/**
 * Resolves `clients.tenantId` in the registry to that row's `dbName`, then opens that Mongo database.
 * Use for Kafka inbound handlers and other trusted server paths keyed by marketing tenantId.
 * Returns null if the id is invalid, the client row is missing, or `dbName` fails normalization.
 */
export async function getTenantConnectionByTenantId(
  tenantIdRaw: string
): Promise<Connection | null> {
  const tenantId = tenantIdRaw.trim()
  if (!tenantId || tenantId.length > MAX_REGISTRY_TENANT_ID_LEN) return null
  const registry = await getRegistryConnection()
  const row = await findRegistryTenantByTenantId(registry, tenantId)
  if (!row?.dbName) return null
  try {
    const normalized = normalizeAndAssertTenantDbName(row.dbName)
    return registry.useDb(normalized)
  } catch {
    return null
  }
}
