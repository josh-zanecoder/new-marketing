import { normalizeContactCounty } from '~~/shared/utils/contactAddress'
import { usPhoneDigits } from '~~/shared/utils/usNumberFormatter'
import mongoose, { type Connection, type Types } from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { isValidMarketingEmail, normalizeMarketingEmail } from '@server/helpers/marketingEmail'
import { mergeTenantOwnerEmailScopeFilter } from '@server/utils/contactOwnerFilter'
import { applyContactTypeFieldsToSetDoc, normalizeContactTypeInput } from '@server/utils/contact/contactTypeWrite'
import { syncContactRecipientListMembership } from '@server/utils/recipient/syncContactRecipientListMembership'
import type { CreateTenantContactInput, CreateTenantContactResult } from './createTenantContact'

export async function updateTenantContact(
  tenantConn: Connection,
  auth: unknown,
  contactId: string,
  input: CreateTenantContactInput
): Promise<CreateTenantContactResult> {
  if (!mongoose.isValidObjectId(contactId)) {
    throw createError({ statusCode: 400, message: 'Invalid contact id' })
  }

  const objectId = new mongoose.Types.ObjectId(contactId)
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
  const address = {
    street: String(addressInput.street ?? '').trim(),
    city: String(addressInput.city ?? '').trim(),
    state: String(addressInput.state ?? '').trim(),
    county: normalizeContactCounty(String(addressInput.county ?? ''))
  }

  const { Contact } = getTenantClientModels(tenantConn)
  const scopeFilter = mergeTenantOwnerEmailScopeFilter(
    { _id: objectId, deletedAt: null },
    auth
  )
  const current = await Contact.findOne(scopeFilter).select('_id').lean()
  if (!current) {
    throw createError({ statusCode: 404, message: 'Contact not found' })
  }

  const duplicateEmailFilter = mergeTenantOwnerEmailScopeFilter(
    { email, deletedAt: null, _id: { $ne: objectId } },
    auth
  )
  const existingEmail = await Contact.findOne(duplicateEmailFilter).select('_id').lean()
  if (existingEmail) {
    throw createError({ statusCode: 409, message: 'A contact with this email already exists' })
  }

  if (phone) {
    const phoneDigits = usPhoneDigits(phone)
    if (phoneDigits.length >= 7) {
      const phoneScope = mergeTenantOwnerEmailScopeFilter(
        {
          deletedAt: null,
          phone: { $exists: true, $nin: [null, ''] },
          _id: { $ne: objectId }
        },
        auth
      )
      const withPhone = await Contact.find(phoneScope).select('phone').lean()
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
    firstName,
    lastName,
    email,
    phone,
    company,
    channel,
    status,
    stage,
    address,
    contactType: normalizeContactTypeInput(input.contactType)
  }

  await applyContactTypeFieldsToSetDoc(setDoc, tenantConn)

  const doc = await Contact.findOneAndUpdate(scopeFilter, { $set: setDoc }, { new: true })
  if (!doc) {
    throw createError({ statusCode: 404, message: 'Contact not found' })
  }

  await syncContactRecipientListMembership(tenantConn, doc._id as Types.ObjectId)

  return {
    id: String(doc._id),
    firstName: doc.firstName ?? '',
    lastName: doc.lastName ?? '',
    email: doc.email ?? ''
  }
}
