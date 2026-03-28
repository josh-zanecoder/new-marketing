import type { Connection } from 'mongoose'
import { getTenantConnectionByTenantId } from '../tenant/connection'
import { logger } from '../utils/logger'

export async function getTenantConnectionForInboundEvent(
  tenantId: string,
  logCtx: { eventType?: string; dBname?: string }
): Promise<Connection | null> {
  const conn = await getTenantConnectionByTenantId(tenantId)
  if (!conn) {
    logger.warn('Kafka inbound: no tenant DB for tenantId (missing registry row or invalid dbName)', {
      tenantId,
      ...logCtx
    })
  }
  return conn
}
