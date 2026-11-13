import type { H3Event } from 'h3'
import { getRegistryConnection } from '@server/lib/mongoose'
import { isRegisteredTenantAuthContext } from '@server/tenant/registry-auth'
import { resolveCustomMarketingTenantFolderName } from '@server/utils/customMarketing/resolveCustomMarketingTenantFolderName'
import { rewriteEmailTemplateImagesForHosting } from '@server/utils/emailTemplate/rewriteEmailTemplateImagesForHosting'
import { parseAllowTenantLoRecipientLists } from '~~/shared/allowTenantLoRecipientLists'
import { emailTemplateHtmlNeedsImageHosting } from '~~/shared/utils/emailTemplateHostableImages'

export type HostEmailTemplateHtmlImagesResult = {
  html: string
  hostedCount: number
  skippedRemoteCount: number
  skippedUnsupportedCount: number
}

function emptyHostResult(html: string): HostEmailTemplateHtmlImagesResult {
  return {
    html,
    hostedCount: 0,
    skippedRemoteCount: 0,
    skippedUnsupportedCount: 0
  }
}

/**
 * On email-template create/update: move hostable `<img>` assets into Images library.
 * Only when superadmin `allowTenantLoRecipientLists` is ON (same gate as Images upload).
 * Flag OFF → no-op, HTML unchanged (classic template save behavior).
 */
export async function hostEmailTemplateHtmlImagesOnSave(
  event: H3Event,
  html: string
): Promise<HostEmailTemplateHtmlImagesResult> {
  const source = String(html ?? '')
  if (!emailTemplateHtmlNeedsImageHosting(source)) {
    return emptyHostResult(source)
  }

  const auth = event.context.auth
  if (!isRegisteredTenantAuthContext(auth)) {
    // Flag-gated feature: without tenant auth, leave HTML as-is (do not break classic save).
    return emptyHostResult(source)
  }

  const dbName = typeof auth.dbName === 'string' ? auth.dbName : ''
  if (!dbName) {
    return emptyHostResult(source)
  }

  const registry = await getRegistryConnection()
  const regDoc = await registry.collection('clients').findOne(
    { dbName },
    { projection: { allowTenantLoRecipientLists: 1 } }
  )
  if (!parseAllowTenantLoRecipientLists(regDoc?.allowTenantLoRecipientLists)) {
    return emptyHostResult(source)
  }

  const tenantName = await resolveCustomMarketingTenantFolderName(auth).catch(() => '')
  if (!tenantName) {
    throw createError({
      statusCode: 400,
      message: 'Photos must be hosted for email clients. Configure GCS tenant credentials.'
    })
  }

  return rewriteEmailTemplateImagesForHosting(source, { tenantName })
}
