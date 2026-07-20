import {
  getTenantClientModels,
  type TenantClientModels
} from '../../models/tenant/tenantClientModels'
import {
  EMAIL_TEMPLATE_EVENT_TYPES,
  type EmailTemplateDeletedEventEnvelope,
  type EmailTemplateUpsertEventEnvelope
} from '../schemas/events/emailTemplateEvents'
import { logger } from '../../utils/logger'
import { getTenantConnectionForInboundEvent } from '../tenantConnection'
import {
  isEmailTemplateHtmlStorageRef,
  resolveStoredEmailTemplateHtml
} from '../../utils/emailTemplate/resolveStoredEmailTemplateHtml'
import { ACTIVE_EMAIL_TEMPLATE_FILTER } from '~~/shared/utils/emailTemplateActive'

async function resolveHtmlForPersist(htmlTemplate: string, meta: Record<string, unknown>) {
  if (!isEmailTemplateHtmlStorageRef(htmlTemplate)) return htmlTemplate
  try {
    const resolved = await resolveStoredEmailTemplateHtml(htmlTemplate, {
      throwOnFetchError: true
    })
    if (resolved !== htmlTemplate) {
      logger.info('Resolved CRM email template HTML storage ref', {
        ...meta,
        refHost: (() => {
          try {
            return new URL(htmlTemplate).host
          } catch {
            return null
          }
        })(),
        resolvedChars: resolved.length
      })
    }
    return resolved
  } catch (err) {
    logger.warn('Failed to resolve CRM email template HTML storage ref; storing ref as-is', {
      ...meta,
      err: err instanceof Error ? err.message : String(err)
    })
    return htmlTemplate
  }
}

export async function saveMarketingEmailTemplateFromCreatedEvent(
  event: EmailTemplateUpsertEventEnvelope
): Promise<void> {
  const { tenantId, dBname, payload } = event
  const { externalId, name, subject, htmlTemplate, description } = payload

  const tenantConn = await getTenantConnectionForInboundEvent(tenantId, {
    eventType: EMAIL_TEMPLATE_EVENT_TYPES.CREATED,
    dBname
  })
  if (!tenantConn) return

  const models: TenantClientModels = getTenantClientModels(tenantConn)
  if (typeof models.EmailTemplate.updateOne !== 'function') {
    logger.warn('EmailTemplate model is not available in tenant models', { tenantId, dBname })
    return
  }

  const resolvedHtml = await resolveHtmlForPersist(htmlTemplate, {
    tenantId,
    dBname,
    externalId,
    eventType: EMAIL_TEMPLATE_EVENT_TYPES.CREATED
  })

  await models.EmailTemplate.updateOne(
    { externalId },
    {
      $set: {
        externalId,
        name,
        description,
        subject,
        htmlTemplate: resolvedHtml,
        deletedAt: null
      }
    },
    { upsert: true }
  )
}

export async function saveMarketingEmailTemplateFromUpdatedEvent(
  event: EmailTemplateUpsertEventEnvelope
): Promise<void> {
  const { tenantId, dBname, payload } = event
  const { externalId, name, subject, htmlTemplate, description } = payload

  const tenantConn = await getTenantConnectionForInboundEvent(tenantId, {
    eventType: EMAIL_TEMPLATE_EVENT_TYPES.UPDATED,
    dBname
  })
  if (!tenantConn) return

  const models: TenantClientModels = getTenantClientModels(tenantConn)
  if (typeof models.EmailTemplate.updateOne !== 'function') {
    logger.warn('EmailTemplate model is not available in tenant models', { tenantId, dBname })
    return
  }

  const resolvedHtml = await resolveHtmlForPersist(htmlTemplate, {
    tenantId,
    dBname,
    externalId,
    eventType: EMAIL_TEMPLATE_EVENT_TYPES.UPDATED
  })

  await models.EmailTemplate.updateOne(
    { externalId },
    {
      $set: {
        externalId,
        name,
        description,
        subject,
        htmlTemplate: resolvedHtml,
        deletedAt: null
      }
    },
    { upsert: true }
  )
}

export async function deleteMarketingEmailTemplateFromDeletedEvent(
  event: EmailTemplateDeletedEventEnvelope
): Promise<void> {
  const { tenantId, dBname, payload } = event
  const { externalId } = payload

  const tenantConn = await getTenantConnectionForInboundEvent(tenantId, {
    eventType: EMAIL_TEMPLATE_EVENT_TYPES.DELETED,
    dBname
  })
  if (!tenantConn) return

  const models: TenantClientModels = getTenantClientModels(tenantConn)
  if (typeof models.EmailTemplate.updateOne !== 'function') {
    logger.warn('EmailTemplate model is not available in tenant models', { tenantId, dBname })
    return
  }

  await models.EmailTemplate.updateOne(
    { externalId, ...ACTIVE_EMAIL_TEMPLATE_FILTER },
    { $set: { deletedAt: new Date() } }
  )
}
