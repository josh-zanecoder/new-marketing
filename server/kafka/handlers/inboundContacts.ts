import type {
  ContactDeletedEventEnvelope,
  ContactEventEnvelope
} from '../../schemas/events/contactEvents'
import { getTenantClientModels } from '../../models/tenant/tenantClientModels'
import { getTenantConnectionForInboundEvent } from '../tenantConnection'

/** Stable id for Mongo upserts; do not rename without a migration. */
const KAFKA_INBOUND_CONTACT_SOURCE = 'crm-kafka'

export async function createContactFromCreatedEvent(contactEvent: ContactEventEnvelope): Promise<void> {
  const tenantConn = await getTenantConnectionForInboundEvent(contactEvent.tenantId, {
    eventType: contactEvent.eventType,
    dBname: contactEvent.dBname
  })
  if (!tenantConn) return
  const models = getTenantClientModels(tenantConn)
  const email = String(contactEvent.payload.email || '').toLowerCase()
  const payloadMetadata =
    (contactEvent.payload as unknown as { metadata?: Record<string, unknown> }).metadata ?? {}
  const ownerId =
    typeof payloadMetadata.ownerId === 'string' ? payloadMetadata.ownerId : ''
  const ownerEmail =
    typeof payloadMetadata.ownerEmail === 'string' ? payloadMetadata.ownerEmail : ''
  await models.Contact.updateOne(
    {
      externalId: contactEvent.payload.externalId,
      source: KAFKA_INBOUND_CONTACT_SOURCE
    },
    {
      $set: {
        externalId: contactEvent.payload.externalId,
        source: KAFKA_INBOUND_CONTACT_SOURCE,
        contactKind: contactEvent.payload.contactType,
        name: contactEvent.payload.name,
        email,
        phone: contactEvent.payload.phone ?? '',
        address: contactEvent.payload.address,
        company: contactEvent.payload.company || '',
        channel: contactEvent.payload.channel ?? 'email',
        deletedAt: null,
        metadata: {
          tenantId: contactEvent.tenantId,
          eventType: contactEvent.eventType,
          occurredAt: contactEvent.occurredAt,
          ...(ownerId ? { ownerId } : {}),
          ...(ownerEmail ? { ownerEmail } : {})
        }
      }
    },
    { upsert: true }
  )
}

export async function updateContactFromUpdatedEvent(contactEvent: ContactEventEnvelope): Promise<void> {
  const tenantConn = await getTenantConnectionForInboundEvent(contactEvent.tenantId, {
    eventType: contactEvent.eventType,
    dBname: contactEvent.dBname
  })
  if (!tenantConn) return
  const models = getTenantClientModels(tenantConn)
  const email = String(contactEvent.payload.email || '').toLowerCase()
  const payloadMetadata =
    (contactEvent.payload as unknown as { metadata?: Record<string, unknown> }).metadata ?? {}
  const ownerId =
    typeof payloadMetadata.ownerId === 'string' ? payloadMetadata.ownerId : ''
  const ownerEmail =
    typeof payloadMetadata.ownerEmail === 'string' ? payloadMetadata.ownerEmail : ''
  await models.Contact.updateOne(
    {
      externalId: contactEvent.payload.externalId,
      source: KAFKA_INBOUND_CONTACT_SOURCE
    },
    {
      $set: {
        externalId: contactEvent.payload.externalId,
        source: KAFKA_INBOUND_CONTACT_SOURCE,
        contactKind: contactEvent.payload.contactType,
        name: contactEvent.payload.name,
        email,
        phone: contactEvent.payload.phone ?? '',
        address: contactEvent.payload.address,
        company: contactEvent.payload.company || '',
        channel: contactEvent.payload.channel ?? 'email',
        deletedAt: null,
        metadata: {
          tenantId: contactEvent.tenantId,
          eventType: contactEvent.eventType,
          occurredAt: contactEvent.occurredAt,
          ...(ownerId ? { ownerId } : {}),
          ...(ownerEmail ? { ownerEmail } : {})
        }
      }
    },
    { upsert: true }
  )
}

export async function softDeleteContactFromDeletedEvent(
  deletedEvent: ContactDeletedEventEnvelope
): Promise<void> {
  const tenantConn = await getTenantConnectionForInboundEvent(deletedEvent.tenantId, {
    eventType: deletedEvent.eventType,
    dBname: deletedEvent.dBname
  })
  if (!tenantConn) return
  const models = getTenantClientModels(tenantConn)
  const deletedAt = new Date()
  const payloadMetadata =
    (deletedEvent.payload as unknown as { metadata?: Record<string, unknown> }).metadata ?? {}
  const ownerId =
    typeof payloadMetadata.ownerId === 'string' ? payloadMetadata.ownerId : ''
  const ownerEmail =
    typeof payloadMetadata.ownerEmail === 'string' ? payloadMetadata.ownerEmail : ''
  await models.Contact.updateOne(
    {
      externalId: deletedEvent.payload.externalId,
      source: KAFKA_INBOUND_CONTACT_SOURCE
    },
    {
      $set: {
        deletedAt,
        metadata: {
          tenantId: deletedEvent.tenantId,
          eventType: deletedEvent.eventType,
          occurredAt: deletedEvent.occurredAt,
          ...(ownerId ? { ownerId } : {}),
          ...(ownerEmail ? { ownerEmail } : {})
        }
      }
    }
  )
}
