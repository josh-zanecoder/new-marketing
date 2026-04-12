import type { Types } from 'mongoose'
import {
  namesFromContactPayload,
  type ContactDeletedEventEnvelope,
  type ContactEventEnvelope,
  type ContactPayload
} from '../schemas/events/contactEvents'
import { getTenantClientModels } from '../../models/tenant/tenantClientModels'
import { getTenantConnectionForInboundEvent } from '../tenantConnection'
import { syncContactRecipientListMembership } from '@server/utils/recipient/syncContactRecipientListMembership'
import {
  applyContactTypeFieldsToSetDoc,
  normalizeContactTypeInput
} from '@server/utils/contact/contactTypeWrite'
import { resolveDefaultContactTypeKey } from '@server/utils/contact/resolveDefaultContactTypeKey'

/** Stable id for Mongo upserts; do not rename without a migration. */
const KAFKA_INBOUND_CONTACT_SOURCE = 'crm-kafka'

function readContactProfileFromInboundPayload(
  payload: Record<string, unknown>
): { typeKey: string; subtypeKeys: string[] } | null {
  const raw = payload.contactProfile
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const typeKey = typeof o.typeKey === 'string' ? o.typeKey.trim().toLowerCase() : ''
  if (!typeKey) return null
  const sk = o.subtypeKeys
  const subtypeKeys = Array.isArray(sk)
    ? sk.map((x) => String(x).trim().toLowerCase()).filter(Boolean)
    : []
  return { typeKey, subtypeKeys }
}

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
  contactTypes?: string[]
  channel?: string
  metadata?: Record<string, unknown>
}

type SyncSnapshotUpsertRow = {
  externalId: string
  email: string
  firstName: string
  lastName: string
  phone: string
  address: Record<string, unknown>
  company: string
  channel: string
  ownerId: string
  ownerEmail: string
  /** Normalized keys written to `contactType` on the tenant contact. */
  contactTypeKeys: string[]
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
  const p = contactEvent.payload as ContactPayload & { contactTypes?: unknown }
  const setDoc: Record<string, unknown> = {
    externalId: contactEvent.payload.externalId,
    source: KAFKA_INBOUND_CONTACT_SOURCE,
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
  const fromMulti = normalizeContactTypeInput(p.contactTypes)
  const fromSingle = normalizeContactTypeInput(p.contactType)
  setDoc.contactType = fromMulti.length ? fromMulti : fromSingle
  await applyContactTypeFieldsToSetDoc(setDoc, tenantConn)
  const profile = readContactProfileFromInboundPayload(p as unknown as Record<string, unknown>)
  if (profile) {
    setDoc.contactProfile = profile
  }
  await models.Contact.updateOne(
    {
      externalId: contactEvent.payload.externalId,
      source: KAFKA_INBOUND_CONTACT_SOURCE
    },
    { $set: setDoc },
    { upsert: true }
  )
  const doc = await models.Contact.findOne(
    {
      externalId: contactEvent.payload.externalId,
      source: KAFKA_INBOUND_CONTACT_SOURCE
    },
    { _id: 1 }
  ).lean()
  if (doc?._id) {
    await syncContactRecipientListMembership(tenantConn, doc._id as Types.ObjectId)
  }
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
  const pU = contactEvent.payload as ContactPayload & { contactTypes?: unknown }
  const setDocU: Record<string, unknown> = {
    externalId: contactEvent.payload.externalId,
    source: KAFKA_INBOUND_CONTACT_SOURCE,
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
  const fromMultiU = normalizeContactTypeInput(pU.contactTypes)
  const fromSingleU = normalizeContactTypeInput(pU.contactType)
  setDocU.contactType = fromMultiU.length ? fromMultiU : fromSingleU
  await applyContactTypeFieldsToSetDoc(setDocU, tenantConn)
  const profileU = readContactProfileFromInboundPayload(pU as unknown as Record<string, unknown>)
  if (profileU) {
    setDocU.contactProfile = profileU
  }
  await models.Contact.updateOne(
    {
      externalId: contactEvent.payload.externalId,
      source: KAFKA_INBOUND_CONTACT_SOURCE
    },
    { $set: setDocU },
    { upsert: true }
  )
  const doc = await models.Contact.findOne(
    {
      externalId: contactEvent.payload.externalId,
      source: KAFKA_INBOUND_CONTACT_SOURCE
    },
    { _id: 1 }
  ).lean()
  if (doc?._id) {
    await syncContactRecipientListMembership(tenantConn, doc._id as Types.ObjectId)
  }
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
  const doc = await models.Contact.findOne(
    {
      externalId: deletedEvent.payload.externalId,
      source: KAFKA_INBOUND_CONTACT_SOURCE
    },
    { _id: 1 }
  ).lean()
  if (doc?._id) {
    await syncContactRecipientListMembership(tenantConn, doc._id as Types.ObjectId)
  }
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
  const defaultTypeKey = await resolveDefaultContactTypeKey(tenantConn)

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
      let contactTypeKeys = normalizeContactTypeInput(
        Array.isArray(c.contactTypes) && c.contactTypes.length ? c.contactTypes : c.contactType
      )
      if (!contactTypeKeys.length) {
        contactTypeKeys = [defaultTypeKey]
      }
      const row: SyncSnapshotUpsertRow = {
        externalId,
        email,
        firstName,
        lastName,
        phone: c.phone ?? '',
        address: c.address ?? {},
        company: c.company ?? '',
        channel: c.channel ?? 'email',
        ownerId,
        ownerEmail,
        contactTypeKeys
      }
      return row
    })
    .filter((x): x is SyncSnapshotUpsertRow => Boolean(x))

  if (rows.length === 0) return 0
  await Promise.all(
    rows.map(async (r) => {
      const snapSet: Record<string, unknown> = {
        externalId: r.externalId,
        source: KAFKA_INBOUND_CONTACT_SOURCE,
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
        },
        contactType: r.contactTypeKeys
      }
      await applyContactTypeFieldsToSetDoc(snapSet, tenantConn)
      await models.Contact.updateOne(
        { externalId: r.externalId, source: KAFKA_INBOUND_CONTACT_SOURCE },
        { $set: snapSet },
        { upsert: true }
      )
      const doc = await models.Contact.findOne(
        { externalId: r.externalId, source: KAFKA_INBOUND_CONTACT_SOURCE },
        { _id: 1 }
      ).lean()
      if (doc?._id) {
        await syncContactRecipientListMembership(tenantConn, doc._id as Types.ObjectId)
      }
    })
  )
  return rows.length
}
