import {
  getTenantClientModels,
  type TenantClientModels
} from '../../models/tenant/tenantClientModels'
import {
  EMAIL_TEMPLATE_EVENT_TYPES,
  type EmailTemplateDeletedEventEnvelope,
  type EmailTemplateUpsertEventEnvelope
} from '../../schemas/events/emailTemplateEvents'
import { logger } from '../../utils/logger'
import { getTenantConnectionForInboundEvent } from '../tenantConnection'

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

  await models.EmailTemplate.updateOne(
    { externalId },
    {
      $set: {
        externalId,
        name,
        description,
        subject,
        htmlTemplate
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

  await models.EmailTemplate.updateOne(
    { externalId },
    {
      $set: {
        externalId,
        name,
        description,
        subject,
        htmlTemplate
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
  if (typeof models.EmailTemplate.deleteOne !== 'function') {
    logger.warn('EmailTemplate model is not available in tenant models', { tenantId, dBname })
    return
  }

  await models.EmailTemplate.deleteOne({ externalId })
}
