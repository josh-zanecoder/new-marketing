import { normalizeContactAddressInput } from '~~/shared/utils/contactAddress'
import { usPhoneDigits } from '~~/shared/utils/usNumberFormatter'
import { randomUUID } from 'node:crypto'
import type { Connection, Types } from 'mongoose'
import type { ContactLean, ContactModel } from '@server/types/tenant/contact.model'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { tenantOwnershipFieldsFromAuth } from '@server/tenant/registry-auth'
import { isValidMarketingEmail, normalizeMarketingEmail } from '@server/helpers/marketingEmail'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'
import { applyContactTypeFieldsToSetDoc, normalizeContactTypeInput } from '@server/utils/contact/contactTypeWrite'
import { scheduleContactRecipientListMembershipSync } from '@server/utils/recipient/syncContactRecipientListMembership'

const TENANT_UI_CONTACT_SOURCE = 'tenant-ui'

export interface ContactAddressInput {
  street?: string
  unit?: string
  city?: string
  state?: string
  county?: string
}

export function parseContactAddressBody(address: unknown): ContactAddressInput | undefined {
  if (!address || typeof address !== 'object' || Array.isArray(address)) return undefined
  const a = address as Record<string, unknown>
  return {
    street: typeof a.street === 'string' ? a.street : '',
    unit: typeof a.unit === 'string' ? a.unit : '',
    city: typeof a.city === 'string' ? a.city : '',
    state: typeof a.state === 'string' ? a.state : '',
    county: typeof a.county === 'string' ? a.county : ''
  }
}

export interface CreateTenantContactInput {
  firstName?: string
  lastName?: string
  email: string
  phone?: string
  company?: string
  contactType?: string | string[]
  channel?: string
  status?: string
  stage?: string
  address?: ContactAddressInput
}

export interface CreateTenantContactResult {
  id: string
  firstName: string
  lastName: string
  email: string
}

export async function createTenantContact(
  tenantConn: Connection,
  auth: unknown,
  input: CreateTenantContactInput
): Promise<CreateTenantContactResult> {
  const email = normalizeMarketingEmail(String(input.email ?? ''))
  if (!email || !isValidMarketingEmail(email)) {
    throw createError({ statusCode: 400, message: 'A valid email address is required' })
  }

  const firstName = String(input.firstName ?? '').trim()
  const lastName = String(input.lastName ?? '').trim()
  const phone = String(input.phone ?? '').trim()
  const company = String(input.company ?? '').trim()
  const channel = String(input.channel ?? 'email').trim() || 'email'
  const status = String(input.status ?? '').trim()
  const stage = String(input.stage ?? '').trim()
  const addressInput = input.address ?? {}
  const address = normalizeContactAddressInput(addressInput)

  const { Contact } = getTenantClientModels(tenantConn)
  const ownership = tenantOwnershipFieldsFromAuth(auth)
  const ownerMeta =
    ownership.metadata && typeof ownership.metadata === 'object'
      ? (ownership.metadata as Record<string, unknown>)
      : {}

  const duplicateFilter = mergeTenantOwnerEmailScopeFilter(
    { email, deletedAt: null },
    auth
  )
  const existing = await Contact.findOne(duplicateFilter).select('_id').lean()
  if (existing) {
    throw createError({ statusCode: 409, message: 'A contact with this email already exists' })
  }

  if (phone) {
    const phoneDigits = usPhoneDigits(phone)
    if (phoneDigits.length >= 7) {
      const phoneScope = mergeTenantOwnerEmailScopeFilter(
        { deletedAt: null, phone: { $exists: true, $nin: [null, ''] } },
        auth
      )
      const withPhone = await (Contact as ContactModel)
        .find(phoneScope)
        .select('phone')
        .lean<Pick<ContactLean, 'phone'>[]>()
      const phoneDuplicate = withPhone.some((row) => {
        const existingDigits = usPhoneDigits(String(row.phone ?? ''))
        return existingDigits.length >= 7 && existingDigits === phoneDigits
      })
      if (phoneDuplicate) {
        throw createError({
          statusCode: 409,
          message: 'A contact with this phone number already exists'
        })
      }
    }
  }

  const setDoc: Record<string, unknown> = {
    externalId: randomUUID(),
    source: TENANT_UI_CONTACT_SOURCE,
    firstName,
    lastName,
    email,
    phone,
    company,
    channel,
    status,
    stage,
    address,
    isUnsubscribe: false,
    deletedAt: null,
    metadata: { ...ownerMeta },
    contactType: normalizeContactTypeInput(input.contactType)
  }

  await applyContactTypeFieldsToSetDoc(setDoc, tenantConn)

  const doc = await Contact.create(setDoc)
  const id = String(doc._id)

  scheduleContactRecipientListMembershipSync(tenantConn, doc._id as Types.ObjectId)

  return { id, firstName, lastName, email }
}
