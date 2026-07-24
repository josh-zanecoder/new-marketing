import type { H3Event } from 'h3'
import mongoose from 'mongoose'
import { getRegistryConnection } from '@server/lib/mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { findRegistryTenantByDbName } from '@server/tenant/registry-auth'
import { getTenantConnectionByDbName } from '@server/tenant/connection'
import {
  peekUnsubscribePayloadUnsafe,
  verifyUnsubscribeToken
} from '@server/utils/unsubscribeToken'
import type { ContactLean } from '@server/types/tenant/contact.model'

export type ResolvedUnsubscribeContext = {
  dbName: string
  contactId: string
  contact: Pick<ContactLean, '_id' | 'email' | 'isUnsubscribe'>
}

export type UnsubscribeResolveFailure =
  | 'missing_token'
  | 'invalid_token'
  | 'tenant_not_found'
  | 'tenant_not_configured'
  | 'contact_not_found'

export function wantsJsonResponse(event: H3Event): boolean {
  const accept = String(getHeader(event, 'accept') ?? '').toLowerCase()
  return accept.includes('application/json')
}

export async function resolveUnsubscribeContext(
  token: string
): Promise<ResolvedUnsubscribeContext | null> {
  const trimmed = token.trim()
  if (!trimmed || trimmed === 'preview') return null

  const peek = peekUnsubscribePayloadUnsafe(trimmed)
  if (!peek) return null

  const registry = await getRegistryConnection()
  const row = await findRegistryTenantByDbName(registry, peek.db)
  if (!row?.clientKeyHash) return null

  const payload = verifyUnsubscribeToken(trimmed, row.clientKeyHash)
  if (!payload) return null

  const contactId = payload.c.trim()
  if (!mongoose.isValidObjectId(contactId)) return null

  const tenantConn = await getTenantConnectionByDbName(payload.db)
  const { Contact } = getTenantClientModels(tenantConn)
  const contact = await Contact.findOne(
    {
      _id: new mongoose.Types.ObjectId(contactId),
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }]
    },
    { email: 1, isUnsubscribe: 1 }
  ).lean<Pick<ContactLean, '_id' | 'email' | 'isUnsubscribe'> | null>()

  if (!contact) return null

  return {
    dbName: payload.db,
    contactId,
    contact
  }
}

export async function resolveUnsubscribeFailure(
  token: string
): Promise<UnsubscribeResolveFailure> {
  const trimmed = token.trim()
  if (!trimmed) return 'missing_token'

  const peek = peekUnsubscribePayloadUnsafe(trimmed)
  if (!peek) return 'invalid_token'

  const registry = await getRegistryConnection()
  const row = await findRegistryTenantByDbName(registry, peek.db)
  if (!row) return 'tenant_not_found'
  if (!row.clientKeyHash) return 'tenant_not_configured'

  const payload = verifyUnsubscribeToken(trimmed, row.clientKeyHash)
  if (!payload) return 'invalid_token'

  if (!mongoose.isValidObjectId(payload.c.trim())) return 'invalid_token'

  const tenantConn = await getTenantConnectionByDbName(payload.db)
  const { Contact } = getTenantClientModels(tenantConn)
  const contact = await Contact.findOne(
    {
      _id: new mongoose.Types.ObjectId(payload.c),
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }]
    },
    { _id: 1 }
  ).lean<{ _id: mongoose.Types.ObjectId } | null>()

  if (!contact) return 'contact_not_found'
  return 'invalid_token'
}

export function unsubscribeFailureCopy(
  reason: UnsubscribeResolveFailure
): { title: string; message: string } {
  switch (reason) {
    case 'missing_token':
      return {
        title: 'Invalid link',
        message: 'This unsubscribe link is missing required parameters.'
      }
    case 'tenant_not_found':
      return {
        title: 'Invalid link',
        message: 'This unsubscribe link is not associated with a valid organization.'
      }
    case 'tenant_not_configured':
      return {
        title: 'Unsubscribe unavailable',
        message:
          'Email preferences are not configured for this organization. Please contact support.'
      }
    case 'contact_not_found':
      return {
        title: 'Not found',
        message: 'We could not find this contact. You may already be unsubscribed.'
      }
    case 'invalid_token':
    default:
      return {
        title: 'Invalid or expired link',
        message:
          'This unsubscribe link is not valid. You may already be unsubscribed, or the link may have expired.'
      }
  }
}

export function maskEmail(email: string): string {
  const trimmed = email.trim()
  const at = trimmed.indexOf('@')
  if (at <= 0) return '***'
  const local = trimmed.slice(0, at)
  const domain = trimmed.slice(at + 1)
  const visible = local.slice(0, Math.min(1, local.length))
  return `${visible}***@${domain}`
}

export function marketingSubscribedFromContact(contact: Pick<ContactLean, 'isUnsubscribe'>): boolean {
  return contact.isUnsubscribe !== true
}
