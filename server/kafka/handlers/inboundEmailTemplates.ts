import {
  getTenantClientModels,
  type TenantClientModels
} from '../../models/tenant/tenantClientModels'
import { logger } from '../../utils/logger'
import { getTenantConnectionForInboundEvent } from '../tenantConnection'

export async function saveMarketingEmailTemplateFromCreatedEvent(
  parsed: Record<string, unknown>
): Promise<void> {
  const tenantId = typeof parsed.tenantId === 'string' ? parsed.tenantId.trim() : ''
  const dBname = typeof parsed.dBname === 'string' ? parsed.dBname : ''
  const payload =
    parsed.payload && typeof parsed.payload === 'object'
      ? (parsed.payload as Record<string, unknown>)
      : null

  if (!tenantId || !payload) {
    logger.warn('Invalid marketing.email_template.created schema', { parsed })
    return
  }

  const externalId = typeof payload.externalId === 'string' ? payload.externalId : ''
  const name = typeof payload.name === 'string' ? payload.name : ''
  const subject = typeof payload.subject === 'string' ? payload.subject : ''
  const htmlTemplate = typeof payload.htmlTemplate === 'string' ? payload.htmlTemplate : ''
  const description = typeof payload.description === 'string' ? payload.description : ''

  if (!externalId || !name || !subject || !htmlTemplate) {
    logger.warn('Invalid marketing.email_template.created payload fields', {
      tenantId,
      dBname,
      externalId,
      name,
      subject
    })
    return
  }

  const tenantConn = await getTenantConnectionForInboundEvent(tenantId, {
    eventType: 'marketing.email_template.created',
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
  parsed: Record<string, unknown>
): Promise<void> {
  const tenantId = typeof parsed.tenantId === 'string' ? parsed.tenantId.trim() : ''
  const dBname = typeof parsed.dBname === 'string' ? parsed.dBname : ''
  const payload =
    parsed.payload && typeof parsed.payload === 'object'
      ? (parsed.payload as Record<string, unknown>)
      : null

  if (!tenantId || !payload) {
    logger.warn('Invalid marketing.email_template.updated schema', { parsed })
    return
  }

  const externalId = typeof payload.externalId === 'string' ? payload.externalId : ''
  const name = typeof payload.name === 'string' ? payload.name : ''
  const subject = typeof payload.subject === 'string' ? payload.subject : ''
  const htmlTemplate = typeof payload.htmlTemplate === 'string' ? payload.htmlTemplate : ''
  const description = typeof payload.description === 'string' ? payload.description : ''

  if (!externalId || !name || !subject || !htmlTemplate) {
    logger.warn('Invalid marketing.email_template.updated payload fields', {
      tenantId,
      dBname,
      externalId,
      name,
      subject
    })
    return
  }

  const tenantConn = await getTenantConnectionForInboundEvent(tenantId, {
    eventType: 'marketing.email_template.updated',
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
  parsed: Record<string, unknown>
): Promise<void> {
  const tenantId = typeof parsed.tenantId === 'string' ? parsed.tenantId.trim() : ''
  const dBname = typeof parsed.dBname === 'string' ? parsed.dBname : ''
  const payload =
    parsed.payload && typeof parsed.payload === 'object'
      ? (parsed.payload as Record<string, unknown>)
      : null
  const externalId = payload && typeof payload.externalId === 'string' ? payload.externalId : ''

  if (!tenantId || !externalId) {
    logger.warn('Invalid marketing.email_template.deleted schema', { parsed })
    return
  }

  const tenantConn = await getTenantConnectionForInboundEvent(tenantId, {
    eventType: 'marketing.email_template.deleted',
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
