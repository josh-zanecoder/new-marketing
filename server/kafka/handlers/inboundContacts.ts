import {
  namesFromContactPayload,
  type ContactDeletedEventEnvelope,
  type ContactEventEnvelope
} from '../../schemas/events/contactEvents'
import { getTenantClientModels } from '../../models/tenant/tenantClientModels'
import { getTenantConnectionForInboundEvent } from '../tenantConnection'

/** Stable id for Mongo upserts; do not rename without a migration. */
const KAFKA_INBOUND_CONTACT_SOURCE = 'crm-kafka'

type SyncSnapshotContact = {
  externalId: string
  firstName?: string
  lastName?: string
  /** @deprecated sync payloads may still send single name */
  name?: string
  email: string
  phone?: string
  company?: string
  address?: Record<string, unknown>
  contactType?: string
  channel?: string
  metadata?: Record<string, unknown>
}

type SyncSnapshotUpsertRow = {
  externalId: string
  email: string
  contactKind: 'prospect' | 'client' | 'contact'
  firstName: string
  lastName: string
  phone: string
  address: Record<string, unknown>
  company: string
  channel: string
  ownerId: string
  ownerEmail: string
}

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
  const { firstName, lastName } = namesFromContactPayload(contactEvent.payload)
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
        firstName,
        lastName,
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
  const { firstName: fnU, lastName: lnU } = namesFromContactPayload(contactEvent.payload)
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
        firstName: fnU,
        lastName: lnU,
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

export async function upsertContactsFromSyncSnapshot(params: {
  tenantId: string
  dBname: string
  occurredAt: string
  contacts: SyncSnapshotContact[]
}): Promise<number> {
  const tenantConn = await getTenantConnectionForInboundEvent(params.tenantId, {
    eventType: 'marketing.sync.requested',
    dBname: params.dBname
  })
  if (!tenantConn || !Array.isArray(params.contacts) || params.contacts.length === 0) return 0
  const models = getTenantClientModels(tenantConn)

  const rows = params.contacts
    .map((c) => {
      const externalId = String(c.externalId || '').trim()
      const email = String(c.email || '').trim().toLowerCase()
      if (!externalId || !email) return null
      const payloadMetadata = c.metadata ?? {}
      const ownerId = typeof payloadMetadata.ownerId === 'string' ? payloadMetadata.ownerId : ''
      const ownerEmail =
        typeof payloadMetadata.ownerEmail === 'string' ? payloadMetadata.ownerEmail : ''
      const fn = String(c.firstName ?? '').trim()
      const ln = String(c.lastName ?? '').trim()
      const legacy = String(c.name ?? '').trim()
      const firstName = fn || legacy
      const lastName = ln
      const row: SyncSnapshotUpsertRow = {
        externalId,
        email,
        contactKind:
          c.contactType === 'client' || c.contactType === 'contact' ? c.contactType : 'prospect',
        firstName,
        lastName,
        phone: c.phone ?? '',
        address: c.address ?? {},
        company: c.company ?? '',
        channel: c.channel ?? 'email',
        ownerId,
        ownerEmail
      }
      return row
    })
    .filter((x): x is SyncSnapshotUpsertRow => Boolean(x))

  if (rows.length === 0) return 0
  await Promise.all(
    rows.map((r) =>
      models.Contact.updateOne(
        { externalId: r.externalId, source: KAFKA_INBOUND_CONTACT_SOURCE },
        {
          $set: {
            externalId: r.externalId,
            source: KAFKA_INBOUND_CONTACT_SOURCE,
            contactKind: r.contactKind,
            firstName: r.firstName,
            lastName: r.lastName,
            email: r.email,
            phone: r.phone,
            address: r.address,
            company: r.company,
            channel: r.channel,
            deletedAt: null,
            metadata: {
              tenantId: params.tenantId,
              eventType: 'marketing.sync.requested',
              occurredAt: params.occurredAt,
              ...(r.ownerId ? { ownerId: r.ownerId } : {}),
              ...(r.ownerEmail ? { ownerEmail: r.ownerEmail } : {})
            }
          }
        },
        { upsert: true }
      )
    )
  )
  return rows.length
}
