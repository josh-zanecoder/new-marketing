import { getRegistryConnection } from '@server/lib/mongoose'
import {
  isRegisteredTenantAuthContext,
  type RegisteredTenantAuthContext
} from '@server/tenant/registry-auth'
import type { RegistryTenantDoc } from '@server/types/registry/registryTenant.types'
import { parseAllowTenantInsertImage } from '~~/shared/allowTenantInsertImage'
import { parseAllowTenantReplaceImage } from '~~/shared/allowTenantReplaceImage'
import { parseAllowTenantTemplateBuilder } from '~~/shared/allowTenantTemplateBuilder'

/** Ensure tenant auth + superadmin Insert image permission is ON. */
export async function requireTenantInsertImage(
  event: { context: { auth?: unknown } },
  disabledMessage = 'Insert image is disabled for this tenant'
): Promise<{ dbName: string; auth: RegisteredTenantAuthContext }> {
  const auth = event.context.auth
  if (!isRegisteredTenantAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Missing or invalid tenant context' })
  }
  const dbName = typeof auth.dbName === 'string' ? auth.dbName : ''
  if (!dbName) {
    throw createError({ statusCode: 403, message: 'Missing or invalid tenant context' })
  }
  const registry = await getRegistryConnection()
  const regDoc = await registry.collection('clients').findOne(
    { dbName },
    { projection: { allowTenantInsertImage: 1 } }
  )
  if (!parseAllowTenantInsertImage(regDoc?.allowTenantInsertImage)) {
    throw createError({ statusCode: 403, message: disabledMessage })
  }
  return { dbName, auth }
}

/**
 * Hosted template photos are shared by the HTML editor and the template editor.
 * Insert image covers the HTML editor. The template editor is allowed on its own.
 */
export async function requireTenantEmailTemplateImageHost(
  event: { context: { auth?: unknown } }
): Promise<{ dbName: string; auth: RegisteredTenantAuthContext }> {
  const auth = event.context.auth
  if (!isRegisteredTenantAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Missing or invalid tenant context' })
  }
  const dbName = typeof auth.dbName === 'string' ? auth.dbName : ''
  if (!dbName) {
    throw createError({ statusCode: 403, message: 'Missing or invalid tenant context' })
  }
  const registry = await getRegistryConnection()
  const regDoc = await registry.collection('clients').findOne(
    { dbName },
    { projection: { allowTenantInsertImage: 1, allowTenantReplaceImage: 1, allowTenantTemplateBuilder: 1 } }
  )
  const allowed = parseAllowTenantInsertImage(regDoc?.allowTenantInsertImage)
    || parseAllowTenantReplaceImage(regDoc as RegistryTenantDoc | null)
    || parseAllowTenantTemplateBuilder(regDoc?.allowTenantTemplateBuilder)
  if (!allowed) {
    throw createError({
      statusCode: 403,
      message: 'Adding images to email templates is disabled for this tenant'
    })
  }
  return { dbName, auth }
}
